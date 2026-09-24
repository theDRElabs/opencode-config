package com.drelabs.datacheck

import com.drelabs.datacheck.data.BundleLogic
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

class BundleLogicTest {

    // --- usage window: entry-time baseline ---

    @Test
    fun `usage after entry is counted`() {
        val entry = 1_800_000_000_000L
        val rows = listOf(
            BundleLogic.UsageRow(tickStart = entry + 3_600_000L, total = 50_000_000L),
        )
        assertEquals(50_000_000L, BundleLogic.usageSinceEntry(rows, entryAtMs = entry))
    }

    @Test
    fun `usage before entry is not counted`() {
        val entry = 1_800_000_000_000L
        val rows = listOf(
            BundleLogic.UsageRow(tickStart = entry - 7_200_000L, total = 30_000_000L),
            BundleLogic.UsageRow(tickStart = entry + 3_600_000L, total = 20_000_000L),
        )
        assertEquals(20_000_000L, BundleLogic.usageSinceEntry(rows, entryAtMs = entry))
    }

    @Test
    fun `row exactly at entry timestamp is counted`() {
        val entry = 1_800_000_000_000L
        val rows = listOf(
            BundleLogic.UsageRow(tickStart = entry, total = 10_000_000L),
        )
        assertEquals(10_000_000L, BundleLogic.usageSinceEntry(rows, entryAtMs = entry))
    }

    @Test
    fun `new entry resets the baseline without dropping rows`() {
        val firstEntry = 1_800_000_000_000L
        val secondEntry = firstEntry + 86_400_000L
        val rows = listOf(
            BundleLogic.UsageRow(tickStart = firstEntry + 60_000L, total = 30_000_000L),
            BundleLogic.UsageRow(tickStart = secondEntry + 60_000L, total = 20_000_000L),
        )
        assertEquals(50_000_000L, BundleLogic.usageSinceEntry(rows, entryAtMs = firstEntry))
        assertEquals(20_000_000L, BundleLogic.usageSinceEntry(rows, entryAtMs = secondEntry))
    }

    // --- card state: hidden cases ---

    @Test
    fun `bundle zero hides the card`() {
        assertEquals(
            BundleLogic.CardState.Hidden,
            BundleLogic.buildState(
                bundleBytes = 0L,
                entryAtMs = 1_800_000_000_000L - 3_600_000L,
                usedSinceEntryBytes = 123_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    @Test
    fun `unstamped entry hides the card`() {
        assertEquals(
            BundleLogic.CardState.Hidden,
            BundleLogic.buildState(
                bundleBytes = 121_000_000L,
                entryAtMs = 0L,
                usedSinceEntryBytes = 999_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    // --- card state: values ---

    @Test
    fun `values state reports used left pct and days to renewal`() {
        assertEquals(
            BundleLogic.CardState.Values(
                bundleBytes = 1_000_000_000L,
                usedBytes = 250_000_000L,
                leftBytes = 750_000_000L,
                pct = 0.25f,
                daysLeft = 20L,
            ),
            BundleLogic.buildState(
                bundleBytes = 1_000_000_000L,
                entryAtMs = 1_800_000_000_000L - 86_400_000L,
                usedSinceEntryBytes = 250_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    @Test
    fun `used beyond the bundle clamps left to zero and pct to one`() {
        assertEquals(
            BundleLogic.CardState.Values(
                bundleBytes = 100_000_000L,
                usedBytes = 250_000_000L,
                leftBytes = 0L,
                pct = 1f,
                daysLeft = 20L,
            ),
            BundleLogic.buildState(
                bundleBytes = 100_000_000L,
                entryAtMs = 1_800_000_000_000L - 86_400_000L,
                usedSinceEntryBytes = 250_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    @Test
    fun `nothing used since entry leaves the full bundle`() {
        assertEquals(
            BundleLogic.CardState.Values(
                bundleBytes = 121_000_000L,
                usedBytes = 0L,
                leftBytes = 121_000_000L,
                pct = 0f,
                daysLeft = 20L,
            ),
            BundleLogic.buildState(
                bundleBytes = 121_000_000L,
                entryAtMs = 1_800_000_000_000L - 86_400_000L,
                usedSinceEntryBytes = 0L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    @Test
    fun `future entry timestamp yields zero used`() {
        assertEquals(
            BundleLogic.CardState.Values(
                bundleBytes = 500_000_000L,
                usedBytes = 0L,
                leftBytes = 500_000_000L,
                pct = 0f,
                daysLeft = 20L,
            ),
            BundleLogic.buildState(
                bundleBytes = 500_000_000L,
                entryAtMs = 1_800_000_000_000L + 3_600_000L,
                usedSinceEntryBytes = 250_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    // --- renewal day stays informational ---

    @Test
    fun `days to renewal is unaffected by entry time`() {
        val expected = BundleLogic.CardState.Values(
            bundleBytes = 1_000_000_000L,
            usedBytes = 250_000_000L,
            leftBytes = 750_000_000L,
            pct = 0.25f,
            daysLeft = 20L,
        )
        assertEquals(
            expected,
            BundleLogic.buildState(
                bundleBytes = 1_000_000_000L,
                entryAtMs = 1_800_000_000_000L - 10 * 86_400_000L,
                usedSinceEntryBytes = 250_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
        assertEquals(
            expected,
            BundleLogic.buildState(
                bundleBytes = 1_000_000_000L,
                entryAtMs = 1_800_000_000_000L - 3_600_000L,
                usedSinceEntryBytes = 250_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 1,
            ),
        )
    }

    @Test
    fun `days to renewal follows the renewal day`() {
        assertEquals(
            BundleLogic.CardState.Values(
                bundleBytes = 1_000_000_000L,
                usedBytes = 250_000_000L,
                leftBytes = 750_000_000L,
                pct = 0.25f,
                daysLeft = 4L,
            ),
            BundleLogic.buildState(
                bundleBytes = 1_000_000_000L,
                entryAtMs = 1_800_000_000_000L - 86_400_000L,
                usedSinceEntryBytes = 250_000_000L,
                nowMs = 1_800_000_000_000L,
                today = LocalDate.of(2026, 9, 11),
                renewalDay = 15,
            ),
        )
    }
}
