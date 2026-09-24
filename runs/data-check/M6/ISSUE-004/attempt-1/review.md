# ISSUE-004 — Fresh-Independent Review

**Reviewer context:** fresh-context-review (read-only). 30 tool calls used. Read all 13 cited source files plus 5 supporting files (Prefs, Validation, Scheduler, BootReceiver, UsageLogDb, ExportRow). Verified every file:line citation against actual code. Checked for false negatives across all 9 required modules. Verified "not findings" section.

---

## VERDICT: PASS

**Blocking findings: 0. Non-blocking findings: 2. Notes: 0.**

---

## Per-Finding Verification Table

| F-ID | Citation Verified? | Claim Verified? | Severity Defensible? | Notes |
|------|-------------------|-----------------|---------------------|-------|
| F-01 | ✅ | ✅ | ✅ | `UsageLogDao.kt:10` — `TotalsRow(val total: Long, val fgTotal: Long)` matches quoted non-null Longs. `UsageLogDao.kt:37-40` — query and nullable return type match. Callers at `TickWorker.kt:29` and `DashboardScreen.kt:282` confirmed. Room 2.6.1 at `build.gradle.kts:72-74` confirmed. Known Room pitfall: SUM() without GROUP BY returns one row of NULLs; Room maps NULL→non-null Long before the nullable return type helps. Honest caveat about needing runtime test. |
| F-02 | ✅ | ✅ | ✅ | `UsageLogDao.kt:38` — `WHERE tickStart >= :sinceMs` confirmed. `SamplingEngine.kt:72` — midnight math confirmed. The claim that tickStart for a [23:50, 00:05) window is yesterday is correct: `resolveWindowStart` returns the previous tick's `endMs` as `tickStart`. Mid-morning delta between NSM raw (true midnight) and logged (tickStart-based) is a real accuracy gap. |
| F-03 | ✅ | ✅ | ✅ | `UsageLogDao.kt:62-66` — `deleteTicksBefore` uses `endMs < cutoffMs`, `deleteUsageBefore` uses `tickStart < cutoffMs`. Confirmed: for a tick spanning the cutoff (`tickStart < cutoff ≤ endMs`), usage rows deleted but tick survives. Transaction at lines 68-72 makes both deletes atomic but doesn't fix the predicate mismatch. Suggested fix (delete usage via tick subquery) is correct and minimal. |
| F-04 | ✅ | ✅ | ✅ | `SamplingEngine.kt:91-104` — resolveWindowStart reads pref without lock. `DashboardScreen.kt:265-271` — backfillTick runs from LaunchedEffect (Main), concurrent with WorkManager. `SamplingEngine.kt:85-87` — DB insert before pref write. `UsageLogDao.kt:28` — `latestEndMs()` grep confirms 1 match (declaration only, dead code). No mutex anywhere (grep for `withContext` and `Dispatchers` returned 0 results). Race and crash-after-commit double-count are real. |
| F-05 | ✅ | ✅ | ✅ | `SamplingEngine.kt:122-126` — catch-all returning emptyMap() confirmed. `:135-137` — queryDeviceTotal catch returning null confirmed. `:161-163` — foregroundFractions catch returning emptyMap() confirmed. `:98-101` — MAX_WINDOW_MS clamp confirmed. `Prefs.kt:42` — `showValidationCard` default `false` confirmed. The only error surface is off by default; silent failures are real. |
| F-06 | ✅ | ✅ | ✅ | `DashboardScreen.kt:67-69` — LaunchedEffect runs on Main, calls backfillTick + loadDashboard. `:265-271` — backfillTick calls SamplingEngine.runTick (blocking NSM). `:236` — `scope.launch` uses `Dispatchers.Main` (from `rememberCoroutineScope`). `CsvExporter.kt:21-24` — `bufferedWriter().use { ... }` is blocking file I/O on Main. No `withContext(Dispatchers.IO)` anywhere in the codebase (grep confirmed 0 matches). Main-thread blocking is real. |
| F-07 | ✅ | ✅ | ✅ | `PingNotifier.kt:58-61` — `catch (_: SecurityException) { }` confirmed (empty catch). `OnboardingScreen.kt:29-31` — `areNotificationsEnabled()` checked at composition only. No re-check in DashboardScreen (battery card at `:213-231` shows the pattern that's missing). Permission requested exactly once at onboarding. Silent product failure is real. |
| F-08 | ✅ | ✅ | ✅ | `TickWorker.kt:14-21` — `catch (t: Throwable)` confirmed. CancellationException is a Throwable, so it's caught. `Result.success()` on final attempt confirmed at line 20. Standard CoroutineWorker anti-pattern. LOW severity appropriate — periodic work will retry on next period. |
| F-09 | ✅ | ✅ | ✅ | `AppLabels.kt:6` — `HashMap<String, String>()` confirmed (not ConcurrentHashMap). `:16` read and `:20` write confirmed. Cross-thread access from WorkManager (Default) and Compose (Main) confirmed. Data race is real but LOW severity appropriate — worst case is duplicate label resolution. |
| F-10 | ✅ | ✅ | ✅ | `CsvExporter.kt:18-20` — timestamped filename, no cleanup code confirmed. Each export creates a new file in `filesDir/exports`. Unbounded growth is real but LOW severity. |
| F-11 | ✅ | ✅ | ✅ | `MainActivity.kt:25` — `remember { mutableStateOf(false) }` confirmed (not `rememberSaveable`, not persisted to Prefs). `:37` — `onDone = { onboarded = true }` sets in-memory only. Lost on process death/cold start. LOW severity appropriate. |
| F-12 | ✅ | ✅ | ✅ | `DashboardScreen.kt:314` — `dao.latestTickTotal()?.total ?: 0L` confirmed. `:103-108` — rendered unconditionally when delta > 0. `UsageLogDao.kt:48-53` — `latestTickTotal()` uses `MAX(endMs)` regardless of age. Stale window display is real but LOW severity. |
| F-13 | ✅ | ✅ | ✅ | Grep for `autostart\|AUTO_START\|Startup` across all `.kt` files: 0 matches. F-13's claim about PROJECT.md promising this screen is grounded (verified the absence in code). LOW severity appropriate — missing feature, not a regression. |

**Verified: 13/13**

---

## False-Negative Check

Skimmed all 9 required modules plus SettingsScreen.kt, UsageLogDb.kt, ExportRow.kt, and Prefs.kt for material issues the review might have missed.

**No material misses found.** SettingsScreen.kt is straightforward UI (interval picker, bundle config, validation toggle) with no threading, error handling, or data integrity concerns beyond what's already covered. UsageLogDb.kt is a standard singleton Room database setup. The review's coverage is comprehensive for the scope.

---

## "Not Findings" Section Verification

The "not findings" section correctly:
- Excludes locked constraints (WorkManager-only, mobile-only, 4 permissions, Room v1 schema, etc.)
- Identifies `rebootPending` as write-only by design (grep confirms exactly 3 occurrences: declaration, BootReceiver write, SamplingEngine clear — matches the doc)
- Identifies the USM fallback as documented intent (PROJECT.md, AGENTS.md)
- Does NOT disguise any real bug as a locked constraint
- The 6h window clamp's invisibility is correctly reported via F-05; the clamp itself is correctly excluded

---

## Non-Blocking Findings (suggested corrections)

**NB-1 — F-04 suggested fix omits thread safety for the Mutex**

The finding suggests taking an "app-scoped Mutex" but doesn't specify where it lives. Since `SamplingEngine` is instantiated per-call (`SamplingEngine(context)` at `TickWorker.kt:15` and `DashboardScreen.kt:270`), a per-instance Mutex won't serialize anything. The Mutex must be a companion-level or singleton-level lock. Suggested correction: explicitly note the Mutex must live in a companion object or the Application class, not in the SamplingEngine constructor.

**NB-2 — F-05 overstates the dashboard as the "only error surface"**

The finding says the validation card is "the only error surface" for NSM failures, but `loadDashboard` at `DashboardScreen.kt:282` calls `totalsSince(midnight)` — if F-01's suspected crash is real, the app would crash before showing any error state. This is internally consistent (F-01 and F-05 are related) but the finding could note that F-01's crash would mask F-05's silent failure in the specific empty-table case. Not a blocking issue — just a cross-reference worth noting during triage.

---

## Verdict Summary

- **PASS** — no blocking issues
- **Blocking: 0** (no fabricated citations, no materially false claims, no locked decisions reported as findings, no code changes detected)
- **Non-blocking: 2** (minor clarification suggestions for F-04 and F-05)
- **Verified: 13/13**

The findings document is well-structured, technically grounded, and honest about its verification limits. Every citation matches the actual source code. Every technical claim holds up against the code. Severity assignments are defensible. Suggested fixes are concrete, minimal, and respect all locked constraints.
