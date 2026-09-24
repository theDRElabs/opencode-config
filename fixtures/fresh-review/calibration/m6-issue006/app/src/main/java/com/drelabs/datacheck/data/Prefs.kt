package com.drelabs.datacheck.data

import android.annotation.SuppressLint
import android.content.Context

@SuppressLint("ApplySharedPref")
class Prefs(context: Context) {
    private val sp = context.applicationContext
        .getSharedPreferences("datacheck_prefs", Context.MODE_PRIVATE)

    var lastTickEndMs: Long
        get() = sp.getLong(KEY_LAST_TICK, 0L)
        set(value) {
            sp.edit().putLong(KEY_LAST_TICK, value).commit()
        }

    var rebootPending: Boolean
        get() = sp.getBoolean(KEY_REBOOT, false)
        set(value) {
            sp.edit().putBoolean(KEY_REBOOT, value).commit()
        }

    var pingIntervalMinutes: Int
        get() = sp.getInt(KEY_INTERVAL, 15)
        set(value) {
            sp.edit().putInt(KEY_INTERVAL, value).commit()
        }

    var bundleBytes: Long
        get() = sp.getLong(KEY_BUNDLE, 0L)
        set(value) {
            sp.edit().putLong(KEY_BUNDLE, value).commit()
        }

    var bundleRenewalDay: Int
        get() = sp.getInt(KEY_RENEWAL, 1)
        set(value) {
            sp.edit().putInt(KEY_RENEWAL, value).commit()
        }

    var showValidationCard: Boolean
        get() = sp.getBoolean(KEY_VALIDATION, false)
        set(value) {
            sp.edit().putBoolean(KEY_VALIDATION, value).commit()
        }

    companion object {
        private const val KEY_LAST_TICK = "last_tick_end_ms"
        private const val KEY_REBOOT = "reboot_pending"
        private const val KEY_INTERVAL = "ping_interval_minutes"
        private const val KEY_BUNDLE = "bundle_bytes"
        private const val KEY_RENEWAL = "bundle_renewal_day"
        private const val KEY_VALIDATION = "show_validation_card"
    }
}
