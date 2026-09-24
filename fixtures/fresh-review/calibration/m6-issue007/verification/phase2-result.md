# ISSUE-007 Phase 2 (GREEN) — Result

Attempt 1, implementer fresh context, 2026-09-11. Repo at
/home/ubuntu/projects/data-check, branch `main`. Phase 1 red confirmed by CI
run 34595788054 (12/12 BundleLogicTest failures as predicted, 28 existing
green). Tests FROZEN — `git diff --stat -- app/src/test` is empty; no test
file touched. Signatures from phase1-result.md unchanged.

## Files changed (exactly these four; nothing else touched)

```
 M app/src/main/java/com/drelabs/datacheck/data/BundleLogic.kt
 M app/src/main/java/com/drelabs/datacheck/data/Prefs.kt
 M app/src/main/java/com/drelabs/datacheck/ui/dashboard/DashboardScreen.kt
 M app/src/main/java/com/drelabs/datacheck/ui/settings/SettingsScreen.kt
```

No changes to UsageLogDao.kt, TickBookkeeper, SamplingEngine, any
build/manifest file, or app/src/test. No git operations performed.

### What changed where

1. **data/BundleLogic.kt** — replaced both STUB bodies with real logic;
   signatures untouched. `usageSinceEntry` = sum of rows with
   `tickStart >= entryAtMs` (Sequence filter + sumOf). `buildState`:
   `bundleBytes <= 0 || entryAtMs <= 0` → `Hidden`; clock-skew guard
   (`entryAtMs > nowMs` → used = 0); `left = (bundle - used).coerceAtLeast(0)`;
   `pct = used/bundle coerced [0,1]` (USED fraction, same as before);
   `daysLeft = DAYS.between(today, cycleStart.plusMonths(1))` with the
   renewalDay-coerce-1..28 cycleStart math moved here from DashboardScreen
   (same formula the old private helper used). Added single import
   `java.time.temporal.ChronoUnit`.
2. **data/Prefs.kt** — new persisted property `bundleEntryAtMs: Long`
   (KEY_BUNDLE_ENTRY = "bundle_entry_at_ms", default 0 = never stamped),
   following the exact existing property pattern (getLong/putLong +
   .commit()). Sits right after bundleBytes.
3. **ui/settings/SettingsScreen.kt** — Save handler now stamps
   `prefs.bundleEntryAtMs = System.currentTimeMillis()` alongside
   bundleBytes (SettingsScreen.kt:145). Copy updated (strings below),
   including a conditional migration hint shown only while
   `prefs.bundleBytes > 0 && prefs.bundleEntryAtMs == 0L`
   (SettingsScreen.kt:111).
4. **ui/dashboard/DashboardScreen.kt** — `loadDashboard` now:
   `entryAtMs = prefs.bundleEntryAtMs`; `usedSinceEntry =
   dao.totalsSince(entryAtMs)?.total ?: 0L` (guarded: query skipped when
   entryAtMs <= 0 so legacy installs don't pay a full-history sum);
   `bundle = BundleLogic.buildState(bundleBytes, entryAtMs,
   usedSinceEntry, System.currentTimeMillis(), today,
   prefs.bundleRenewalDay)` (DashboardScreen.kt:292-305).
   `DashboardData`'s four bundle fields replaced with
   `val bundle: BundleLogic.CardState = BundleLogic.CardState.Hidden`;
   card renders via `when (val b = d.bundle)` — same layout (label "Bundle",
   pct %, LinearProgressIndicator, one text line), same position in the
   column, mirroring the existing Validation.CardState pattern. Old
   private `cycleStart()` helper removed (its only callers were the
   deleted cycle-based bundle block; the math now lives in, and is pinned
   by, BundleLogic tests 11/12).

## Migration decision (documented, as required)

Phase 1 froze `bundleBytes <= 0 || entryAtMs <= 0` → `Hidden` (tests 5
"bundle zero hides the card" and 6 "unstamped entry hides the card"). This
IS what the tests pin — verified by reading BundleLogicTest.kt:54-82.
Consequence for existing installs (bundleBytes set, no entry stamp): the
bundle card disappears after update until the user re-saves the bundle in
Settings, which stamps entryAtMs = now. Chosen over the manifest's
alternative (fall back to cycle-start counting + hint): falling back would
reproduce exactly the bug this issue fixes (counting usage from before the
entry), so "hidden until re-save" is the only truthful option. The Settings
copy makes the re-save path explicit and self-explanatory:
- the caption "counting starts when you save" reframes saving as the
  counting start event;
- the conditional hint "Your saved figure isn't counted yet — tap Save to
  start counting from now." appears ONLY in the legacy state, telling the
  user exactly what to do;
- after Save, entryAtMs > 0 and the hint disappears (condition re-evaluated
  on recomposition; prefs getters read live SharedPreferences, same
  live-read pattern as the existing Clear-button gating at line 151).

Stamping on Save is unconditional (also fires when the field is empty →
bundleBytes = 0): inert in that case because bundleBytes <= 0 → Hidden
regardless; the stamp is only ever consumed when bundleBytes > 0, and the
only path back to bundleBytes > 0 is Save, which re-stamps. Clear does not
reset entryAtMs — no visible state can combine Clear's bundleBytes = 0
with a stale stamp.

## Structural check evidence (per acceptance bullet)

1. **Entering a bundle figure stamps an entry timestamp (persisted)**
   - Prefs.kt:36 `var bundleEntryAtMs: Long` + KEY_BUNDLE_ENTRY
     "bundle_entry_at_ms" (git diff above shows both hunks).
   - SettingsScreen.kt:145 `prefs.bundleEntryAtMs =
     System.currentTimeMillis()` inside the Save onClick, immediately
     after the bundleBytes write.
2. **bundleUsed counts only usage rows with tickStart >= entry timestamp**
   - DashboardScreen.kt:292-294: `val entryAtMs = prefs.bundleEntryAtMs` →
     `dao.totalsSince(entryAtMs)?.total ?: 0L` — the only bundle usage
     source.
   - UsageLogDao.kt:38 (pre-existing, untouched):
     `SELECT SUM(rx + tx) ... FROM usage WHERE tickStart >= :sinceMs` —
     `>=` matches `usageSinceEntry`'s window (test 3 boundary; verified
     by reading the DAO query).
   - Pure spec: BundleLogic.kt:49-53 `filter { it.tickStart >= entryAtMs }`.
