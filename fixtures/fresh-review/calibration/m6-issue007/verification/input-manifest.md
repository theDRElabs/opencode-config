# ISSUE-007 Input Manifest — attempt 1 (TWO-PUSH TDD via CI)

## Issue

Read `issue.md` in this directory (copied from docs/BACKLOG-M6.md). Note the
OUTCOME-NOTE: the user has confirmed the semantics — entering a bundle
figure means "this is my current remaining balance as of now". Usage counts
from entry time forward.

## Task

You are the IMPLEMENTER for ISSUE-007 in the DataCheck Android repo: make
the bundle tracker count usage from bundle-entry time instead of
renewal-cycle start. Two-phase TDD via CI (same protocol as ISSUE-002 and
ISSUE-006): phase 1 = red tests, phase 2 = fix.

## Repo facts (verified by orchestrator)

- Repo: /home/DRE/projects/data-check, branch `main`, base commit ef57ede
  (CI green: run 34588888051; last commit is a docs-only backlog update,
  ef57ede, CI green by inspection of 34588888051 successor — check
  `gh run list` yourself is NOT possible locally; trust the orchestrator:
  code at ef57ede is identical to e3b919e which was CI-green).
- Working tree clean.
- NO local JDK/SDK: never run gradle/java. Tests run ONLY on GitHub
  Actions (`build` job: assembleDebug testDebugUnitTest lint). The
  orchestrator pushes and watches CI between your two phases.
- Existing tests (all green in CI, 28 total): AttributionTest.kt (6),
  ValidationLogicTest.kt (11), TickBookkeeperTest.kt (11). Follow their
  conventions: plain JUnit, pure-logic testing, no mocking framework, no
  Room in JVM tests, no new dependencies.
- Current bundle implementation (verified locations):
  - Prefs.kt:29-35 — `bundleBytes: Long` (KEY_BUNDLE), `bundleRenewalDay:
    Int` (KEY_RENEWAL); plain SharedPreferences get/set via `.commit()`.
  - SettingsScreen.kt:99-135 — "Data bundle" section: size text field,
    GB/MB unit chips, renewal-day field, Save button writes
    `prefs.bundleBytes` and `prefs.bundleRenewalDay`.
  - DashboardScreen.kt:292-300 — `bundleUsed =
    dao.totalsSince(cycleStart(today, prefs.bundleRenewalDay)...)`;
    `daysLeft = DAYS.between(today, cycleStart.plusMonths(1))`;
    cycleStart() helper at DashboardScreen.kt:328.
  - Dashboard card text (DashboardScreen.kt:131-133): "X of Y used · Z
    left · Nd to renewal".
- Recent context (ISSUE-006, landed): window bookkeeping is now
  TickBookkeeper + RoomTickStore (data/TickBookkeeper.kt); usage rows have
  tickStart >= last tick end; `dao.totalsSince(ms)` sums rx+tx of usage
  rows with tickStart >= ms. Do not touch TickBookkeeper.

## Semantics decision (user-confirmed, from the issue OUTCOME-NOTE)

- Entering a bundle figure = "I have this much remaining, as of now."
- bundleUsed = sum of usage rows with tickStart >= entry timestamp.
- Entering a new figure resets the baseline (stamps a new entry time);
  never touches logged rows.
- Renewal day stays as a separate informational feature ("Nd to renewal")
  — it no longer affects usage accounting.
- UI copy must make the "remaining as of now" meaning clear (e.g. label
  "Data bundle", field hint/caption like "How much data you have left
  right now — counting starts when you save").

## Design requirements (from the issue contract)

1. Entering a bundle figure stamps an entry timestamp (persisted —
   Prefs.kt addition, e.g. `bundleEntryAtMs: Long` with a sensible default
   of 0 = never entered).
2. bundleUsed counts only usage rows with tickStart >= entry timestamp
   (DashboardScreen change: use entry timestamp instead of cycleStart for
   the totalsSince argument).
3. Entering a new figure resets the baseline without touching logged rows
   (SettingsScreen: on save, write bundleBytes + bundleEntryAtMs = now).
4. UI copy updated to convey "remaining as of now".
5. Pure-logic unit for the baseline computation (testable without Room —
   e.g. a function computing bundle state from (bundleBytes, entryAtMs,
   usedSinceEntry, now, renewalDay) → used/left/pct/daysLeft), TDD red
   first. The DAO call stays in the dashboard (untestable in JVM; keep the
   pure part extracted).
6. No Room schema changes; no new dependencies/permissions; no
   manifest/build edits; keep renewal-day field and "to renewal" display
   working (informational).

## TWO-PUSH TDD protocol

### PHASE 1 — RED (this call)

1. Read the files listed above (SettingsScreen, DashboardScreen bundle
   section, Prefs, plus the existing test files for conventions).
2. Design the pure-logic unit (suggested: data/Bundle.kt following the
   Validation.kt pattern — look at it too).
3. Write tests FIRST covering at minimum:
   - usage before entry time is NOT counted (usageSinceEntry from rows
     with tickStart >= entryAtMs)
   - usage after entry IS counted; new entry resets baseline (used
     restarts from 0 at the new stamp)
   - left = max(bundleBytes - used, 0); pct in [0,1]
   - entry timestamp 0 / bundle 0 → bundle card hidden or zero state
     (match existing UI gating: bundleBytes > 0)
   - daysLeft still computed from renewalDay (informational, unaffected
     by entry time)
   - stale-entry edge: entryAtMs in the future (clock skew) → sane
     behavior (used = 0)
4. Create MINIMAL COMPILABLE STUBS (wrong values) so tests compile but
   FAIL at runtime. List exactly which tests you expect to fail and why.
5. Touch ONLY: new pure-logic file(s) under data/, new test file(s) under
   app/src/test/. No wiring, no git operations.

### PHASE 2 — GREEN (orchestrator resumes you after red is CI-confirmed)

1. Implement the real logic (same signatures — tests frozen).
2. Wire end to end:
   - Prefs.kt: add persisted bundleEntryAtMs (default 0)
   - SettingsScreen.kt: on Save, stamp prefs.bundleEntryAtMs = now; update
     copy ("remaining as of now" meaning)
   - DashboardScreen.kt: bundleUsed = dao.totalsSince(prefs.bundleEntryAtMs)
     via the pure unit; keep daysLeft from renewalDay; card copy stays
     truthful ("counting since entry" — keep it short)
3. Everything stays inside: data/ (Prefs, new Bundle file),
   ui/settings/SettingsScreen.kt, ui/dashboard/DashboardScreen.kt,
   app/src/test/. Anything else: STOP and report.
4. Migration concern: existing users have bundleBytes set but
   bundleEntryAtMs = 0 → totalsSince(0) counts ALL history. Decide and
   document: treat 0 as "entry unknown" → fall back to… (your call as
   implementer, but document it in phase2-result.md; a reasonable choice:
   if entryAtMs == 0, show the card with used counted from cycle start and
   a hint to re-save the bundle, OR stamp entry = first tick after
   bundleBytes was last changed — impossible without a write time; keep it
   simple and document).

## Checks to run and record (structural, local)

Phase 1: grep evidence tests reference stubs; scope via git status.
Phase 2: grep evidence per acceptance bullet; scope via git status/diff.

## Deliverables

Append to /home/DRE/.config/opencode/runs/data-check/M6/ISSUE-007/attempt-1/:
- phase1-result.md / phase2-result.md (same structure as ISSUE-006's).

Return per phase: compact summary. Budget: ≤30 tool calls per phase.
