# ISSUE-007 Fresh-Context Review — Bundle tracker counts from bundle-entry time

## 1. Verdict

**PASS** — no blocking findings. All six acceptance criteria are met with file:line evidence; the red→green TDD order is confirmed from the repo's own reflog; scope is confined to the 4 allowed files; no schema/dependency/permission changes. Two medium-grade residual risks and several low findings follow, none of which invalidate the acceptance contract.

## 2. Blocking Findings

**None.**

## 3. Non-Blocking Findings

### MEDIUM

**NB-1 — New `totalsSince(entryAtMs)` call site widens the hit-window of unconfirmed F-01 (Room SUM-NULL).**
- Evidence: `DashboardScreen.kt:293-297` — `if (entryAtMs > 0) { dao.totalsSince(entryAtMs)?.total ?: 0L }`. `UsageLogDao.kt:37-40` — `SELECT SUM(rx + tx) … WHERE tickStart >= :sinceMs` with non-null `TotalsRow(total: Long, fgTotal: Long)` (line 10), no `IFNULL`. `SettingsScreen.kt:145` stamps `entryAtMs = System.currentTimeMillis()`, which falls inside the currently open tick window, so until the next tick whose `tickStart >= entryAtMs` lands (up to one interval), zero rows match and the aggregate returns a NULL row.
- Impact: IF F-01's suspected Room mapping crash is real (`docs/REVIEW-FINDINGS-M6.md:31-77`, explicitly unconfirmed there), the flagship save→dashboard flow hits it almost every time; the `?.total ?: 0L` guard does not help because the throw happens during row mapping, not on a null object. However, F-01 is a *suspected* crash, and the same zero-match path already existed (`totalsSince(midnight)` on empty tables every fresh install and every morning pre-first-tick, per REVIEW-FINDINGS F-01) — the app demonstrably ran on-device through fresh install and daily use (ISSUE-005 checks, `docs/BACKLOG-M6.md:153-162`), which suggests Room tolerates the NULL in practice. I could not run Room codegen or a DAO test here (CI-only builds per `AGENTS.md:50-53`), so the crash claim remains unverified.
- Suggested fix: implement the already-triaged F-01 fix (`IFNULL(SUM(rx + tx), 0)`, REVIEW-FINDINGS F-01) or a `try/catch → 0L` stopgap at `DashboardScreen.kt:294`; either protects both call sites.

### LOW

**NB-2 — Stale doc claim: PROJECT.md:27 still says the card shows "cycle usage %".**
- Evidence: `PROJECT.md:27` — "dashboard card shows cycle usage %, remaining, days-to-renewal". The card now shows usage since save (`DashboardScreen.kt:131-133`, `BundleLogic.kt:49-53`); cycle-based usage no longer exists. `VALIDATION.md` has no bundle-copy claims (only the generic settings-preserved list at line 146) and `docs/REVIEW-FINDINGS-M6.md:99` is a historical snapshot of pre-fix code — those are fine. Only the "source of truth for scope" doc (`AGENTS.md:8-9`) is stale. Pick up in the batched docs commit.

**NB-3 — daysLeft boundary cases untested: `today == renewalDay` and renewalDay 29–31 coercion.**
- Evidence: `BundleLogicTest.kt` fixtures only use `today=2026-09-11` with `renewalDay=1` (20 days) and `renewalDay=15` (4 days) — `BundleLogicTest.kt:96-103, 206-223`. The new math (`BundleLogic.kt:77-83`) is verified identical in structure to the old helper per the issue quote (`docs/BACKLOG-M6.md:240`: `totalsSince(cycleStart(renewalDay))`), the phase-1 manuscript (lines 59-61, 96-98, written from the old code before implementation), and the input manifest (`input-manifest.md:38-43`: old `cycleStart()` helper + `DAYS.between(today, cycleStart.plusMonths(1))`). Boundary analysis of the moved code: `day ≤ 28` makes `withDayOfMonth` always valid (Jan-31 overflow impossible by construction); `today==renewalDay` → next renewal is `today.plusMonths(1)` → e.g. 30 days, a sensible reading. I could not recover the exact old blob (no shell in this environment) to do a byte-diff, so equivalence rests on the moved-formula claim plus the two pinned sample points. Add tests for `today==renewalDay`, `renewalDay=28`/`29-31`, empty rows, and negative `bundleBytes` (`-1 → Hidden`).

