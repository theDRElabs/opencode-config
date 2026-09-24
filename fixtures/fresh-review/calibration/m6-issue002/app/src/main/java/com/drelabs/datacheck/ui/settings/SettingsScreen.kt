package com.drelabs.datacheck.ui.settings

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import com.drelabs.datacheck.data.Prefs
import com.drelabs.datacheck.work.Scheduler

private val INTERVAL_OPTIONS = listOf(
    15 to "15m", 30 to "30m", 45 to "45m",
    60 to "1h", 120 to "2h", 180 to "3h",
    360 to "6h", 720 to "12h", 1440 to "24h",
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onBack: () -> Unit) {
    val context = LocalContext.current
    val prefs = remember { Prefs(context) }
    var interval by remember { mutableStateOf(prefs.pingIntervalMinutes) }
    var sizeText by remember { mutableStateOf(initialSizeText(prefs.bundleBytes)) }
    var unitIsGb by remember { mutableStateOf(prefs.bundleBytes == 0L || prefs.bundleBytes >= (1L shl 30)) }
    var renewalDay by remember { mutableStateOf(prefs.bundleRenewalDay.toString()) }
    var saved by remember { mutableStateOf(false) }
    var showValidation by remember { mutableStateOf(prefs.showValidationCard) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "Back")
            }
            Text("Settings", style = MaterialTheme.typography.headlineSmall)
        }

        Text("Ping interval", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        INTERVAL_OPTIONS.chunked(3).forEach { rowOptions ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                rowOptions.forEach { (minutes, label) ->
                    FilterChip(
                        selected = interval == minutes,
                        onClick = {
                            interval = minutes
                            Scheduler.updateInterval(context, minutes)
                            saved = false
                        },
                        label = { Text(label) },
                    )
                }
            }
        }
        Text(
            "15 minutes is the Android scheduler minimum; shorter pings aren't possible.",
            style = MaterialTheme.typography.bodySmall,
        )

        HorizontalDivider()

        Text("Data bundle", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        OutlinedTextField(
            value = sizeText,
            onValueChange = { sizeText = it },
            label = { Text("Bundle size") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(
                selected = unitIsGb,
                onClick = { unitIsGb = true },
                label = { Text("GB") },
            )
            FilterChip(
                selected = !unitIsGb,
                onClick = { unitIsGb = false },
                label = { Text("MB") },
            )
        }
        OutlinedTextField(
            value = renewalDay,
            onValueChange = { renewalDay = it.filter { c -> c.isDigit() }.take(2) },
            label = { Text("Renewal day of month (1-28)") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
        )
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                val size = sizeText.toDoubleOrNull()
                prefs.bundleBytes = if (size != null && size > 0) {
                    (size * if (unitIsGb) 1073741824.0 else 1048576.0).toLong()
                } else {
                    0L
                }
                prefs.bundleRenewalDay = renewalDay.toIntOrNull()?.coerceIn(1, 28) ?: 1
                saved = true
            }) {
                Text("Save")
            }
            if (prefs.bundleBytes > 0) {
                TextButton(onClick = {
                    prefs.bundleBytes = 0L
                    sizeText = ""
                    saved = true
                }) {
                    Text("Clear")
                }
            }
        }
        if (saved) {
            Text("Saved", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.primary)
        }

        HorizontalDivider()

        Text("Validation", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.primary)
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column {
                Text("Show validation card", style = MaterialTheme.typography.bodyMedium)
                Text(
                    "Dashboard card comparing NSM raw total with logged ticks.",
                    style = MaterialTheme.typography.bodySmall,
                )
            }
            Switch(
                checked = showValidation,
                onCheckedChange = {
                    showValidation = it
                    prefs.showValidationCard = it
                },
            )
        }
    }
}

private fun initialSizeText(bytes: Long): String = when {
    bytes >= (1L shl 30) -> String.format("%.1f", bytes / 1073741824.0)
    bytes > 0 -> String.format("%.0f", bytes / 1048576.0)
    else -> ""
}
