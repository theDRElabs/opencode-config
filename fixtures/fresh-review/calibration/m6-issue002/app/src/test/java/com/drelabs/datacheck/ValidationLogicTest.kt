package com.drelabs.datacheck

import com.drelabs.datacheck.data.Validation
import org.junit.Assert.assertEquals
import org.junit.Test

class ValidationLogicTest {

    // --- delta computation ---

    @Test
    fun `delta is positive when nsm raw exceeds logged`() {
        assertEquals(500_000_000L, Validation.delta(2_500_000_000L, 2_000_000_000L))
    }

    @Test
    fun `delta is negative when logged exceeds nsm raw`() {
        assertEquals(-2_500_000L, Validation.delta(1_000_000L, 3_500_000L))
    }

    @Test
    fun `delta of zero vs zero is zero`() {
        assertEquals(0L, Validation.delta(0L, 0L))
    }

    @Test
    fun `delta handles gb range values beyond int range`() {
        assertEquals(1_000_000_000L, Validation.delta(8_000_000_000_000L, 7_999_000_000_000L))
    }

    @Test
    fun `delta handles long extremes without overflow`() {
        assertEquals(Long.MAX_VALUE, Validation.delta(Long.MAX_VALUE, 0L))
    }

    // --- state building ---

    @Test
    fun `toggle off hides card regardless of values`() {
        assertEquals(
            Validation.CardState.Hidden,
            Validation.buildState(
                toggleEnabled = false,
                nsmRawTodayBytes = 1_234_567L,
                loggedTodayBytes = 987_654L,
            ),
        )
    }

    @Test
    fun `toggle off hides card even when nsm query failed`() {
        assertEquals(
            Validation.CardState.Hidden,
            Validation.buildState(
                toggleEnabled = false,
                nsmRawTodayBytes = null,
                loggedTodayBytes = 500L,
            ),
        )
    }

    @Test
    fun `toggle on with failed nsm query yields error state`() {
        assertEquals(
            Validation.CardState.Error,
            Validation.buildState(
                toggleEnabled = true,
                nsmRawTodayBytes = null,
                loggedTodayBytes = 1_000_000L,
            ),
        )
    }

    @Test
    fun `toggle on with both values shows figures and delta`() {
        assertEquals(
            Validation.CardState.Values(
                nsmRawTodayBytes = 3_000_000L,
                loggedTodayBytes = 2_500_000L,
                deltaBytes = 500_000L,
            ),
            Validation.buildState(
                toggleEnabled = true,
                nsmRawTodayBytes = 3_000_000L,
                loggedTodayBytes = 2_500_000L,
            ),
        )
    }

    @Test
    fun `toggle on with no logged rows shows zero logged and full delta`() {
        assertEquals(
            Validation.CardState.Values(
                nsmRawTodayBytes = 5_000_000L,
                loggedTodayBytes = 0L,
                deltaBytes = 5_000_000L,
            ),
            Validation.buildState(
                toggleEnabled = true,
                nsmRawTodayBytes = 5_000_000L,
                loggedTodayBytes = 0L,
            ),
        )
    }

    @Test
    fun `toggle on with matching figures shows zero delta`() {
        assertEquals(
            Validation.CardState.Values(
                nsmRawTodayBytes = 42_000L,
                loggedTodayBytes = 42_000L,
                deltaBytes = 0L,
            ),
            Validation.buildState(
                toggleEnabled = true,
                nsmRawTodayBytes = 42_000L,
                loggedTodayBytes = 42_000L,
            ),
        )
    }
}
