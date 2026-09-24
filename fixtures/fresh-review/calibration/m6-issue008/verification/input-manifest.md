# ISSUE-008 Input Manifest — attempt 1 (TWO-PUSH TDD via CI)

## Issue

Read `issue.md` in this directory (copied from docs/BACKLOG-M6.md). The
EVIDENCE block explains why this is defensive (app survived empty-table
paths on device; we remove dependence on Room's NULL-handling entirely).

## Task

You are the IMPLEMENTER for ISSUE-008 in the DataCheck Android repo: make
`totalsSince` NULL-safe by SQL construction and pin it with a structural
regression test. Two-phase TDD via CI: phase 1 = red pin test, phase 2 =
the one-line SQL fix.

## Repo facts (verified by orchestrator)

- Repo: /home/ubuntu/projects/data-check, branch `main`, base commit 517f04c
  (docs-only commit on top of CI-green 7c3053d, run 34596751891).
- Working tree clean.
- NO local JDK/SDK: never run gradle/java. Tests run ONLY on GitHub
  Actions (`build` job: assembleDebug testDebugUnitTest lint). The
  orchestrator pushes and watches CI between your phases.
- Existing tests (all green, 40 total): AttributionTest.kt (6),
  ValidationLogicTest.kt (11), TickBookkeeperTest.kt (11),
  BundleLogicTest.kt (12). Plain JUnit 4, no mocking framework.
- The target, verified: `app/src/main/java/com/drelabs/datacheck/data/db/UsageLogDao.kt`
  - lines 37-40: `totalsSince(sinceMs: Long): TotalsRow?` —
    `SELECT SUM(rx + tx) AS total, SUM(fgRx + fgTx) AS fgTotal FROM usage
    WHERE tickStart >= :sinceMs` — aggregate WITHOUT GROUP BY → exactly
    one row, NULL columns when no rows match.
  - line 10: `data class TotalsRow(val total: Long, val fgTotal: Long)` —
    non-null Longs.
  - The other aggregates for your audit (do NOT change them, verify why
    they are safe): topAppsSince (GROUP BY pkg → empty list on no match),
    dailySince (GROUP BY tickStart → empty list), latestTickTotal (GROUP
    BY + INNER JOIN → null TickTotal? when the latest tick has no usage
    rows, e.g. the stamp row; group SUMs over existing rows never NULL).
  - Call sites (do NOT change): TickWorker.kt (~29), DashboardScreen.kt
    (~282 midnight totals, ~294 bundle). All already handle the nullable
    row; with IFNULL the empty case returns TotalsRow(0, 0) — same
    results at call sites.
- room-runtime is an implementation dependency, so androidx.room.Query
  is on the unit-test compile classpath: a JVM test CAN reflectively read
  the @Query annotation value from the DAO interface and assert on the
  SQL string. That is the regression pin mechanism (structural, not
  behavioral — label it honestly in the test file's doc comment).

## Design requirements

1. PHASE 1 (RED): new test file (follow existing naming, e.g.
   `UsageLogDaoSqlGuardTest.kt`) containing a structural pin test that
   reads the @Query annotation of `totalsSince` via Kotlin/Java
   reflection and asserts the SQL guards BOTH SUM columns with
   IFNULL(..., 0) (assert on normalized whitespace; both `total` and
   `fgTotal` expressions must be wrapped). Against the CURRENT SQL this
   test FAILS — that is the red. Keep the test minimal and clearly
   documented as a structural pin (cannot execute Room row-mapping in
   JVM; no new deps allowed). Optionally also assert the query targets
   the expected table/filter (guards accidental rewrite), but keep it
   focused.
2. PHASE 2 (GREEN): edit ONLY the totalsSince @Query SQL:
   `SELECT IFNULL(SUM(rx + tx), 0) AS total, IFNULL(SUM(fgRx + fgTx), 0)
   AS fgTotal FROM usage WHERE tickStart >= :sinceMs`. No signature, data
   class, or call-site changes. Room's annotation processor validates
   the SQL at compile time in CI, so a malformed guard fails the build.
3. Your audit (phase 2 result): state for each other aggregate query
   (topAppsSince, dailySince, latestTickTotal) why it cannot produce a
   NULL-mapped value, with line references.
4. Scope: data/db/UsageLogDao.kt (@Query SQL of totalsSince only) +
   app/src/test/ (new test file). NOTHING else. No git operations.

## Checks to run and record (structural, local)

Phase 1: grep evidence the test references totalsSince + Query
annotation; git status shows only the new test file.
Phase 2: grep evidence of IFNULL in the DAO; git diff scope check (SQL
line + nothing else); audit written.

## Deliverables

Append to /home/ubuntu/.config/opencode/runs/data-check/M6/ISSUE-008/attempt-1/:
- phase1-result.md: test file created, why it fails now (expected), scope
  evidence
- phase2-result.md: the SQL change, the aggregate audit with line
  references, scope evidence, risks

Return per phase: compact summary. Budget: ≤15 tool calls per phase.
