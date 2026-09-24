package com.drelabs.datacheck.data

import android.app.usage.NetworkStats
import android.app.usage.NetworkStatsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.net.ConnectivityManager
import android.os.Process
import com.drelabs.datacheck.data.Attribution.Interval
import com.drelabs.datacheck.data.db.TickEntity
import com.drelabs.datacheck.data.db.UsageEntity
import com.drelabs.datacheck.data.db.UsageLogDb
import java.time.LocalDate
import java.time.ZoneId

class SamplingEngine(private val context: Context) {

    data class TickResult(val tick: TickEntity, val rows: List<UsageEntity>)

    private val prefs = Prefs(context)
    private val dao = UsageLogDb.get(context).usageLogDao()

    suspend fun runTick(nowMs: Long = System.currentTimeMillis()): TickResult? {
        val start = resolveWindowStart(nowMs) ?: return null
        val perUid = queryMobilePerUid(start, nowMs)
        if (perUid.isEmpty()) return null
        val device = queryDeviceTotal(start, nowMs)
        val fgByPkg = foregroundFractions(start, nowMs)
        val rows = perUid.map { (uid, bytes) ->
            val pkg = pkgNameForUid(uid)
            val total = bytes.first + bytes.second
            val fgBytes: Long
            val stateSplit = stateSplitForUid(uid, start, nowMs)
            fgBytes = if (stateSplit != null && stateSplit.first + stateSplit.second > 0) {
                stateSplit.first.coerceIn(0L, total)
            } else {
                val frac = fgByPkg[pkg] ?: 0.0
                Attribution.split(total, frac).first
            }
            val fgRx = if (total > 0) (fgBytes.toDouble() * bytes.first / total).toLong() else 0L
            val fgTx = fgBytes - fgRx
            UsageEntity(
                tickId = 0,
                tickStart = start,
                uid = uid,
                pkg = pkg,
                rx = bytes.first,
                tx = bytes.second,
                fgRx = fgRx,
                fgTx = fgTx,
            )
        }
        val result = saveTick(
            start,
            nowMs,
            device?.first ?: perUid.values.sumOf { it.first },
            device?.second ?: perUid.values.sumOf { it.second },
            rows,
        )
        prefs.rebootPending = false
        return result
    }

    /**
     * Raw NSM mobile total (rx+tx) for today's local window, for the
     * dashboard validation card. Returns null when NSM is unavailable or
     * the query fails. Read-only: never writes rows.
     */
    fun rawMobileTotalTodayBytes(nowMs: Long = System.currentTimeMillis()): Long? {
        val zone = ZoneId.systemDefault()
        val midnight = LocalDate.now(zone).atStartOfDay(zone).toInstant().toEpochMilli()
        val device = queryDeviceTotal(midnight, nowMs) ?: return null
        return device.first + device.second
    }

    private suspend fun saveTick(
        start: Long,
        end: Long,
        deviceRx: Long,
        deviceTx: Long,
        rows: List<UsageEntity>,
    ): TickResult {
        val tick = TickEntity(startMs = start, endMs = end, deviceRx = deviceRx, deviceTx = deviceTx)
        dao.insertTickWithUsages(tick, rows)
        dao.deleteOlderThan(end - RETENTION_MS)
        prefs.lastTickEndMs = end
        return TickResult(tick, rows)
    }

    private fun resolveWindowStart(nowMs: Long): Long? {
        val last = prefs.lastTickEndMs
        return when {
            last == 0L -> {
                prefs.lastTickEndMs = nowMs
                null
            }
            nowMs - last > MAX_WINDOW_MS -> {
                prefs.lastTickEndMs = nowMs - MAX_WINDOW_MS
                nowMs - MAX_WINDOW_MS
            }
            nowMs <= last -> null
            else -> last
        }
    }

