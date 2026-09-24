# ISSUE-002 Input Manifest — attempt 1 (TWO-PUSH TDD via CI)

## Issue (from docs/BACKLOG-M6.md)

ISSUE-002: Add in-app validation card for accuracy attribution
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: with a Settings toggle enabled, the dashboard shows a card comparing
  "NSM raw total today" vs "sum of logged ticks" plus the delta, so a mismatch
  vs Android Settings is attributable (our sampling vs system-level)
ACCEPTANCE:
- Card is hidden unless its persisted Settings toggle is enabled
- Card shows NSM raw mobile total today, sum of logged tick rows today, and
  the delta (human-readable units)
- Card renders a visible error state when the NSM query fails
- Comparison/delta logic is unit-tested (TDD: red before implementation)
- UI makes no direct NetworkStatsManager/UsageStatsManager calls; new query
  goes through the sampling engine
LAYERS: data+ui
MODULES: sampling engine gains a raw-today-total query; SettingsScreen gains
  the toggle; DashboardScreen gains the card; exact names follow existing
  conventions
TESTS: unit tests for delta computation and toggle-gated visibility logic
COMMANDS: CI only — `testDebugUnitTest` + `lint` via the existing workflow
  (no local builds)
CONSTRAINTS: no Room schema changes; no new permissions; card is read-only
  diagnostics and never mutates stored rows; locked decisions unchanged
NON-GOALS: full diagnostics screen, manual entry of the Settings figure,
  CSV-based comparison tooling

## Repo facts (verified by orchestrator)

- Repo: /home/ubuntu/projects/data-check, branch main, base commit fdc792b
  (CI green at this commit: run 34481250613, both jobs).
- Working tree: only untracked docs/ (PRD/backlog — DO NOT TOUCH).
- Key sources (read them first, follow their conventions exactly):
  - data/SamplingEngine.kt — all NSM/USM access lives here
  - data/Prefs.kt — persisted settings (ping interval, bundle tracker)
  - data/db/UsageLogDao.kt, UsageEntity.kt, TickEntity.kt — Room log
  - ui/dashboard/DashboardScreen.kt — today totals + top apps UI
  - ui/settings/SettingsScreen.kt — existing settings UI patterns + toggle UI
  - work/TickWorker.kt — how the engine is invoked per tick
  - util/Format.kt — byte formatting helpers (reuse, do not duplicate)
- Existing test: app/src/test/java/com/drelabs/datacheck/AttributionTest.kt
  (JUnit; follow its conventions for the new tests).
- Full paths under app/src/main/java/com/drelabs/datacheck/ and
  app/src/test/java/com/drelabs/datacheck/.

## Environment facts (verified by orchestrator)

- NO local JDK/SDK. Never run gradle/java locally. Unit tests execute ONLY on
  GitHub Actions (the `build` job runs assembleDebug testDebugUnitTest lint).
- You CANNOT observe red/green yourself. The orchestrator pushes and watches
  CI between your two phases. Design your RED phase accordingly (below).

## TWO-PUSH TDD protocol (user-approved)

You work in two phases; the orchestrator handles commits/pushes/CI between them.

### PHASE 1 — RED (this call)
1. Read the sources listed above.
2. Design the minimal testable core:
   - A pure logic unit (suggested new file data/Validation.kt, or follow
     whatever convention fits — e.g. a ValidationUiState builder +
     delta computation as pure functions) covering:
       a) delta computation from (nsmRawTodayBytes, loggedTodayBytes)
       b) state building: hidden when toggle disabled; error state when NSM
          query failed/unavailable; values + delta otherwise
3. Write the unit test file(s) FIRST (e.g. ValidationLogicTest.kt) following
   AttributionTest.kt conventions, covering at minimum:
   - delta computation: normal case, zero vs zero, raw > logged, logged >
     raw (sign), and a large-values case (GB range, Long overflow safety)
   - state building: toggle off -> hidden; toggle on + NSM failure -> error
     state; toggle on + both values -> shows both + delta
4. Create MINIMAL COMPILABLE STUBS for the production logic so the test file
   compiles under assembleDebug, but the stubs return deliberately WRONG
   values (e.g. delta always 0, state always hidden) so the tests FAIL at
   runtime, not at compile time. This is the red contract: CI must compile
   and then fail testDebugUnitTest with your new tests failing.
5. Do NOT wire any UI in phase 1. Do NOT touch SettingsScreen/
   DashboardScreen/Prefs yet (that is phase 2). Phase 1 touches ONLY:
   - new pure-logic file(s) under data/ (stubs)
   - new test file(s) under app/src/test/
6. Record for the orchestrator: exact list of files created, and which test
   methods are expected to fail and why (expected vs stub value).

### PHASE 2 — GREEN (orchestrator resumes you after CI red is confirmed)
1. Replace stubs with real implementations (same signatures — tests unchanged).
2. Wire the feature end to end following existing patterns:
   - Prefs: add persisted boolean for the validation card toggle
   - SettingsScreen: toggle UI (follow existing settings-row patterns)
   - SamplingEngine: add a raw-mobile-total-today query (all UIDs, MOBILE,
     today window). UI never calls NSM directly — the card gets data via the
     engine, following how DashboardScreen/TickWorker already obtain data.
   - DashboardScreen: validation card (visible only when toggle on; NSM raw
     total, logged-ticks sum, delta via util/Format.kt helpers; visible error
     state when the engine query fails). Read-only: never writes rows.
   - If UsageLogDao lacks a today-sum query, you MAY add a @Query method
     (no entity/schema changes, no migration).
3. Everything must stay inside: data/ (SamplingEngine, Prefs, new Validation
   file, UsageLogDao query only), ui/ (SettingsScreen, DashboardScreen),
   app/src/test/. If you believe another file must change, STOP and report
   instead.

## Hard constraints (both phases)

- No Room schema/entity changes; no new dependencies, permissions, manifest
  edits, build-file edits, or gradle.properties changes.
- No direct NetworkStatsManager/UsageStatsManager/TrafficStats calls in ui/.
- Card logic is read-only diagnostics; never mutates stored rows.
- Do NOT git commit/push/stage anything.
- Do NOT touch docs/, keystore/, .github/, build files.
- Mobile data only (ConnectivityManager.TYPE_MOBILE / NETWORK_TYPE_MOBILE
  as the existing engine does — follow its pattern).

## Checks to run and record (structural, local)

Phase 1: grep evidence that tests reference the new logic; stub files compile
plausibility (imports consistent, signatures match); scope check via
git status (only the two new file groups).
Phase 2: grep evidence for all five acceptance criteria; scope check via
git status/diff (allowed files only); confirm test files unchanged from
phase 1 except if a test had a defect (then document why).

## Deliverables

Append to /home/ubuntu/.config/opencode/runs/data-check/M6/ISSUE-002/attempt-1/:
- phase1-result.md (phase 1): files created, expected-failing test list with
  expected-vs-stub values, structural check evidence.
- phase2-result.md (phase 2): files changed, decisions (where the engine
  query lives, how the card fetches state), structural check evidence per
  acceptance criterion, risks.

Return per phase: compact summary as specified in each phase above.
