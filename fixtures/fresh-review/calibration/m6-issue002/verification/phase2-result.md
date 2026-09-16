# ISSUE-002 — Phase 2 (GREEN) Result — attempt 1

Executed: 2026-09-10. Phase 2 only: real Validation implementations (signatures
unchanged), end-to-end feature wiring. Phase 1 RED was confirmed by orchestrator
via CI run 34483016952 (8 predicted AssertionError failures, compile clean).
No git operations performed; nothing staged/committed.

## Files changed (5 modified, 0 created; scope exactly as allowed)

| File | Change |
|---|---|
| `data/Validation.kt` | Stub bodies → real logic. `delta` = raw − logged (Long subtraction; non-negative inputs ⇒ overflow-safe). `buildState` = toggle off→Hidden, null raw→Error, else `Values` with `delta()` (single source of truth). Doc header updated (removed stub note). Signatures byte-identical to phase 1. |
| `data/Prefs.kt` | `showValidationCard: Boolean` (key `show_validation_card`, default `false`, `commit()` — same pattern as all other prefs). |
| `data/SamplingEngine.kt` | Public `rawMobileTotalTodayBytes(nowMs = System.currentTimeMillis()): Long?` — computes local-midnight window via `ZoneId.systemDefault()` (same convention as DashboardScreen/TickWorker), reuses existing private `queryDeviceTotal` (TYPE_MOBILE device summary, null on failure/unavailable NSM). Read-only: no DAO writes. Imports `java.time.LocalDate`, `java.time.ZoneId`. |
| `ui/settings/SettingsScreen.kt` | New "Validation" section after Data bundle: `HorizontalDivider` + section title + label row + material3 `Switch`. Persists immediately on flip (`prefs.showValidationCard = it`), mirroring the interval-chip immediate-apply pattern. State seeded from prefs. New import: `Switch`. |
| `ui/dashboard/DashboardScreen.kt` | `DashboardData.validation: Validation.CardState = Hidden`; `loadDashboard` computes state when toggle on (engine query + `dao.totalsSince(midnight)?.total` + `Validation.buildState`), else Hidden; `when` renders card between Bundle card and "Top apps today": Values → "NSM raw today / Logged today / Delta", Error → visible message, Hidden → nothing. New import: `Validation`. |

**Not changed:** `data/db/UsageLogDao.kt` — existing `totalsSince(midnight)`
(`SUM(rx+tx) WHERE tickStart >= :sinceMs`) is exactly the logged-ticks-today
sum, same convention as the existing "Mobile today" card. No `@Query` addition
needed (manifest allowed one only "if the existing queries don't suffice").
Test file: `git diff HEAD -- ValidationLogicTest.kt` → 0 lines (byte-identical
to phase 1; no test defects found, so no test edits).

## Key wiring decisions

- **How the card fetches state:** computed inside `loadDashboard(context)`
  (private suspend fun), called by the existing `LaunchedEffect(Unit)` AFTER
  `backfillTick` — so the logged sum includes the just-written backfill rows
  and both figures reflect the same dashboard load. Snapshot-in-time, like the
  rest of the dashboard.
- **Engine owns "today":** `rawMobileTotalTodayBytes` computes the local
  midnight→now window itself (mirrors engine's `runTick(nowMs)` default-param
  style), so callers can't get the window wrong. Reuses `queryDeviceTotal`
  (null-on-failure), so the existing error semantics propagate as `Long?`.
- **NSM query is skipped entirely when the toggle is off** (`if
  (prefs.showValidationCard)` guard) — Hidden without paying a binder call;
  `buildState(toggleEnabled = true, …)` still owns the state machine.
- **How the toggle persists:** SharedPreferences via `Prefs.showValidationCard`
  (`commit()`, like every existing setter). MainActivity swaps
  DashboardScreen/SettingsScreen in/out of composition (plain conditional), so
  on back-navigation `LaunchedEffect(Unit)` re-runs and the card
  appears/disappears immediately — no MainActivity change needed.
- **Negative delta display:** `Format.bytes` returns `"?"` for negative
  values, so the card renders sign separately: `deltaText = if (deltaBytes < 0)
  "-${Format.bytes(-deltaBytes)}" else Format.bytes(deltaBytes)`. Negation is
  overflow-safe because delta ∈ [−logged, raw] with non-negative inputs.