    @Suppress("DEPRECATION")
    private fun queryMobilePerUid(startMs: Long, endMs: Long): Map<Int, Pair<Long, Long>> {
        val nsm = context.getSystemService(NetworkStatsManager::class.java) ?: return emptyMap()
        val out = HashMap<Int, LongArray>()
        try {
            val stats: NetworkStats =
                nsm.querySummary(ConnectivityManager.TYPE_MOBILE, null, startMs, endMs)
            val bucket = NetworkStats.Bucket()
            while (stats.hasNextBucket()) {
                stats.getNextBucket(bucket)
                val acc = out.getOrPut(bucket.uid) { longArrayOf(0L, 0L) }
                acc[0] += bucket.rxBytes.coerceAtLeast(0L)
                acc[1] += bucket.txBytes.coerceAtLeast(0L)
            }
            stats.close()
        } catch (_: SecurityException) {
            return emptyMap()
        } catch (_: Exception) {
            return emptyMap()
        }
        return out.mapValues { (_, v) -> v[0] to v[1] }.filterValues { it.first > 0 || it.second > 0 }
    }

    private fun queryDeviceTotal(startMs: Long, endMs: Long): Pair<Long, Long>? {
        val nsm = context.getSystemService(NetworkStatsManager::class.java) ?: return null
        return try {
            val b = nsm.querySummaryForDevice(ConnectivityManager.TYPE_MOBILE, null, startMs, endMs)
            b.rxBytes.coerceAtLeast(0L) to b.txBytes.coerceAtLeast(0L)
        } catch (_: Exception) {
            null
        }
    }

    @Suppress("DEPRECATION")
    private fun foregroundFractions(startMs: Long, endMs: Long): Map<String, Double> {
        val usm = context.getSystemService(UsageStatsManager::class.java) ?: return emptyMap()
        val open = HashMap<String, MutableList<Long>>()
        val closed = HashMap<String, MutableList<Interval>>()
        try {
            val events = usm.queryEvents(startMs, endMs)
            val event = UsageEvents.Event()
            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND ->
                        open.getOrPut(event.packageName) { mutableListOf() }.add(event.timeStamp)

                    UsageEvents.Event.MOVE_TO_BACKGROUND ->
                        open[event.packageName]?.removeFirstOrNull()?.let { ts ->
                            closed.getOrPut(event.packageName) { mutableListOf() }
                                .add(Interval(ts, event.timeStamp))
                        }
                }
            }
        } catch (_: Exception) {
            return emptyMap()
        }
        open.forEach { (pkg, starts) ->
            starts.forEach { ts ->
                closed.getOrPut(pkg) { mutableListOf() }.add(Interval(ts, endMs))
            }
        }
        return closed.mapValues { (_, intervals) ->
            Attribution.foregroundFraction(Attribution.merge(intervals), startMs, endMs)
        }.filterValues { it > 0.0 }
    }

    private fun pkgNameForUid(uid: Int): String = when {
        uid == NetworkStats.Bucket.UID_TETHERING -> "tethering"
        uid == NetworkStats.Bucket.UID_REMOVED -> "removed-apps"
        uid == Process.SYSTEM_UID -> "android-system"
        uid in 0 until 2000 -> "system-$uid"
        else -> context.packageManager.getPackagesForUid(uid)?.firstOrNull() ?: "uid-$uid"
    }

    private fun stateSplitForUid(uid: Int, startMs: Long, endMs: Long): Pair<Long, Long>? {
        if (uid < 0) return null
        val nsm = context.getSystemService(NetworkStatsManager::class.java) ?: return null
        return try {
            val stats =
                nsm.queryDetailsForUid(ConnectivityManager.TYPE_MOBILE, null, startMs, endMs, uid)
            var fg = 0L
            var bg = 0L
            val bucket = NetworkStats.Bucket()
            while (stats.hasNextBucket()) {
                stats.getNextBucket(bucket)
                val bytes = (bucket.rxBytes.coerceAtLeast(0L) + bucket.txBytes.coerceAtLeast(0L))
                if (bucket.state == NetworkStats.Bucket.STATE_FOREGROUND) {
                    fg += bytes
                } else {
                    bg += bytes
                }
            }
            stats.close()
            fg to bg
        } catch (_: Exception) {
            null
        }
    }

    companion object {
        const val MAX_WINDOW_MS: Long = 6 * 60 * 60 * 1000L
        const val RETENTION_MS: Long = 30L * 24 * 60 * 60 * 1000L
    }
}
