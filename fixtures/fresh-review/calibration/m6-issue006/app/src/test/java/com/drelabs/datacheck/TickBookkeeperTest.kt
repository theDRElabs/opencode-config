package com.drelabs.datacheck

import com.drelabs.datacheck.data.TickBookkeeper
import com.drelabs.datacheck.data.TickStore
import com.drelabs.datacheck.data.WindowCache
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.yield
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TickBookkeeperTest {

    private class FakeWindowCache(var cached: Long? = null) : WindowCache {
        override fun lastTickEndMs(): Long? = cached

        override fun storeLastTickEndMs(endMs: Long) {
            cached = endMs
        }
    }

    private data class RecordedWindow(val startMs: Long, val endMs: Long)

    private class FakeTickStore(initialEndMs: Long? = null) : TickStore {
        private var lastEndMs: Long? = initialEndMs
        val inserted = mutableListOf<RecordedWindow>()
        var stampedAt: Long? = null
            private set

        override suspend fun latestEndMs(): Long? = lastEndMs

        override suspend fun stampStart(atMs: Long) {
            stampedAt = atMs
            lastEndMs = atMs
        }

        override suspend fun insertTick(
            startMs: Long,
            endMs: Long,
            deviceRx: Long,
            deviceTx: Long,
            usages: List<TickBookkeeper.WindowUsage>,
        ) {
            inserted += RecordedWindow(startMs, endMs)
            lastEndMs = maxOf(lastEndMs ?: Long.MIN_VALUE, endMs)
        }
    }

    private fun draft(): TickBookkeeper.TickDraft =
        TickBookkeeper.TickDraft(
            deviceRx = 1_500L,
            deviceTx = 500L,
            usages = listOf(
                TickBookkeeper.WindowUsage(
                    uid = 10_045,
                    pkg = "com.example.app",
                    rx = 1_200L,
                    tx = 400L,
                    fgRx = 900L,
                    fgTx = 300L,
                ),
            ),
        )

    /** Windows must exactly tile [rangeStart, rangeEnd]: no overlap, no gap. */
    private fun assertTilesRange(windows: List<RecordedWindow>, rangeStart: Long, rangeEnd: Long) {
        assertTrue("expected at least one window, got none", windows.isNotEmpty())
        val sorted = windows.sortedBy { it.startMs }
        assertEquals(rangeStart, sorted.first().startMs)
        assertEquals(rangeEnd, sorted.last().endMs)
        sorted.zipWithNext().forEach { (previous, next) ->
            assertEquals(
                "windows must not overlap or leave a gap: $previous then $next",
                previous.endMs,
                next.startMs,
            )
        }
    }

    // --- sequential behavior (regression guards, expected green vs stub) ---

    @Test
    fun `sequential windows are gapless and non-overlapping`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 1_000L)
        val cache = FakeWindowCache(cached = 1_000L)
        val bookkeeper = TickBookkeeper(store, cache)

        val first = bookkeeper.runWindow(2_000L) { _, _ -> draft() }
        val second = bookkeeper.runWindow(3_500L) { _, _ -> draft() }

        assertEquals(1_000L, first?.startMs)
        assertEquals(2_000L, first?.endMs)
        assertEquals(2_000L, second?.startMs)
        assertEquals(3_500L, second?.endMs)
        assertEquals(2, store.inserted.size)
        assertEquals(3_500L, cache.cached)
    }

    @Test
    fun `tick at or before the last end is skipped`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 2_000L)
        val cache = FakeWindowCache(cached = 2_000L)
        val bookkeeper = TickBookkeeper(store, cache)

        assertNull(bookkeeper.runWindow(2_000L) { _, _ -> draft() })
        assertNull(bookkeeper.runWindow(1_500L) { _, _ -> draft() })
        assertTrue(store.inserted.isEmpty())
    }

    @Test
    fun `empty sample commits nothing and keeps the window start`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 1_000L)
        val cache = FakeWindowCache(cached = 1_000L)
        val bookkeeper = TickBookkeeper(store, cache)

        assertNull(bookkeeper.runWindow(2_000L) { _, _ -> null })
        assertTrue(store.inserted.isEmpty())
        assertEquals(1_000L, store.latestEndMs())

        val committed = bookkeeper.runWindow(3_000L) { _, _ -> draft() }
        assertEquals(1_000L, committed?.startMs)
    }

    @Test
    fun `fresh install stamps the database start point and samples nothing`() = runBlocking {
        val store = FakeTickStore()
        val cache = FakeWindowCache()
        val bookkeeper = TickBookkeeper(store, cache)

        assertNull(bookkeeper.runWindow(1_000L) { _, _ -> draft() })
        assertTrue(store.inserted.isEmpty())
        assertEquals(1_000L, store.stampedAt)
        assertEquals(1_000L, store.latestEndMs())

        val committed = bookkeeper.runWindow(2_000L) { _, _ -> draft() }
        assertEquals(1_000L, committed?.startMs)
    }

    @Test
    fun `gap longer than the max window is clamped`() = runBlocking {
        val maxWindow = TickBookkeeper.MAX_WINDOW_MS
        val store = FakeTickStore(initialEndMs = 1_000L)
        val cache = FakeWindowCache(cached = 1_000L)
        val now = 1_000L + maxWindow + 4 * 60 * 60 * 1000L

        val committed = TickBookkeeper(store, cache).runWindow(now) { _, _ -> draft() }

        assertEquals(now - maxWindow, committed?.startMs)
        assertEquals(now, committed?.endMs)
    }

    // --- DB beats stale cache (expected red vs stub) ---

    @Test
    fun `stale cached end loses to the database end`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 2_000L)
        val cache = FakeWindowCache(cached = 1_000L)
        val bookkeeper = TickBookkeeper(store, cache)

        val committed = bookkeeper.runWindow(3_000L) { _, _ -> draft() }

        assertEquals(2_000L, committed?.startMs)
        assertEquals(listOf(RecordedWindow(2_000L, 3_000L)), store.inserted)
    }

    @Test
    fun `cached end ahead of the database also loses`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 2_000L)
        val cache = FakeWindowCache(cached = 2_500L)
        val bookkeeper = TickBookkeeper(store, cache)

        val committed = bookkeeper.runWindow(3_000L) { _, _ -> draft() }

        assertEquals(2_000L, committed?.startMs)
    }

    @Test
    fun `missing cache entry falls back to the database`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 2_000L)
        val cache = FakeWindowCache(cached = null)
        val bookkeeper = TickBookkeeper(store, cache)

        val committed = bookkeeper.runWindow(3_000L) { _, _ -> draft() }

        assertEquals(2_000L, committed?.startMs)
        assertEquals(listOf(RecordedWindow(2_000L, 3_000L)), store.inserted)
    }

    @Test
    fun `crash after insert does not re-log the already committed window`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 2_000L)
        store.inserted += RecordedWindow(1_500L, 2_000L)
        val cache = FakeWindowCache(cached = 1_500L)
        val bookkeeper = TickBookkeeper(store, cache)

        val committed = bookkeeper.runWindow(3_000L) { _, _ -> draft() }

        assertEquals(2_000L, committed?.startMs)
        assertEquals(
            listOf(RecordedWindow(1_500L, 2_000L), RecordedWindow(2_000L, 3_000L)),
            store.inserted,
        )
    }

    // --- concurrency (expected red vs stub) ---

    @Test
    fun `interleaved ticks through one bookkeeper never double-log a window`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 1_000L)
        val cache = FakeWindowCache(cached = 1_000L)
        val bookkeeper = TickBookkeeper(store, cache)

        val jobs = listOf(
            launch { bookkeeper.runWindow(2_000L) { _, _ -> yield(); draft() } },
            launch { bookkeeper.runWindow(2_500L) { _, _ -> yield(); draft() } },
        )
        jobs.forEach { it.join() }

        assertEquals(2, store.inserted.size)
        assertTilesRange(store.inserted, rangeStart = 1_000L, rangeEnd = 2_500L)
    }

    @Test
    fun `interleaved ticks through two bookkeeper instances never double-log a window`() = runBlocking {
        val store = FakeTickStore(initialEndMs = 1_000L)
        val cache = FakeWindowCache(cached = 1_000L)
        val workerBookkeeper = TickBookkeeper(store, cache)
        val dashboardBookkeeper = TickBookkeeper(store, cache)

        val jobs = listOf(
            launch { workerBookkeeper.runWindow(2_000L) { _, _ -> yield(); draft() } },
            launch { dashboardBookkeeper.runWindow(2_500L) { _, _ -> yield(); draft() } },
        )
        jobs.forEach { it.join() }

        assertEquals(2, store.inserted.size)
        assertTilesRange(store.inserted, rangeStart = 1_000L, rangeEnd = 2_500L)
    }
}