3. **Entering a new figure resets the baseline without touching logged rows**
   - Reset = Save re-stamps entryAtMs (SettingsScreen.kt:145) → the
     totalsSince window moves; no DELETE/UPDATE on usage anywhere in the
     diff (git diff touches no DAO/entity code; grep of changed files
     shows no insert/delete DAO calls). Pinned by test 4 ("new entry
     resets the baseline without dropping rows" — same rows, narrower
     window).
4. **UI copy makes clear the figure means "remaining as of now"**
   - SettingsScreen.kt:103 label `"Data left right now"`; :108 caption
     `"How much data you have left — counting starts when you save."`;
     :113 legacy hint `"Your saved figure isn't counted yet — tap Save to
     start counting from now."`
   - DashboardScreen.kt:131 card text `"... used since you saved · ...
     left · Nd to renewal"` — truthful about counting-since-entry, short.
5. **Unit tests for the baseline logic (TDD red first); existing tests green**
   - Red confirmed by CI run 34595788054 (12 BundleLogicTest failures,
     28 existing green) before this phase.
   - Tests frozen this phase: `git diff --stat -- app/src/test` → empty.
   - Expectation now: 40/40 green (12 BundleLogicTest flip to green against
     the real implementation; 28 existing untouched).
6. **No Room schema changes; no new dependencies/permissions**
   - `git status --short` shows only the four source files above — no
     build.gradle(.kts), no libs.versions.toml, no manifest, no
     entity/DAO files. BundleLogic adds one JDK import
     (java.time.temporal.ChronoUnit), same java.time usage DashboardScreen
     already had.

## Exact UI copy strings

Settings — "Data bundle" section:
- Field label: `Data left right now`
- Caption (always): `How much data you have left — counting starts when you save.`
- Legacy hint (only while bundle set + unstamped): `Your saved figure isn't counted yet — tap Save to start counting from now.`
- Renewal-day field label unchanged: `Renewal day of month (1-28)`

Dashboard — Bundle card:
- Header row: `Bundle` / `<pct>%`
- Text line: `<used> used since you saved · <left> left · <N>d to renewal`
  (was: `<used> of <bundle> used · <left> left · <N>d to renewal` — the
  old "of Y used" phrasing wrongly implied Y was a cycle total; the figure
  is the remaining-at-entry, so the new copy drops it.)

## Deviations

- None from the phase-2 protocol. One wording nuance: card copy says
  "used since you saved" rather than "counting since entry" — shorter and
  matches the Settings caption ("counting starts when you save"), keeping
  one consistent user-facing metaphor.
- DashboardData bundle fields (4 scalars) were collapsed into the single
  `bundle: BundleLogic.CardState` field — required to render the Hidden
  state; DashboardData is private to DashboardScreen.kt (verified by grep:
  only references are in this file), so no external consumers affected.

## Risks

- **CI is the only verifier** (no local JDK/SDK): expected result is
  40/40 testDebugUnitTest green + lint clean. Lint risk is low: the
  removed cycleStart helper had no remaining callers; no new API levels,
  dependencies, or permissions.
- **Clock skew**: if device clock jumps backwards after a save
  (entryAtMs > nowMs), used = 0 until wall clock passes the stamp —
  pinned by test 10, degrades gracefully (card shows full bundle left).
- **Migration UX**: existing users see the bundle card vanish once, and
  must re-save; the conditional hint covers this, but a user who never
  opens Settings won't see the card. Accepted per frozen phase-1 design.
- **pct semantics**: pct is the fraction of the entered remaining figure
  already consumed (not remaining) — unchanged from the old card, matches
  tests 7/8; the progress bar fills as the remaining figure is consumed.
- SharedPreferences live-reads during composition (migration hint
  condition) follow the file's existing pattern (Clear-button gating);
  reads are cheap and only on this screen's recompositions.
