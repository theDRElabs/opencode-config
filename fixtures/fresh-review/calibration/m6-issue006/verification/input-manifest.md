# ISSUE-006 Input Manifest — attempt 1 (TWO-PUSH TDD via CI)

## Issue

Read `issue.md` in this directory (copied from docs/BACKLOG-M6.md). Note the
EVIDENCE block: this bug was CONFIRMED on device — logged today 749 MB vs
NSM raw today 441 MB (delta +308 MB) while the user repeatedly opened the
app. This is F-04 from docs/REVIEW-FINDINGS-M6.md.

## Task

You are the IMPLEMENTER for ISSUE-006 in the DataCheck Android repo:
eliminate double-counted windows by making tick window bookkeeping atomic.
Two-phase TDD via CI (like ISSUE-002): phase 1 = red tests, phase 2 = fix.

## Repo facts (verified by orchestrator)

- Repo: /home/ubuntu/projects/data-check, branch `main`, base commit a0bf2e7
  (CI green: run 34493571577).
- Working tree clean.
- NO local JDK/SDK: never run gradle/java. Tests run ONLY on GitHub Actions
  (`build` job: assembleDebug testDebugUnitTest lint). You cannot observe
  red/green yourself; the orchestrator pushes and watches CI between phases.
- Existing tests: app/src/test/java/com/drelabs/datacheck/AttributionTest.kt
  and ValidationLogicTest.kt (17 tests, all green in CI). Follow their
  conventions (plain JUnit, no mocking framework — check what they use).
- The bug (verified by ISSUE-004 review, citations confirmed 13/13):
  - SamplingEngine.kt:85-104 — runTick resolves window start by reading a
    SharedPreferences value, inserts rows, then writes the new window end
    back. No lock. SamplingEngine is constructed per call (TickWorker.kt:15,
    DashboardScreen.kt:270), so instance state cannot serialize anything.
  - DashboardScreen.kt:265-272 — backfillTick (catch-up on app open when
    ≥10 min since last tick) races the WorkManager periodic tick.
  - UsageLogDao.kt:28 — latestEndMs() EXISTS but is dead code (never called).
  - Boot reconciliation path must keep working (resolveWindowStart /
    first-tick-after-boot samples full window back to last tick end;
    fresh install with no rows stamps the starting point and returns null).
  - The 6 h MAX_WINDOW_MS clamp (SamplingEngine.kt:98-101, 208) must be
    preserved in any refactor.

## Design requirements (from the issue contract)

1. Window start comes from the DB (latestEndMs-style query over ticks),
   SharedPreferences only as a cache/optimization if you keep it at all —
   DB is the source of truth.
2. An app-scoped mutex at companion/singleton level (NOT a per-instance
   field) serializes the resolve-insert-commit critical section across
   worker and dashboard call sites.
3. Regression test in JVM unit test proving no double-insert under an
   interleaved/concurrent tick scenario. You will likely need to extract
   window bookkeeping into a testable unit (pure logic + a fake DAO) —
   follow how AttributionTest/ValidationLogicTest test pure logic. Room DAO
   itself cannot be instantiated in JVM tests (no in-memory Room in the
   existing test setup — do not add dependencies).
4. No Room schema changes, no new dependencies, no manifest/build edits.
5. Keep notification/room/label behavior unchanged.

## TWO-PUSH TDD protocol

### PHASE 1 — RED (this call)

1. Read SamplingEngine.kt, TickWorker.kt, DashboardScreen.kt (backfillTick),
   UsageLogDao.kt, and both existing test files.
2. Design the testable window-bookkeeping unit (e.g. a TickBookkeeper /
   WindowResolver pure class taking a DAO-like interface you define, or a
   similar extraction following existing conventions).
3. Write tests FIRST covering at minimum:
   - sequential ticks: window 2 starts where window 1 ended (no gap, no
     overlap) when DB says last end = T
   - interleaved/concurrent: two tick resolutions against the same state
     produce non-overlapping windows and exactly one insert's worth of rows
     per window (simulate the race deterministically, e.g. by interleaving
     calls, or by testing that a mutex-protected resolve is atomic)
   - SharedPreferences being stale must NOT cause overlap: DB value wins
   - fresh install (no rows): stamp start, log nothing (existing behavior)
   - crash-after-insert (insert committed, window-end write "lost"): next
     tick still starts from DB end, no re-insert
   - 6 h clamp preserved on a large gap
4. Create MINIMAL COMPILABLE STUBS so the tests compile but FAIL at runtime
   (wrong values / no atomicity), and list exactly which tests you expect
   to fail and why.
5. Touch ONLY: new pure-logic file(s) under data/, new test file(s) under
   app/src/test/. Do NOT wire the engine/UI yet. Do NOT git operations.

### PHASE 2 — GREEN (orchestrator resumes you after red is CI-confirmed)

1. Implement the real bookkeeping logic (same signatures — tests unchanged,
   unless a test itself was defective; then document why).
2. Wire it end to end:
   - SamplingEngine uses the DB-backed, mutex-protected resolution
   - TickWorker and DashboardScreen.backfillTick both go through it
   - dead latestEndMs() becomes the live source (or your equivalent query)
   - preserve boot reconciliation + first-install stamping + 6 h clamp
3. Everything stays inside: data/ (SamplingEngine, UsageLogDao query if
   needed — @Query method additions are allowed, NO entity/schema changes),
   work/TickWorker.kt, ui/dashboard/DashboardScreen.kt (backfill path only),
   app/src/test/. If you believe another file must change, STOP and report.

## Checks to run and record (structural, local)

Phase 1: grep evidence tests reference the stubbed unit; scope check via
git status (only new files). Phase 2: grep evidence for each acceptance
bullet; scope check via git status/diff (allowed files only).

## Deliverables

Append to /home/ubuntu/.config/opencode/runs/data-check/M6/ISSUE-006/attempt-1/:
- phase1-result.md: files created, expected-failing test list with
  expected-vs-stub values, structural check evidence
- phase2-result.md: files changed, design decisions (where the mutex lives,
  how DB wins over stale prefs), structural check evidence per acceptance
  criterion, risks

Return per phase: compact summary as specified. Budget: ≤30 tool calls per
phase.
