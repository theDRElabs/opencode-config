package com.drelabs.datacheck.data

import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * Pure logic for the bundle card baseline (ISSUE-007).
 *
 * Entering a bundle figure means "this is my current remaining balance,
 * as of now": bundle usage counts only from the entry timestamp forward,
 * never from the renewal-cycle calendar start. The renewal day remains a
 * separate, informational feature (days-to-renewal display only).
 */
object BundleLogic {

    /** Row shape for the pure usage-window computation (DAO-shaped). */
    data class UsageRow(
        val tickStart: Long,
        val total: Long,
    )

    /** UI state for the bundle card. */
    sealed interface CardState {
        /**
         * No bundle entered (bundleBytes <= 0), or the persisted figure
         * was never stamped with an entry time (entryAtMs <= 0) — the
         * card must not be shown.
         */
        data object Hidden : CardState

        /** Bundle entered and stamped; usage counted since entry. */
        data class Values(
            val bundleBytes: Long,
            val usedBytes: Long,
            val leftBytes: Long,
            /** Fraction of the bundle used, coerced to [0, 1]. */
            val pct: Float,
            /** Informational: days from today to the next renewal date. */
            val daysLeft: Long,
        ) : CardState
    }

    /**
     * Sum of usage rows with tickStart >= [entryAtMs]: usage before the
     * entry is not part of the bundle baseline. Executable spec for the
     * DAO call totalsSince(entryAtMs) the dashboard makes (same `>=`
     * window: UsageLogDao totalsSince).
     */
    fun usageSinceEntry(rows: List<UsageRow>, entryAtMs: Long): Long {
        return rows.asSequence()
            .filter { it.tickStart >= entryAtMs }
            .sumOf { it.total }
    }

    /**
     * Builds the card state from the persisted bundle figure, its entry
     * timestamp, and the usage summed since that timestamp:
     * - bundleBytes <= 0 or entryAtMs <= 0 → [CardState.Hidden]
     * - entryAtMs > nowMs (clock skew) → used = 0
     * - leftBytes = max(bundleBytes - usedBytes, 0)
     * - pct = usedBytes / bundleBytes coerced to [0, 1]
     * - daysLeft is derived from today + renewalDay only, never from
     *   the entry timestamp.
     */
    fun buildState(
        bundleBytes: Long,
        entryAtMs: Long,
        usedSinceEntryBytes: Long,
        nowMs: Long,
        today: LocalDate,
        renewalDay: Int,
    ): CardState {
        if (bundleBytes <= 0L || entryAtMs <= 0L) return CardState.Hidden
        val used = if (entryAtMs > nowMs) 0L else usedSinceEntryBytes
        val left = (bundleBytes - used).coerceAtLeast(0L)
        val pct = (used.toDouble() / bundleBytes).toFloat().coerceIn(0f, 1f)
        val day = renewalDay.coerceIn(1, 28)
        val cycleStart = if (today.dayOfMonth >= day) {
            today.withDayOfMonth(day)
        } else {
            today.minusMonths(1).withDayOfMonth(day)
        }
        val daysLeft = ChronoUnit.DAYS.between(today, cycleStart.plusMonths(1))
        return CardState.Values(
            bundleBytes = bundleBytes,
            usedBytes = used,
            leftBytes = left,
            pct = pct,
            daysLeft = daysLeft,
        )
    }
}
