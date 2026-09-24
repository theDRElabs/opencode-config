# ISSUE-002 Fresh-Context Review — attempt 1

Reviewer: fresh context, independent of producer/orchestrator. Read-only. All
claims below verified against the supplied artifacts and the post-change
source at /home/ubuntu/projects/data-check (HEAD = c42d5a0). (Reviewer context
had no file-write tool; persisted verbatim by the orchestrator.)

## 1. Verdict

**PASS** — zero blocking findings. All five acceptance criteria are implemented
with verifiable file:line evidence; scope is exactly the six allowed files;
the TDD red/green chain is genuine (including the c42d5a0 test fix, whose
arithmetic I recomputed independently); no locked constraint is violated; no
new class of silent failure exists.

## 2. Blocking Findings

None.

## 3. Non-Blocking Findings

**NB-1 (low) — Stale evidence claim in phase-2 self-report.**
- `path:line`: `runs/.../phase2-result.md:22-23` vs `runs/.../commits.txt:1`
  and `app/src/test/java/com/drelabs/datacheck/ValidationLogicTest.kt:28`
- Issue: phase2-result.md asserts the test file is "byte-identical to phase 1;
  no test defects found", but the bundle's own commit list shows c42d5a0
  ("Fix defective test operand") edited the test after phase 2.
- Impact: the phase-2 self-report cannot be relied on for test-integrity
  claims. The edit itself is legitimate: `input-manifest.md:124` explicitly
  allows a test edit "if a test had a defect (then document why)", and I
  recomputed both sides — original `8_000_000_000_000 − 7_999_999_000_000 =
  1_000_000` (1 MB) vs asserted `1_000_000_000` (1 GB), i.e. the test was
  internally defective and would fail any correct implementation; fixed
  `8_000_000_000_000 − 7_999_000_000_000 = 1_000_000_000` = asserted value.
  Expected value, test name, and intent (operands far beyond `Int.MAX_VALUE`,
  exact `Long` arithmetic) are unchanged — a defect fix, **not** a weakening.
- Required change: none to code; note for the record that the authoritative
  test state is c42d5a0, not the phase-2 report.

**NB-2 (low) — Changed engine path has no automated test.**
- `path:line`: `app/src/main/java/com/drelabs/datacheck/data/SamplingEngine.kt:70-75`
- Issue: the local-midnight window computation and null propagation in
  `rawMobileTotalTodayBytes` are covered only by CI compile and future human
  QA; no test exercises the window math (the `nowMs` param is injectable but
  `ZoneId.systemDefault()` is not).
- Impact: the part of the feature most capable of silently producing a wrong
  comparison figure is untested. Acceptance criterion 4 only mandates
  delta/state logic testing (which exists), and the method is platform-bound,
  so this does not gate acceptance — but it concentrates correctness trust on
  human QA.
- Required change: none mandatory; a follow-up issue could extract window
  computation into a pure function.

## 4. Notes

- **N-1 — Main-thread NSM binder call, pre-existing class.**
  `DashboardScreen.kt:303-304` invokes the blocking NSM query inside
  `LaunchedEffect` (main dispatcher). Identical class to the pre-existing
  `backfillTick` path (`DashboardScreen.kt:68` → `runTick` →
  `queryMobilePerUid`/`queryDeviceTotal`, `SamplingEngine.kt:108-138`). The
  `if (prefs.showValidationCard)` guard (`DashboardScreen.kt:300`) ensures
  the call is paid only when the feature is on. Not a new ANR class.
- **N-2 — Midnight attribution semantics.** Ticks spanning midnight are
  attributed wholly to their `tickStart` day (`UsageLogDao.kt:38`), while
  NSM's window is midnight→now (`SamplingEngine.kt:72-73`); shortly after
  midnight the card can show a small systematic positive delta. This matches
  the criterion's literal wording and the existing "Mobile today" card
  convention — the card compares NSM against exactly the figure the app
  itself displays, which is the issue's stated purpose. Interpretation
  caveat for human QA, not a defect.
- **N-3 — Dual midnight computation.** `DashboardScreen.kt:279` and
  `SamplingEngine.kt:72` each compute midnight microseconds apart; an exact
  day-flip between them could pair mismatched day windows. Astronomically
  rare, diagnostics-only.
- **N-4 — Switch feedback cosmetics.** The validation switch persists
  immediately but neither shows nor resets the "Saved" indicator
  (`SettingsScreen.kt:162-168`), unlike interval chips. Purely cosmetic.
- **N-5 — OEM NSM snapshot semantics.** `querySummaryForDevice`
  (`SamplingEngine.kt:133`) may return last-known-value snapshots on some
  OEMs, so "NSM raw today" can differ slightly from the Settings app's live
  figure. Inherent to the platform API; tolerance judgment stays human.