- **Engine reference style:** fully-qualified
  `com.drelabs.datacheck.data.SamplingEngine(context)` in `loadDashboard`,
  matching the existing `backfillTick` pattern.

## Structural evidence per acceptance criterion

1. **Card hidden unless persisted toggle enabled** — `Prefs.kt:41-45`
   (default false); `DashboardScreen.kt:300` `if (prefs.showValidationCard)`
   else `CardState.Hidden`; `DashboardScreen.kt:137` `Hidden -> {}` renders
   nothing; `SettingsScreen.kt:54,166` read/write the persisted toggle.
2. **Shows NSM raw total today, logged-ticks sum today, delta (human-readable)**
   — `DashboardScreen.kt:160` `"NSM raw today ${Format.bytes(...)}"`,
   `:164` `"Logged today ${Format.bytes(...)}"`, `:168` `"Delta $deltaText"`
   (negative-safe formatting); logged sum from `dao.totalsSince(midnight)`
   (`:305`), same convention as the existing today card. No duplicated
   formatting (only `Format.bytes` reused).
3. **Visible error state when the NSM query fails** —
   `SamplingEngine.kt:70-75` returns `Long?` (null via `queryDeviceTotal`'s
   catch-all/unavailable-service path); `Validation.kt:50` null → `Error`;
   `DashboardScreen.kt:138-148` renders a Card with "Couldn't read NSM raw
   total — check usage access and reopen."
4. **Comparison/delta logic unit-tested (TDD red before green)** — RED
   confirmed on CI run 34483016952 (8 failures, AssertionError, compile
   clean). Real implementation now: `Validation.kt:38-40` (`raw − logged`)
   and `:48-56` (state machine). Tests byte-identical (0-line diff vs HEAD).
5. **UI makes no direct NSM/USM calls; query goes through the engine** —
   grep `NetworkStatsManager|UsageStatsManager|TrafficStats` across the whole
   `ui/` tree → **no matches**; the only stats call is
   `DashboardScreen.kt:303-304` →
   `SamplingEngine(context).rawMobileTotalTodayBytes()`. Complies with the
   repo rule "All stats logic goes through one sampling engine".

## Scope / constraint evidence

- `git status --porcelain` → exactly the 5 allowed files modified + pre-existing
  untracked `docs/` (untouched). `git diff --name-only HEAD` lists only those
  5. No manifest/build/gradle/.github/keystore/docs changes; no new
  dependencies/permissions; no Room schema/entity/DAO changes.
- Read-only diagnostics: the validation path performs zero DAO writes/deletes
  (`rawMobileTotalTodayBytes` queries NSM only; card renders
  `Validation.CardState`). Pre-existing `backfillTick` mutation is unchanged
  dashboard behavior, not part of the validation path.
- No local gradle/java execution (no toolchain on this device by repo rule);
  CI (`assembleDebug testDebugUnitTest lint`) is the sole executor —
  orchestrator to push and watch.

## Risks

- **NSM binder call on main thread** inside `LaunchedEffect` (main
  dispatcher): identical to the pre-existing `backfillTick` path
  (`runTick` → `queryMobilePerUid` etc.), so no new class of issue; flagged
  for transparency.
- **querySummaryForDevice semantics:** device-summary buckets may be
  last-known-value snapshots on some OEMs, so "NSM raw today" can differ
  slightly from the Settings app's live figure — inherent to NSM; the card is
  diagnostics, tolerance judgment stays human (±1% per repo workflow).
- **Day-flip edge:** `loadDashboard`'s midnight and the engine's midnight are
  computed microseconds apart; a day rollover exactly between them could pair
  old-day logged rows with new-day raw. Astronomically rare, same class as
  existing dashboard queries.
- **Card refresh cadence:** state is a point-in-time snapshot per dashboard
  (re)composition — it does not live-update while the screen sits open;
  consistent with every other dashboard figure.
- **Human QA still required** (per harness contract): toggle on/off roundtrip,
  card visibility vs Settings figure comparison on a real device — CI green
  proves logic, not product behavior.
