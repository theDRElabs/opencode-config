package com.drelabs.datacheck.data

import com.drelabs.datacheck.data.db.TickEntity
import com.drelabs.datacheck.data.db.UsageEntity
import com.drelabs.datacheck.data.db.UsageLogDao
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock

/**
 * Persistence surface required by [TickBookkeeper]. The production
 * implementation is [RoomTickStore] (adapts the Room UsageLogDao); JVM
 * tests provide a fake.
 */
interface TickStore {
    /** End time of the latest committed tick, or null when no tick exists. */
    suspend fun latestEndMs(): Long?

    /** Record the starting point when no tick exists yet (fresh install). */
    suspend fun stampStart(atMs: Long)

    /** Atomically persist one sampled window and its per-app rows. */
    suspend fun insertTick(
        startMs: Long,
        endMs: Long,
        deviceRx: Long,
        deviceTx: Long,
        usages: List<TickBookkeeper.WindowUsage>,
    )
}

/**
 * Cache-only view of the last tick end (SharedPreferences in production).
 * Never authoritative: the [TickStore] behind it wins on any disagreement.
 */
interface WindowCache {
    fun lastTickEndMs(): Long?
    fun storeLastTickEndMs(endMs: Long)
}

class TickBookkeeper(private val store: TickStore, private val cache: WindowCache) {

    data class WindowUsage(
        val uid: Int,
        val pkg: String,
        val rx: Long,
        val tx: Long,
        val fgRx: Long,
        val fgTx: Long,
    )

    data class TickDraft(
        val deviceRx: Long,
        val deviceTx: Long,
        val usages: List<WindowUsage>,
    )

    data class CommittedWindow(
        val startMs: Long,
        val endMs: Long,
        val deviceRx: Long,
        val deviceTx: Long,
        val usages: List<WindowUsage>,
    )

    /**
     * Runs one complete window commit as a single critical section:
     * resolve the start from the DB (source of truth), sample, insert,
     * then mirror the new end into the cache. The DB end decides the
     * window in every case — a stale, missing, or ahead-of-DB cache value
     * is never consulted for resolution, so it can never cause an
     * overlapping re-log, and a crash between insert and cache write is
     * absorbed by the next DB read. Fresh installs (no tick rows) stamp
     * the DB starting point and sample nothing.
     */
    suspend fun runWindow(
        nowMs: Long,
        sample: suspend (startMs: Long, endMs: Long) -> TickDraft?,
    ): CommittedWindow? = windowMutex.withLock {
        val lastEnd = store.latestEndMs()
        if (lastEnd == null) {
            store.stampStart(nowMs)
            cache.storeLastTickEndMs(nowMs)
            null
        } else if (nowMs <= lastEnd) {
            null
        } else {
            val startMs =
                if (nowMs - lastEnd > MAX_WINDOW_MS) nowMs - MAX_WINDOW_MS else lastEnd
            val draft = sample(startMs, nowMs)
            if (draft == null) {
                null
            } else {
                store.insertTick(startMs, nowMs, draft.deviceRx, draft.deviceTx, draft.usages)
                cache.storeLastTickEndMs(nowMs)
                CommittedWindow(startMs, nowMs, draft.deviceRx, draft.deviceTx, draft.usages)
            }
        }
    }

    companion object {
        const val MAX_WINDOW_MS: Long = 6 * 60 * 60 * 1000L

        /**
         * App-scoped lock: SamplingEngine (and with it TickBookkeeper) is
         * constructed per call site — WorkManager tick vs dashboard
         * catch-up — so only a companion-level mutex serializes
         * resolve→sample→insert across the whole process. [withLock]
         * releases on exceptions, so a throwing sample cannot deadlock.
         */
        private val windowMutex = Mutex()
    }
}

/**
 * Production [TickStore] over the Room [UsageLogDao]. The DB is the
 * source of truth: [UsageLogDao.latestEndMs] (previously dead code) is
 * the live window-start query. [stampStart] persists an empty tick row
 * (start == end, zero bytes, no usage rows) so a fresh install is
 * immediately visible to [UsageLogDao.latestEndMs] without any schema
 * change; it is invisible to usage-based queries and dashboards.
 */
class RoomTickStore(private val dao: UsageLogDao) : TickStore {

    override suspend fun latestEndMs(): Long? = dao.latestEndMs()

    override suspend fun stampStart(atMs: Long) {
        dao.insertTickWithUsages(
            TickEntity(startMs = atMs, endMs = atMs, deviceRx = 0L, deviceTx = 0L),
            emptyList(),
        )
    }

    override suspend fun insertTick(
        startMs: Long,
        endMs: Long,
        deviceRx: Long,
        deviceTx: Long,
        usages: List<TickBookkeeper.WindowUsage>,
    ) {
        dao.insertTickWithUsages(
            TickEntity(startMs = startMs, endMs = endMs, deviceRx = deviceRx, deviceTx = deviceTx),
            usages.map { usage ->
                UsageEntity(
                    tickId = 0L,
                    tickStart = startMs,
                    uid = usage.uid,
                    pkg = usage.pkg,
                    rx = usage.rx,
                    tx = usage.tx,
                    fgRx = usage.fgRx,
                    fgTx = usage.fgTx,
                )
            },
        )
    }
}

/**
 * Production [WindowCache]: SharedPreferences mirror of the last tick
 * end. Write-through only — no resolution decision is ever based on it.
 */
class PrefsWindowCache(private val prefs: Prefs) : WindowCache {

    override fun lastTickEndMs(): Long? = prefs.lastTickEndMs.takeIf { it != 0L }

    override fun storeLastTickEndMs(endMs: Long) {
        prefs.lastTickEndMs = endMs
    }
}
