package com.drelabs.datacheck.ui.dashboard

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.drelabs.datacheck.data.BundleLogic
import com.drelabs.datacheck.data.CsvExporter
import com.drelabs.datacheck.data.Prefs
import com.drelabs.datacheck.data.Validation
import com.drelabs.datacheck.data.db.AppUsageRow
import com.drelabs.datacheck.data.db.UsageLogDb
import com.drelabs.datacheck.util.AppLabels
import com.drelabs.datacheck.util.Format
import java.io.File
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.launch

data class DashboardData(
    val todayTotal: Long,
    val todayFg: Long,
    val lastWindowDelta: Long,
    val topAppsToday: List<AppUsageRow>,
    val daily: List<Pair<LocalDate, Long>>,
    val bundle: BundleLogic.CardState = BundleLogic.CardState.Hidden,
    val validation: Validation.CardState = Validation.CardState.Hidden,
)

@Composable
fun DashboardScreen(onOpenSettings: () -> Unit = {}) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var data by remember { mutableStateOf<DashboardData?>(null) }
    var exportFile by remember { mutableStateOf<File?>(null) }

    LaunchedEffect(Unit) {
        runCatching { backfillTick(context) }
        data = loadDashboard(context)
    }

    val powerManager = context.getSystemService(android.os.PowerManager::class.java)
    val batteryExempt = remember {
        powerManager?.isIgnoringBatteryOptimizations(context.packageName) ?: true
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .navigationBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("DataCheck", style = MaterialTheme.typography.headlineMedium)
            IconButton(onClick = onOpenSettings) {
                Icon(Icons.Filled.Settings, contentDescription = "Settings")
            }
        }
        data?.let { d ->
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), Arrangement.spacedBy(4.dp)) {
                    Text("Mobile today", style = MaterialTheme.typography.labelMedium)
                    Text(Format.bytes(d.todayTotal), style = MaterialTheme.typography.headlineLarge)
                    Text(
                        "foreground ${Format.bytes(d.todayFg)} · background ${Format.bytes(d.todayTotal - d.todayFg)}",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    if (d.lastWindowDelta > 0) {
                        Text(
                            "+${Format.bytes(d.lastWindowDelta)} in last window",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }

            when (val b = d.bundle) {
                BundleLogic.CardState.Hidden -> {}
                is BundleLogic.CardState.Values -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), Arrangement.spacedBy(6.dp)) {
                            Row(
                                Modifier.fillMaxWidth(),
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                Text("Bundle", style = MaterialTheme.typography.labelMedium)
                                Text("${(b.pct * 100).toInt()}%", style = MaterialTheme.typography.labelMedium)
                            }
                            LinearProgressIndicator(
                                progress = { b.pct },
                                modifier = Modifier.fillMaxWidth(),
                            )
                            Text(
                                "${Format.bytes(b.usedBytes)} used since you saved · " +
                                    "${Format.bytes(b.leftBytes)} left · " +
                                    "${b.daysLeft}d to renewal",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }

            when (val v = d.validation) {
                Validation.CardState.Hidden -> {}
                Validation.CardState.Error -> {
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), Arrangement.spacedBy(4.dp)) {
                            Text("Validation", style = MaterialTheme.typography.labelMedium)
                            Text(
                                "Couldn't read NSM raw total — check usage access and reopen.",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }

                is Validation.CardState.Values -> {
                    val deltaText = if (v.deltaBytes < 0) {
                        "-${Format.bytes(-v.deltaBytes)}"
                    } else {
                        Format.bytes(v.deltaBytes)
                    }
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(Modifier.padding(16.dp), Arrangement.spacedBy(4.dp)) {
                            Text("Validation", style = MaterialTheme.typography.labelMedium)
                            Text(
                                "NSM raw today ${Format.bytes(v.nsmRawTodayBytes)}",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                "Logged today ${Format.bytes(v.loggedTodayBytes)}",
                                style = MaterialTheme.typography.bodyMedium,
                            )
                            Text(
                                "Delta $deltaText",
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }

            SectionTitle("Top apps today")
            d.topAppsToday.forEach { app ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Column {
                        Text(
                            AppLabels.label(context, app.pkg),
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        Text(
                            "fg ${Format.bytes(app.fgTotal)} · bg ${Format.bytes(app.total - app.fgTotal)}",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                    Text(Format.bytes(app.total), style = MaterialTheme.typography.titleSmall)
                }
                HorizontalDivider()
            }

            SectionTitle("Last 7 days")
            d.daily.forEach { (day, total) ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(vertical = 4.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(day.toString(), style = MaterialTheme.typography.bodyMedium)
                    Text(Format.bytes(total), style = MaterialTheme.typography.bodyMedium)
                }
            }
        } ?: Text("Waiting for first tick…", style = MaterialTheme.typography.bodyMedium)

        if (!batteryExempt) {
            Card(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.padding(16.dp), Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Battery saver may delay background pings.",
                        style = MaterialTheme.typography.bodySmall,
                    )
                    Button(
                        onClick = {
                            context.startActivity(
                                Intent(android.provider.Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS),
                            )
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Unrestrict DataCheck")
                    }
                }
            }
        }

        Button(
            onClick = {
                scope.launch { exportFile = CsvExporter.export(context) }
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Export CSV")
        }
        exportFile?.let { f ->
            Button(onClick = { share(context, f) }, modifier = Modifier.fillMaxWidth()) {
                Text("Share ${f.name}")
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
}

private fun share(context: Context, file: File) {
    val uri = CsvExporter.shareUri(context, file)
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "text/csv"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "Share CSV"))
}

private suspend fun backfillTick(context: Context) {
    val now = System.currentTimeMillis()
    val last = UsageLogDb.get(context).usageLogDao().latestEndMs() ?: 0L
    if (last == 0L || now - last >= 10 * 60_000L) {
        com.drelabs.datacheck.data.SamplingEngine(context).runTick(now)
    }
}

private suspend fun loadDashboard(context: Context): DashboardData {
    val dao = UsageLogDb.get(context).usageLogDao()
    val prefs = Prefs(context)
    val zone = ZoneId.systemDefault()
    val today = LocalDate.now(zone)
    val midnight = today.atStartOfDay(zone).toInstant().toEpochMilli()
    val weekAgo = today.minusDays(6).atStartOfDay(zone).toInstant().toEpochMilli()

    val totals = dao.totalsSince(midnight)
    val daily = dao.dailySince(weekAgo)
        .groupBy { Instant.ofEpochMilli(it.tickStart).atZone(zone).toLocalDate() }
        .map { (day, rows) -> day to rows.sumOf { it.total } }
        .sortedBy { it.first }

    val entryAtMs = prefs.bundleEntryAtMs
    val usedSinceEntry = if (entryAtMs > 0) {
        dao.totalsSince(entryAtMs)?.total ?: 0L
    } else {
        0L
    }
    val bundle = BundleLogic.buildState(
        bundleBytes = prefs.bundleBytes,
        entryAtMs = entryAtMs,
        usedSinceEntryBytes = usedSinceEntry,
        nowMs = System.currentTimeMillis(),
        today = today,
        renewalDay = prefs.bundleRenewalDay,
    )

    val validation = if (prefs.showValidationCard) {
        Validation.buildState(
            toggleEnabled = true,
            nsmRawTodayBytes = com.drelabs.datacheck.data.SamplingEngine(context)
                .rawMobileTotalTodayBytes(),
            loggedTodayBytes = totals?.total ?: 0L,
        )
    } else {
        Validation.CardState.Hidden
    }

    return DashboardData(
        todayTotal = totals?.total ?: 0L,
        todayFg = totals?.fgTotal ?: 0L,
        lastWindowDelta = dao.latestTickTotal()?.total ?: 0L,
        topAppsToday = dao.topAppsSince(midnight, 10),
        daily = daily,
        bundle = bundle,
        validation = validation,
    )
}
