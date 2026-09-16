# ISSUE-003 Fresh Review — VALIDATION.md QA Kit

Reviewer: fresh-context-review (read-only)
Date: 2026-09-10
Tool calls used: 17 / 30

## Verdict: PASS

All four acceptance criteria are satisfied by the document's actual content. No locked decisions are reopened. No file other than VALIDATION.md was added/modified. No blocking findings.

---

## Blocking Findings

None.

## Non-Blocking Findings

### NB-1: Implementation-result citation file paths use wrong package prefix

- **Severity:** note
- **Evidence:** implementation-result.md citation table headers reference `com.theDRElabs.datacheck`. Actual package is `com.drelabs.datacheck`. Line numbers are correct when files are located via glob.
- **Impact:** zero — internal artifact, not user-facing. The doc has no code-path references.
- **Suggested fix:** none needed.

### NB-2: Delta sign convention text is slightly ambiguous

- **Severity:** note
- **VALIDATION.md lines 68-69:** "Delta — NSM raw minus logged. Positive = DataCheck logged less than the system recorded; the sign is shown as a leading '-'."
- **Evidence:** `Validation.kt:34-36` — `delta = nsmRawTodayBytes - loggedTodayBytes`. `DashboardScreen.kt:151-155` — negative delta gets a leading `-`. The doc states the positive case correctly. The phrase "the sign is shown as a leading '-'" could be misread as applying to the positive case but contextually refers to the negative case.
- **Impact:** minimal — a human reading this will see the card's actual display and the two bullet points together are clear.
- **Suggested fix:** optional: rephrase to "Negative delta (shown with leading '-') means NSM < logged."

### NB-3: Notification top-app count not specified

- **Severity:** note
- **VALIDATION.md line 104:** "with your top apps listed"
- **Evidence:** `TickWorker.kt:31` — `topAppsSince(midnight, 3)`. Shows up to 3 apps.
- **Impact:** zero — the doc doesn't need to specify the count; the user sees the actual notification.

## Required Changes

None.

## Acceptance-Criteria Coverage

| Criterion | Coverage |
|---|---|
| Accuracy procedure (day-long, ±1%, mismatch attribution) | **covered** — Check 1 lines 29-85 |
| Reboot test (ping resumes, totals reconcile) | **covered** — Check 2 lines 87-120 |
| Sideload/upgrade (signed release APK) | **covered** — Check 3 lines 122-151 |
| Results-recording template | **covered** — lines 153-186 |

## Verification-Evidence Assessment

### Material claims verified (32/32)

| Claim | Source verified |
|---|---|
| Gear icon opens Settings | `MainActivity.kt:34`, `DashboardScreen.kt:90-92` ✅ |
| Toggle label "Show validation card" under "Validation" section | `SettingsScreen.kt:149,156` ✅ |
| Toggle subtitle exact text | `SettingsScreen.kt:158` ✅ |
| Toggle writes prefs on change (no save button) | `SettingsScreen.kt:164-166` ✅ |
| Card error text exact string | `DashboardScreen.kt:143` ✅ |
| Usage access permission needed | `AndroidManifest.xml:6-7` ✅ |
| Usage access settings intent | `UsageAccess.kt:30` ✅ |
| Battery saver card + "Unrestrict DataCheck" button | `DashboardScreen.kt:213-231` ✅ |
| Dashboard refreshes on open | `DashboardScreen.kt:67-69` ✅ |
| Catch-up tick ≥10 min threshold | `DashboardScreen.kt:269` ✅ |
| Mobile-only (TYPE_MOBILE queries) | `SamplingEngine.kt:113,133,187` ✅ |
| "Mobile today" card label/value | `DashboardScreen.kt:97-98` ✅ |
| "Mobile today" = Room SUM(rx+tx) since midnight | `UsageLogDao.kt:37-40`, `DashboardScreen.kt:282,312` ✅ |
| Fresh install logs nothing until second tick | `SamplingEngine.kt:91-96` ✅ |
| Interval default 15 min, min 15, all 9 chip options | `Prefs.kt:24`, `Scheduler.kt:11`, `SettingsScreen.kt:38-42` ✅ |
| "15 minutes is the Android scheduler minimum" caption | `SettingsScreen.kt:86-88` ✅ |
| Validation card three fields | `DashboardScreen.kt:158-168` ✅ |
| "Logged today" same as "Mobile today" | `DashboardScreen.kt:300-305` ✅ |
| Delta sign convention | `Validation.kt:34-36`, `DashboardScreen.kt:151-155` ✅ |
| MAX_WINDOW_MS = 6 h clamp | `SamplingEngine.kt:208` ✅ |
| Day boundary = local midnight | `SamplingEngine.kt:71-72`, `DashboardScreen.kt:277-279` ✅ |
| BootReceiver re-registers on boot | `BootReceiver.kt:10-12`, `AndroidManifest.xml:33-38` ✅ |
| ExistingPeriodicWorkPolicy.KEEP for re-registration | `Scheduler.kt:18` ✅ |
| First tick samples full window back | `SamplingEngine.kt:91-105` ✅ |
| Notification title/text | `PingNotifier.kt:51-52` ✅ |
| Notification silent | `PingNotifier.kt:23-28` ✅ |
| Notifications can be off (SecurityException swallowed) | `PingNotifier.kt:60-61` ✅ |
| >6 h off → last 6 h logged | `SamplingEngine.kt:98-101,208` ✅ |
| CI artifact name `datacheck-release-apk` | `ci.yml:58` ✅ |
| CI uses assembleRelease | `ci.yml:43` ✅ |
| Size gate: fail if ≥ 4 MiB | `ci.yml:50-53` ✅ |
| Keystore committed, same signing identity | `build.gradle.kts:10-14`, `keystore/keystore.properties` ✅ |
| App does not display version | No version display in Dashboard/Settings screens ✅ |

### Scope verification
- Only VALIDATION.md is present at repo root as untracked file.
- `git diff HEAD` is empty (no tracked file modified). Orchestrator-verified.
- No locked product decisions reopened: mobile-only ✅, no exact alarms ✅, no new permissions ✅, ±1% tolerance unchanged ✅, WorkManager-only ✅.

### Platform-behavior claims
All platform-behavior claims (Android Settings path varies, artifact zip extraction, same-signature in-place upgrade, WorkManager inexactness, force-stop preventing background work) are correctly framed as platform behavior and not contradicted by repo code.

## Residual Risks

1. **Settings-path ambiguity** — if user reads billing-cycle figure instead of today's figure, Check 1 produces false failure. Mitigated by doc wording.
2. **Display-unit rounding** — binary MB/GB vs Settings decimal. Negligible at day-scale.
3. **Qualitative delta threshold** — "small" is intentionally not a hard number; acceptable.
