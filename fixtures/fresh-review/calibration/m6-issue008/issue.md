ISSUE-008: Make totalsSince SUM query NULL-safe (F-01)
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: totalsSince over an empty match can never crash or return
  NULL-mapped values, by SQL construction (IFNULL), and the guard is
  pinned against regression
EVIDENCE: F-01 in docs/REVIEW-FINDINGS-M6.md — suspected Room SUM-NULL
  crash: aggregate without GROUP BY returns one row of NULLs; Room 2.6.1
  maps NULL into non-null TotalsRow Longs. ISSUE-007 review NB-1 widened
  the hit-window: the new save->dashboard flow calls
  totalsSince(entryAtMs) with the entry stamp inside the currently open
  tick window, so an empty match occurs for up to one interval after
  EVERY bundle save (plus the pre-existing fresh-install and
  00:00-to-first-tick windows). On-device evidence so far (app survived
  fresh installs and daily rollovers) suggests Room tolerates NULL in
  practice, so this is a defensive fix that removes the dependence on
  Room's null-handling behavior entirely.
ACCEPTANCE:
- totalsSince SQL guards both SUM columns with IFNULL(..., 0)
- Other aggregate queries audited and documented: GROUP BY queries
  (topAppsSince, dailySince, latestTickTotal) return zero rows (not NULL
  rows) on empty match; group-level SUMs over existing rows are never
  NULL — audit recorded in the implementation result
- A regression pin exists: JVM test asserting the totalsSince @Query SQL
  contains the NULL guard (structural test, honestly labeled as such —
  Room row mapping is not executable in JVM tests under the no-new-deps
  constraint)
- Call sites unchanged; no schema change; no new dependencies
- Existing 40 tests green; TDD red first (pin test fails against current
  SQL) via the two-push CI protocol; CI green on the fix
LAYERS: data
MODULES: UsageLogDao.kt (@Query SQL only), app/src/test (new structural
  pin test)
TESTS: structural annotation pin test (red first)
COMMANDS: CI only — testDebugUnitTest + lint via existing workflow
CONSTRAINTS: no new dependencies (no Robolectric/room-testing); no Room
  schema changes; locked decisions unchanged; commits batched for user
  approval
NON-GOALS: confirming the suspected crash's exact exception type
  on-device (moot after the fix), F-02/F-03/F-05/F-06/F-07 (separate
  triage), changing callers to nullable-field mapping
```