**NB-4 — Save is three non-atomic pref commits; a process kill between them leaves a "Saved" bundle that is invisible.**
- Evidence: `SettingsScreen.kt:140-146` → `Prefs.kt:32`, `:39`, `:45` each `commit()` separately. Kill between commit 1 and 2 leaves `bundleBytes>0, bundleEntryAtMs=0` → `CardState.Hidden` (`BundleLogic.kt:73`) — but the migration hint (`SettingsScreen.kt:111-117`) shows exactly this state with a corrective instruction, so the failure is recoverable and the pattern is pre-existing. Optional hardening: one editor with chained writes.

**NB-5 — Save stamps `entryAtMs` and shows "Saved" even when the input is invalid.**
- Evidence: `SettingsScreen.kt:138-147` — `toDoubleOrNull()` null → `bundleBytes = 0L`, yet the stamp (`:145`) and `saved = true` (`:147`) still run. Harmless today (`Hidden` either way; stamp only consumed when `bundleBytes>0`), and the invalid-input "Saved" feedback pre-existed the change. Note only.

### NOTE

- **NB-6** — Clear leaves a stale stamp: `SettingsScreen.kt:152-156` zeroes `bundleBytes` but not `bundleEntryAtMs`. Inert today (`bundleBytes<=0 → Hidden` first, `BundleLogic.kt:73`), latent for future readers of the pref.
- **NB-7** — `.commit()` return values ignored (`Prefs.kt:32,39,45`); pre-existing file-wide pattern (`@SuppressLint("ApplySharedPref")`, `Prefs.kt:6`).
- **NB-8** — The pure spec cannot enforce DAO parity: nothing binds `UsageLogDao.kt:38`'s `>=` to `BundleLogic.kt:51`'s `>=`; a DAO-only operator change would pass all 12 JVM tests. Acknowledged design tradeoff (DAO untestable in JVM); the `>=` boundary is pinned in the pure unit (`BundleLogicTest.kt:32-38`).
- **NB-9** — `pct` float equality `0.25f` (`BundleLogicTest.kt:93`) is exact only because 0.25 is representable; fragile pattern, not a current bug.

## 4. Required Changes

None (no blocking findings). Recommended attachments for the batched approval commit: PROJECT.md:27 copy fix (NB-2); the F-01 `IFNULL` stopgap or a `try/catch` at DashboardScreen.kt:294 (NB-1); 3–4 boundary unit tests (NB-3). All optional.

## 5. Acceptance-Criteria Coverage

| Criterion | Status | Implementation evidence | Test evidence |
|---|---|---|---|
| Entering a bundle figure stamps an entry timestamp (persisted) | **covered** | `Prefs.kt:35-40` (`bundleEntryAtMs`, key `"bundle_entry_at_ms"` `Prefs.kt:59`, default 0); `SettingsScreen.kt:145` stamps `System.currentTimeMillis()` on every Save. **No path sets `bundleBytes>0` without a stamp** — writers are only Save (`SettingsScreen.kt:140`, stamps at :145) and Clear (`:153`, writes 0); default is 0 (`Prefs.kt:30`) | Hidden when unstamped: `BundleLogicTest.kt:69-82` |
| bundleUsed counts only rows with `tickStart >= entry` | **covered** | `DashboardScreen.kt:292-297` (query `dao.totalsSince(entryAtMs)`); DAO operator `>=` at `UsageLogDao.kt:38`; pure spec `BundleLogic.kt:49-53` (`filter { it.tickStart >= entryAtMs }`) | `>=` boundary pinned: `BundleLogicTest.kt:31-38`; before-entry excluded: `:21-29` |
| New figure resets baseline without touching rows | **covered** | Reset = re-stamp (`SettingsScreen.kt:145`); zero DAO writes anywhere in the changed files (grep: no insert/delete/update; `UsageLogDao.kt` untouched) | `BundleLogicTest.kt:40-50` — same rows, narrower window from the second entry |
| UI copy makes "remaining as of now" clear | **covered** | `SettingsScreen.kt:103` "Data left right now"; `:108` "How much data you have left — counting starts when you save."; `:111-117` legacy hint exactly when `bundleBytes>0 && bundleEntryAtMs==0L`; card copy `DashboardScreen.kt:131-133` "used since you saved · left · Nd to renewal" (old "of Y used" dropped — truthful, since the figure is remaining-at-entry) | n/a (UI copy, human QA) |
| Unit tests for baseline logic, TDD red first, existing green | **covered** | Red commit `bdc2b03` → green commit `7c3053d`, exactly one commit apart, verified in `.git/logs/HEAD:24-25`; HEAD = `7c3053d` (`.git/refs/heads/main`) | 12 new tests (`BundleLogicTest.kt`, counts 12 `@Test`), content identical to the phase-1 submission (names/asserts/fixtures match `phase1-result.md:79-98` exactly — no test edit between red and green); existing 28 = 11+11+6 (`ValidationLogicTest` 11, `TickBookkeeperTest` 11, `AttributionTest` 6) → 40 total |
| No Room schema changes; no new deps/permissions | **covered** | Changed files = exactly the 4 (`data/BundleLogic.kt`, `data/Prefs.kt`, `ui/settings/SettingsScreen.kt`, `ui/dashboard/DashboardScreen.kt` per phase-2 manuscript and commit structure); BundleLogic imports only `java.time` (JDK); no entity/db/manifest/build touched; `AndroidManifest.xml` still the exact 4 locked permissions (`AndroidManifest.xml:5-9`) | n/a |

