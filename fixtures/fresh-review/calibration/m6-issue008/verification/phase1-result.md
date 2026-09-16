# ISSUE-008 Phase 1 (RED) — Implementation Result

## File created

`app/src/test/java/com/drelabs/datacheck/UsageLogDaoSqlGuardTest.kt`
(only file touched by implementer)

- Test class: `UsageLogDaoSqlGuardTest`
- Test method: `` `totalsSince guards both SUM columns with IFNULL` ``
  (backtick naming + package `com.drelabs.datacheck` match existing test
  conventions, e.g. BundleLogicTest.kt)
- Plain JUnit 4 (`org.junit.Assert`), no new dependencies; imports
  `androidx.room.Query` (available on the unit-test classpath because
  room-runtime is an implementation dep of the app module).

## Assertion strategy (structural pin, honestly labeled)

- Reflection: `UsageLogDao::class.java.methods.single { it.name == "totalsSince" }`
  → `getAnnotation(Query::class.java)` → `.value` SQL string. (Kotlin suspend
  interface methods keep their annotations in compiled bytecode, so this works
  on JVM.)
- Normalization: `sql.lowercase().replace(Regex("\\s+"), "")` — case- and
  whitespace-insensitive, so any reasonable phase-2 SQL formatting passes.
- Assertions:
  1. `ifnull(sum(rx+tx),0)astotal` present (total column guarded)
  2. `ifnull(sum(fgrx+fgtx),0)asfgtotal` present (fgTotal column guarded)
  3. `fromusagewheretickstart>=:sincems` present (guards accidental rewrite
     of table/filter — optional hardening suggested by the manifest)
- KDoc on the class states explicitly: this is a STRUCTURAL test, not
  behavioral — Room row mapping (NULL row → non-null TotalsRow Longs) cannot
  be executed in JVM tests without Robolectric/room-testing (forbidden by
  no-new-deps); the pin proves the SQL contains the guard by construction,
  and Room's annotation processor validates the SQL itself at compile time
  in CI.

## Why it fails now (expected RED)

Current SQL at UsageLogDao.kt:37-40:
`SELECT SUM(rx + tx) AS total, SUM(fgRx + fgTx) AS fgTotal FROM usage WHERE tickStart >= :sinceMs`
— compacted: `selectsum(rx+tx)astotal,sum(fgrx+fgtx)asfgtotal,...`
Neither `ifnull(sum(rx+tx),0)astotal` nor `ifnull(sum(fgrx+fgtx),0)asfgtotal`
is a substring → assertions 1 and 2 fail with a message showing the actual
SQL. Assertion 3 passes against current SQL (unchanged in phase 2). No SQL
was changed in this phase; no git operations performed; no gradle/java runs
(no local JDK/SDK — CI-only verification per manifest).

## Scope evidence

grep (test references totalsSince + Query annotation):

```
3:import androidx.room.Query
26:   fun `totalsSince guards both SUM columns with IFNULL`() {
27:   val method = UsageLogDao::class.java.methods.single { it.name == "totalsSince" }
28:   val query = method.getAnnotation(Query::class.java)
29:   assertNotNull("totalsSince must carry a @Query annotation", query)
35:   "total column must be IFNULL(SUM(rx + tx), 0) AS total, was: $sql",
36:   compact.contains("ifnull(sum(rx+tx),0)astotal")
39:   "fgTotal column must be IFNULL(SUM(fgRx + fgTx), 0) AS fgTotal, was: $sql"
40:   compact.contains("ifnull(sum(fgrx+fgtx),0)asfgtotal")
```

git status at HEAD 517f04c:

```
 M docs/BACKLOG-M6.md
?? app/src/test/java/com/drelabs/datacheck/UsageLogDaoSqlGuardTest.kt
```

Note: `M docs/BACKLOG-M6.md` (+48 lines) is the orchestrator's ISSUE-008
backlog entry, present before this implementer started; the implementer's
only change is the new untracked test file. DAO, sources, and all other
files untouched.

## Result

Phase 1 complete: RED pin test in place, fails against current SQL as
required. Ready for orchestrator push #1 (expected CI failure on this one
test), then phase 2 (one-line IFNULL fix).
