package com.drelabs.datacheck.data

/**
 * Pure logic for the dashboard validation card (ISSUE-002).
 *
 * The card compares the NetworkStatsManager raw mobile total for today with
 * the sum of logged tick rows today, so a mismatch versus Android Settings
 * is attributable (our sampling vs system-level counters).
 */
object Validation {

    /** UI state for the validation card. */
    sealed interface CardState {
        /** Settings toggle disabled — the card must not be shown. */
        data object Hidden : CardState

        /** Toggle enabled but the NSM raw-today query failed or is unavailable. */
        data object Error : CardState

        /** Toggle enabled and both figures available. */
        data class Values(
            val nsmRawTodayBytes: Long,
            val loggedTodayBytes: Long,
            val deltaBytes: Long,
        ) : CardState
    }

    /**
     * Delta between the NSM raw mobile total today and the sum of logged
     * tick rows today. Positive means our log under-reports versus the
     * system; negative means it over-reports. Both inputs are non-negative
     * byte counts, so Long subtraction cannot overflow.
     */
    fun delta(nsmRawTodayBytes: Long, loggedTodayBytes: Long): Long {
        return nsmRawTodayBytes - loggedTodayBytes
    }

    /**
     * Builds the card state from the persisted toggle and the two figures.
     * [nsmRawTodayBytes] is null when the engine's NSM raw-today query
     * failed or is unavailable; [loggedTodayBytes] is 0 when nothing was
     * logged today (no rows is not an error).
     */
    fun buildState(
        toggleEnabled: Boolean,
        nsmRawTodayBytes: Long?,
        loggedTodayBytes: Long,
    ): CardState {
        if (!toggleEnabled) return CardState.Hidden
        if (nsmRawTodayBytes == null) return CardState.Error
        return CardState.Values(
            nsmRawTodayBytes = nsmRawTodayBytes,
            loggedTodayBytes = loggedTodayBytes,
            deltaBytes = delta(nsmRawTodayBytes, loggedTodayBytes),
        )
    }
}
