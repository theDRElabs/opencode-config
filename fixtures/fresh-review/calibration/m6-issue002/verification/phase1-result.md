# ISSUE-002 — Phase 1 (RED) Result — attempt 1

Executed: 2026-09-10. Phase 1 only: tests first + minimal compilable stubs with
deliberately wrong values. No UI wiring, no edits to existing files, no git
operations.

## Files created (2, untracked — nothing staged/committed)

1. `app/src/main/java/com/drelabs/datacheck/data/Validation.kt` — new pure-logic
   stub (package `com.drelabs.datacheck.data`, follows `object Attribution`
   convention).
2. `app/src/test/java/com/drelabs/datacheck/ValidationLogicTest.kt` — new JUnit 4
   test file (follows AttributionTest.kt conventions: package
   `com.drelabs.datacheck`, backtick test names, `org.junit.Assert.assertEquals`).

## Design decisions (names/signatures — PHASE 2 MUST KEEP THESE UNCHANGED)

- `object Validation` in `data/` (mirrors `object Attribution`).
- State type: `Validation.CardState` sealed interface:
  - `data object Hidden` — toggle off, card must not render.
  - `data object Error` — toggle on but NSM raw-today query failed/unavailable.
  - `data class Values(nsmRawTodayBytes: Long, loggedTodayBytes: Long, deltaBytes: Long)`.
- `fun Validation.delta(nsmRawTodayBytes: Long, loggedTodayBytes: Long): Long`
  — positive = our log under-reports vs NSM; negative = over-reports.
  Non-negative inputs ⇒ Long subtraction cannot overflow.
- `fun Validation.buildState(toggleEnabled: Boolean, nsmRawTodayBytes: Long?, loggedTodayBytes: Long): CardState`
  — `nsmRawTodayBytes == null` means the engine's NSM query failed or is
  unavailable (mirrors SamplingEngine.queryDeviceTotal's null-on-failure
  pattern); `loggedTodayBytes == 0` when no rows today (no rows is NOT an
  error). `Values.deltaBytes` is computed inside `buildState` via `delta()`
  (single source of truth).
- Phase-2 wiring hints (not done yet): engine gains a raw-mobile-today query
  returning `Long?`; logged sum via `dao.totalsSince(midnight)?.total ?: 0L`;
  card renders `CardState` and formats bytes with existing `Format.bytes`.

## Stub behavior (deliberately wrong)

- `Validation.delta(...)` → always `0L`.
- `Validation.buildState(...)` → always `CardState.Hidden`.

## Expected CI outcome: compile OK, testDebugUnitTest fails with these 8 tests

| Test | Expected | Stub returns |
|---|---|---|
| `delta is positive when nsm raw exceeds logged` | `+500_000_000` | `0` |
| `delta is negative when logged exceeds nsm raw` | `-2_500_000` | `0` |
| `delta handles gb range values beyond int range` | `1_000_000_000` | `0` |
| `delta handles long extremes without overflow` | `Long.MAX_VALUE` | `0` |
| `toggle on with failed nsm query yields error state` | `CardState.Error` | `CardState.Hidden` |
| `toggle on with both values shows figures and delta` | `Values(3_000_000, 2_500_000, 500_000)` | `CardState.Hidden` |
| `toggle on with no logged rows shows zero logged and full delta` | `Values(5_000_000, 0, 5_000_000)` | `CardState.Hidden` |
| `toggle on with matching figures shows zero delta` | `Values(42_000, 42_000, 0)` | `CardState.Hidden` |

Expected to PASS against the stubs (3, unavoidable and intended by the
manifest's own stub design "delta always 0, state always hidden"; they become
real regression guards once phase-2 logic lands):

- `delta of zero vs zero is zero` (0 == 0)
- `toggle off hides card regardless of values` (Hidden == Hidden)
- `toggle off hides card even when nsm query failed` (Hidden == Hidden)

## Structural check evidence (local, read-only; no JDK on this device — CI is the only executor)

- Scope: `git status --porcelain` →
  `?? app/src/main/java/com/drelabs/datacheck/data/Validation.kt`,
  `?? app/src/test/java/com/drelabs/datacheck/ValidationLogicTest.kt`,
  `?? docs/` (pre-existing untracked per manifest — untouched).
- Tests reference the new logic: grep over the test file finds 17 references
  to `Validation.delta` / `Validation.buildState` / `Validation.CardState`
  (lines 13, 18, 23, 28, 33, 41–42, 53–54, 65–66, 77–82, 93–98, 109–114).
- Compile plausibility: stub declares `package com.drelabs.datacheck.data`,
  `object Validation`, `fun delta(nsmRawTodayBytes: Long, loggedTodayBytes: Long): Long`,
  `fun buildState(toggleEnabled: Boolean, nsmRawTodayBytes: Long?, loggedTodayBytes: Long): CardState`,
  `data object Hidden/Error`, `data class Values(...)` — all names/arity/param
  types match every call site in the test file (incl. `null` raw ⇒ `Long?`
  param). Kotlin 2.0.20 (root build.gradle.kts) supports `data object` and
  sealed interfaces. No Android imports in Validation.kt — pure JVM, safe for
  plain unit tests. No TODO markers, no lint-risk constructs.
- Constraints honored: no changes to SamplingEngine/Prefs/UsageLogDao/
  DashboardScreen/SettingsScreen/TickWorker; no build/manifest/gradle edits;
  no Room schema change; no new deps; nothing staged or committed.

## Commands run (all read-only, cwd /home/DRE/projects/data-check)

- `git status --porcelain` + `git log --oneline -1` → clean tree at fdc792b
  plus untracked docs/ (pre-existing) and the 2 new files.
- Grep tool searches for test→stub references and signature match (output above).
- No gradle/java invocation (no local toolchain by repo rule; `rg` binary not
  present in shell — used the Grep tool instead).

## Risks / notes for phase 2

- `delta handles long extremes without overflow` pins exact Long semantics —
  any Double-based arithmetic in phase 2 will fail it (intended).
- Tests must remain byte-identical in phase 2; only stub bodies change.
- If CI shows the 3 expected-passing tests failing instead, that indicates a
  compile/wiring issue in how the stub was integrated — investigate before
  phase 2.