## 5. Acceptance-Criteria Coverage

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Hidden unless persisted toggle enabled | **covered** | `Prefs.kt:41-45` (`showValidationCard`, default `false` at :42, key :53, `commit()` like all prefs); `DashboardScreen.kt:300-309` (guard → `Hidden`); `DashboardScreen.kt:136-137` (`Hidden -> {}`); `SettingsScreen.kt:54,162-168` (seeded from prefs, immediate persist). No-restart effect verified against `MainActivity.kt:30-35`: conditional composition means back-navigation re-enters `DashboardScreen`, re-running `LaunchedEffect(Unit)` (`DashboardScreen.kt:67-70`). |
| 2 | NSM raw today + logged ticks today + delta, human-readable | **covered** | `DashboardScreen.kt:150-173` (three text rows; `Format.bytes` reused — no duplicated formatting; sign handling :151-155 exists only because `Format.kt:5` returns `"?"` for negatives). Data: `SamplingEngine.kt:70-75` (device-summary, `TYPE_MOBILE` at :133, all UIDs) and `DashboardScreen.kt:282,305` via `UsageLogDao.kt:37-40` (`SUM(rx+tx) WHERE tickStart >= :sinceMs`) — the identical query behind the app's own "Mobile today" figure. |
| 3 | Visible error state on NSM query failure | **covered** | `SamplingEngine.kt:130-138` (`queryDeviceTotal`: null on unavailable service :131, null on any exception :135-137, incl. SecurityException) → `:73` (`?: return null`) → `Validation.kt:50` (null → `Error`) → `DashboardScreen.kt:138-148` (visible card, actionable message). Zero NSM usage today correctly yields `Values(0,…)`, not an error. |
| 4 | Delta/state unit-tested; genuine TDD red/green | **covered** | `ValidationLogicTest.kt:11-34` (delta: sign both ways, zero-zero, GB-range, `Long.MAX_VALUE`) and `:38-120` (state: both toggle-off cases, error, values, zero-logged, zero-delta) — 11 tests, following `AttributionTest.kt` conventions exactly. RED run 34483016952 failed exactly the 8 tests predicted against stubs (`delta→0`, `buildState→Hidden`) while the 3 trivially-passing ones passed — an outcome only producible by real assertions against wrong logic. GREEN run 34484850567's single failure was the arithmetic-defective test (recomputed above); c42d5a0 fixed the operand only; final run 34485585367 green, 17/17 (11 Validation + 6 Attribution; `AttributionTest.kt` untouched — absent from diff). |
| 5 | No direct NSM/USM/TrafficStats in ui/; via engine | **covered** | Independent grep of `app/src/main/java/com/drelabs/datacheck/ui` for `NetworkStatsManager\|UsageStatsManager\|TrafficStats` → **no matches**. Sole stats access: `DashboardScreen.kt:303-304` → `SamplingEngine.rawMobileTotalTodayBytes()`. Complies with `AGENTS.md:32-33`. |

**Scope (checklist A):** the complete diff (fdc792b..c42d5a0, 389 lines, 3
commits) touches exactly the six allowed files: `data/Validation.kt` (new),
`data/Prefs.kt`, `data/SamplingEngine.kt`, `ui/dashboard/DashboardScreen.kt`,
`ui/settings/SettingsScreen.kt`, `app/src/test/.../ValidationLogicTest.kt`
(new). Nothing else.

**Locked constraints (checklist D):** no manifest/build/gradle/dependency/
permission changes in the diff (permissions remain the 4 allowed); no Room
schema/entity/DAO changes (`UsageLogDao.kt` untouched; existing `totalsSince`
sufficed); no `docs/`, `keystore/`, `.github/` changes; validation path
performs zero DAO writes (read-only diagnostics).

**Correctness checks (checklist C):** `rawMobileTotalTodayBytes` reuses
`queryDeviceTotal` (TYPE_MOBILE, exception→null) and the `runTick`
default-param style — matches existing engine patterns, read-only. Card state
computed in `loadDashboard` after `backfillTick`, matching the screen's
existing load pattern; exhaustive sealed `when`, no recomposition hazards.
Switch follows the existing section/row conventions with immediate persist.
Overflow claims in `Validation.kt:31-32` verified mathematically: `a − b`
with `a,b ∈ [0, 2^63−1]` ∈ `[−(2^63−1), 2^63−1]`, always representable;
inputs non-negative by construction (`SamplingEngine.kt:134` coerces; row
bytes coerced at :118-119); the negation at `DashboardScreen.kt:152` is safe
because delta > `Long.MIN_VALUE` always.

**Silent failures (checklist E):** no swallowed-error path produces wrong
figures — NSM failure converts to a visible Error card, toggle read fails
safe (default false → hidden). The only wrong-figure classes are the inherent
NSM-semantics and midnight-attribution caveats (N-2, N-5), both documented.

## 6. Verification-Evidence Assessment

CI evidence (orchestrator-verified, treated as given) is internally
consistent and independently corroborated: RED run 34483016952's
exact-8-failure profile matches the stub design; the intermediate GREEN
failure is fully explained by the test arithmetic defect I recomputed; the
final 17/17 count matches 11 + 6 tests in the two test files; compile+lint+
release success covers the repo's project-feedback contract (no local
toolchain exists per `AGENTS.md:50-53`, so CI is the correct executor). No
check appears omitted, weakened, or misleading. Self-reports were not used
as evidence; the one stale claim found is NB-1.

## 7. Residual Risks

- Human QA remains open: toggle on/off roundtrip on a real device, and
  card-vs-Android-Settings comparison within ±1% tolerance per
  `AGENTS.md:60-61`. CI green proves logic, not product behavior.
- N-2/N-5 mean small deltas near midnight or on snapshot-semantics OEMs are
  expected behavior, not bugs — judgment stays with the human.
- NB-2: engine window math is untested by automation.
- This review is an independent engineering assessment, not issue completion,
  merge approval, or human acceptance.

Finding counts: BLOCKING: 0 · NON-BLOCKING: 2 · NOTE: 5.

VERDICT: PASS
