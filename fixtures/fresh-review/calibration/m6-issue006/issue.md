ISSUE-006: Fix double-counting — make tick window bookkeeping atomic
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: a given usage window is sampled exactly once; opening the app
  while background ticks run can never re-log an already-logged window
EVIDENCE: validation card 2026-09-11: logged today 749 MB vs NSM raw
  today 441 MB (delta +308 MB, ~70% over-count) while user repeatedly
  opened the app to test the card — the F-04 race (REVIEW-FINDINGS-M6.md,
  SamplingEngine.kt:85-104, DashboardScreen.kt:265-272): window start is
  read-then-written in SharedPreferences; the dashboard catch-up tick
  races the WorkManager tick, both insert rows for the same window;
  crash-after-commit also re-inserts.
ACCEPTANCE:
- Window start comes from the DB (latestEndMs-style query), not
  SharedPreferences read-then-write; SharedPreferences only as cache
- An app-scoped mutex (companion/singleton level per review NB-1 — NOT a
  per-instance field, SamplingEngine is constructed per call) serializes
  runTick across worker and dashboard catch-up paths
- Regression test: concurrent/interleaved tick scenario in JVM unit test
  proves no double-insert (may require extracting window bookkeeping into
  a testable unit)
- Validation-card delta on a healthy day returns to "small" (expected
  ≤ one interval of traffic)
- No Room schema changes; no new dependencies/permissions; TDD red first
LAYERS: data
MODULES: SamplingEngine.kt (window bookkeeping), UsageLogDao.kt (window
  start query), TickWorker.kt/DashboardScreen.kt (call sites only)
TESTS: JVM unit test for window resolution under interleaving; existing
  17 tests stay green
COMMANDS: CI only — testDebugUnitTest + lint via existing workflow
CONSTRAINTS: locked decisions unchanged; no schema change without
  migration; commits batched for user approval
NON-GOALS: fixing F-02 midnight attribution, F-03 retention mismatch, or
  any other review finding (separate triage)
```
