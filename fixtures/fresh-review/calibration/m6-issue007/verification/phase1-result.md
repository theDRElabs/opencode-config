# ISSUE-007 Phase 1 (RED) — Result

Attempt 1, implementer fresh context, 2026-09-11. Repo at
/home/ubuntu/projects/data-check, branch `main`, HEAD ef57ede at start
(verified: `git rev-parse --short HEAD` → ef57ede; matches the manifest's
base commit). Working tree clean before this phase (first `git status`
showed nothing besides the files created below).

## Files created (only these two; nothing else touched)

1. `app/src/main/java/com/drelabs/datacheck/data/BundleLogic.kt` — new
   pure-logic unit. Only import is `java.time.LocalDate` (already used by
   main code, e.g. DashboardScreen). No Android imports, no Room, no new
   dependencies, instantiable/ callable from JVM unit tests.
2. `app/src/test/java/com/drelabs/datacheck/BundleLogicTest.kt` — 12 JVM
   unit tests, plain JUnit 4 (`org.junit.Test` + `assertEquals`), exactly
   the ValidationLogicTest conventions.

Deviation from the manifest suggestion, deliberate: the manifest suggested
`data/Bundle.kt`; I named it `BundleLogic.kt` with `object BundleLogic` so
file name == object name (house convention: Validation.kt/Validation,
TickBookkeeper.kt/TickBookkeeper) and to avoid any ambiguity with
`android.os.Bundle` when phase 2 wires it into the Compose screens. Test
file `BundleLogicTest.kt` matches the `ValidationLogicTest.kt` naming.

No changes to Prefs.kt, DashboardScreen.kt, SettingsScreen.kt, DAO, or any
build/manifest file. No git operations performed.

## Design (the testable unit — signatures frozen for phase 2)

- **`BundleLogic.usageSinceEntry(rows: List<UsageRow>, entryAtMs: Long): Long`**
  — sum of rows with `tickStart >= entryAtMs`. This is the executable spec
  for the DAO window: in production the dashboard calls
  `dao.totalsSince(prefs.bundleEntryAtMs)` (same `>=` semantics, per the
  verified DAO behavior), so the pure function pins the semantics the SQL
  must keep.
- **`BundleLogic.buildState(bundleBytes, entryAtMs, usedSinceEntryBytes, nowMs, today: LocalDate, renewalDay: Int): CardState`**
  — one pure builder, Validation.buildState-style, where the DAO value
  enters as `usedSinceEntryBytes` (Room stays out of the unit).
- **`CardState`** sealed interface, mirrors `Validation.CardState`:
  - `Hidden` — card must not be shown
  - `Values(bundleBytes, usedBytes, leftBytes, pct, daysLeft)` — data class
- **`UsageRow(tickStart, total)`** — DAO-shaped pure row for the window spec.

### Frozen semantic decisions (encoded in the red tests)

1. `bundleBytes <= 0` → `Hidden` (matches existing UI gating `bundle > 0`).
2. `entryAtMs <= 0` (never stamped — also the legacy-install migration
   case) → `Hidden`. Without an entry timestamp, "remaining as of now"
   cannot be truthfully shown; falling back to cycle-start counting would
   reproduce this issue's bug. Phase 2 must pair this with Settings copy
   that makes re-saving the bundle natural (see notes below).
3. `entryAtMs > nowMs` (clock skew) → `usedBytes = 0`, full bundle left;
   the card stays visible.
4. `leftBytes = max(bundleBytes - usedBytes, 0)`; `pct = usedBytes /
   bundleBytes` coerced to [0, 1] — pct is the USED fraction, same formula
   as the current DashboardScreen.kt:299.
5. `daysLeft` derived ONLY from `today` + `renewalDay` (existing
   cycleStart math: renewalDay coerced 1..28, DAYS.between(today,
   cycleStart.plusMonths(1))) — never from the entry timestamp. Renewal
   stays informational.
6. "New entry resets the baseline" = re-stamping entryAtMs narrows the
   counted window; logged rows are never touched (test 4 pins both views
   over one unchanged row list).

## The stub (why tests fail)

- `usageSinceEntry` stub body: `return 0L` — ignores rows entirely.
- `buildState` stub body: `return CardState.Values(0, 0, 0, 0f, 0L)` —
  ignores all six inputs.

Both compile (signatures are final) and are wrong at runtime in a way that
makes every single new test fail — including the Hidden-expecting tests
(stub returns Values, never Hidden) and the used-expecting tests (stub
returns 0).

## Expected CI result: 12 failures, 0 passes (28 existing tests unaffected)

### Expected FAILING (12) — expected value vs stub value