**Left math:** `left = (bundle - used).coerceAtLeast(0)`, `pct = used/bundle` coerced `[0,1]` (`BundleLogic.kt:75-76`) — pinned by `BundleLogicTest.kt:108-126` (clamp) and `:128-147` (0-used). **Clock skew:** `entryAtMs > nowMs → used = 0`, card stays visible (`BundleLogic.kt:74`) — pinned `:150-168`; no negative/wraparound path (entry must be > 0; DAO sums are non-negative). **DashboardData refactor:** 4 scalars → single `bundle: CardState` (`DashboardScreen.kt:56`); all 4 `DashboardData` references are inside `DashboardScreen.kt`; old field names (`bundleUsed/bundleLeft/...`) have zero remaining references; `when` over the sealed `CardState` is exhaustive (`DashboardScreen.kt:114-139`); no dangling consumers. **Hidden transition:** legacy installs (bundle set, no stamp) → Hidden (`BundleLogic.kt:73`) with in-Settings re-save guidance (`SettingsScreen.kt:111-117`); no other code depended on always-visible-when-`bundleBytes>0` (VALIDATION.md has no bundle-card claims). **`.commit()` on main thread:** pre-existing file-wide pattern (`Prefs.kt:6`, all setters), not new.

## 6. Verification-Evidence Assessment

- **Availability limits (honest):** this environment has no shell, so `git diff --stat`, `git show bdc2b03:...`, byte-comparison of the test blob between the two commits, and GitHub queries for CI runs 34595788054 / 34596751891 could not be executed ("CI already ran" per the contract; `AGENTS.md:50-53` forbids local builds). Verified instead: commit order and HEAD from the repo's own `.git/logs/HEAD`/`refs`; the full current state of all 4 changed files + test + DAO + manifest + docs; no stale references by exhaustive grep; test-suite composition by direct `@Test` counts; test-content freezing by exact match of the 12 tests' names/assertions against the phase-1 red submission (any green-phase test edit would have shown as a mismatch).
- **CI evidence quality:** run IDs with predicted-vs-actual outcomes are recorded in the phase manuscripts; the red prediction (12/12 failures from deliberately wrong stubs; 28 existing green) is internally consistent with the stub design and file counts verified independently; the green result (40/40) matches the 28+12 file-level count. Evidence is orchestrator-mediated — adequate for this review, not a substitute for human QA.
- **No misleading claims found** in the producer's reports: migration semantics, copy strings, and file scopes all check out against the code as read.

## 7. Residual Risks

- **F-01 Room SUM-NULL behavior** remains unconfirmed (no DAO/Robolectric test exists, and none was added); if real, the new bundle call site is its most likely trigger (NB-1). Needs one DAO test or on-device observation of the save→dashboard flow.
- **Migration UX:** after update, the bundle card vanishes once until re-save (`BundleLogic.kt:73`); a user who never opens Settings won't see the hint. Accepted per the frozen phase-1 design, but it is a deliberate one-time regression of an existing visible feature.
- **daysLeft `today==renewalDay`** behavior (next renewal = one month out, e.g. 30 days) is computed and sensible but untested and unobserved on-device.
- **pct semantics** (used fraction of the entered remaining figure) is unchanged from the old card but conceptually double-inverted ("remaining" entered, "used" fraction bar fills); human QA should confirm the bar direction reads as intended.
- **Human QA remains necessary:** app never ran with this build on a device (no local toolchain, diff not yet deployed); navigation path Settings→Save→back→dashboard card appearance, the legacy-install hint, and card copy wording all need on-device confirmation. This review is an engineering assessment, not acceptance.