| # | Test | Expected (correct) | Stub produces |
|---|------|--------------------|---------------|
| 1 | `usage after entry is counted` | 50 MB (row at entry+1h) | 0 |
| 2 | `usage before entry is not counted` | 20 MB (pre-entry 30 MB row excluded; 50 MB would mean the bug) | 0 |
| 3 | `row exactly at entry timestamp is counted` | 10 MB (`>=` boundary, matches DAO totalsSince) | 0 |
| 4 | `new entry resets the baseline without dropping rows` | 50 MB from firstEntry, 20 MB from secondEntry (same rows) | 0 and 0 |
| 5 | `bundle zero hides the card` | Hidden | Values(0,0,0,0,0) |
| 6 | `unstamped entry hides the card` | Hidden (entryAtMs=0, bundle=121 MB) | Values(0,0,0,0,0) |
| 7 | `values state reports used left pct and days to renewal` | Values(1 GB, 250 MB, 750 MB, 0.25, 20) | Values(0,0,0,0,0) |
| 8 | `used beyond the bundle clamps left to zero and pct to one` | Values(100 MB, 250 MB, 0, 1.0, 20) | Values(0,0,0,0,0) |
| 9 | `nothing used since entry leaves the full bundle` | Values(121 MB, 0, 121 MB, 0.0, 20) | Values(0,0,0,0,0) |
| 10 | `future entry timestamp yields zero used` | Values(500 MB, 0, 500 MB, 0.0, 20) (entry = now+1h, skew) | Values(0,0,0,0,0) |
| 11 | `days to renewal is unaffected by entry time` | identical Values(..., daysLeft=20) for entry 10d old and 1h old | Values(0,0,0,0,0) twice |
| 12 | `days to renewal follows the renewal day` | Values(..., daysLeft=4) for renewalDay=15, today=2026-09-11 (cycle start 08-15 → next 09-15) | Values(0,0,0,0,0) |

daysLeft fixtures: today=2026-09-11, renewalDay=1 → cycle start 2026-09-01
→ next renewal 2026-10-01 → 20 days; renewalDay=15 → cycle start
2026-08-15 → next 2026-09-15 → 4 days.

### Expected PASSING against the stub

None of the new tests. The 28 existing tests (AttributionTest 6,
ValidationLogicTest 11, TickBookkeeperTest 11) are untouched and stay
green — the new files reference nothing existing and nothing existing
references them.

### Manifest scenario coverage

- usage before entry NOT counted → #2 (+#3 boundary)
- usage after entry counted → #1
- new entry resets baseline → #4
- left = max(bundle−used, 0), pct in [0,1] → #7, #8, #9
- bundle 0 / entry 0 → hidden state (existing gating bundleBytes > 0) → #5, #6
- daysLeft from renewalDay, unaffected by entry → #11, #12
- future entryAtMs (clock skew) → used 0 → #10

All seven required scenarios present.

## Structural check evidence

`git rev-parse --short HEAD && git status --short` after writing:

```
ef57ede
?? app/src/main/java/com/drelabs/datacheck/data/BundleLogic.kt
?? app/src/test/java/com/drelabs/datacheck/BundleLogicTest.kt
```

Only the two new files are untracked; no tracked file modified.

Grep `BundleLogic` across `app/src`: 31 matches, ALL inside the two new
files (1 in BundleLogic.kt — the object declaration; 30 in
BundleLogicTest.kt). Zero references in DashboardScreen / SettingsScreen /
Prefs / DAO / SamplingEngine / TickBookkeeper → the unit is NOT wired;
wiring is phase 2.

Grep `@Test` in BundleLogicTest.kt: 12 matches (12 test methods; new suite
total 40 = 28 existing + 12 new).

## Risks / notes for phase 2

- Migration decision is FROZEN by tests 5/6: existing installs have
  bundleBytes set but bundleEntryAtMs = 0 → card Hidden until the user
  re-saves the bundle in Settings (which stamps entryAtMs = now). Phase 2
  must make that painless: Settings copy like "How much data you have left
  right now — counting starts when you save" invites the re-save; consider
  surfacing it in the phase2-result.md acceptance walkthrough.
- Phase 2 wiring checklist: Prefs.kt add `bundleEntryAtMs: Long` (default
  0, KEY pattern as-is); SettingsScreen Save writes bundleBytes +
  bundleEntryAtMs = System.currentTimeMillis() + copy update;
  DashboardScreen replaces cycleStart-based totalsSince with
  dao.totalsSince(prefs.bundleEntryAtMs) fed into
  BundleLogic.buildState(...); keep "Nd to renewal" from renewalDay;
  card copy stays truthful ("counting since entry").
- `usageSinceEntry` stays in the unit as the pinned spec of the DAO
  window; production uses dao.totalsSince(entryAtMs). If phase 2 finds the
  DAO semantics differ (`>` vs `>=`), test 3 is the tripwire.
- Stub bodies contain intentionally-wrong returns marked STUB; replace
  with the real logic, signatures unchanged, tests unchanged.
- Phase-1 CI signal to expect: build OK, assembleDebug OK, lint OK,
  exactly these 12 BundleLogicTest failures, everything else green.
