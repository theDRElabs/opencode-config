# ISSUE-008 Phase 2 (GREEN) — Implementation Result

## The SQL change (UsageLogDao.kt:37-40, @Query of totalsSince)

Before:

```sql
SELECT SUM(rx + tx) AS total, SUM(fgRx + fgTx) AS fgTotal FROM usage WHERE tickStart >= :sinceMs
```

After:

```sql
SELECT IFNULL(SUM(rx + tx), 0) AS total, IFNULL(SUM(fgRx + fgTx), 0) AS fgTotal FROM usage WHERE tickStart >= :sinceMs
```

Exactly the manifest-specified fix. No signature, `TotalsRow` data class
(UsageLogDao.kt:10), or call-site changes. The empty-match case now returns
`TotalsRow(0, 0)` by SQL construction instead of a row of NULLs; call sites
(TickWorker.kt ~29, DashboardScreen.kt ~282/~294) already handle the nullable
row and see identical results.

Pin-test compatibility check (verified against phase1-result.md assertions,
whitespace/case-normalized): new SQL compacts to
`selectifnull(sum(rx+tx),0)astotal,ifnull(sum(fgrx+fgtx),0)asfgtotal...`
— contains all three asserted substrings (`ifnull(sum(rx+tx),0)astotal`,
`ifnull(sum(fgrx+fgtx),0)asfgtotal`, `fromusagewheretickstart>=:sincems`).
Room's annotation processor validates the SQL at compile time in CI
(assebleDebug step), so a malformed guard fails the build, not just the pin.

## Aggregate audit — why the other queries cannot produce NULL-mapped values

All claims below verified directly from the code this session.

Shared fact (ground truth for every "never NULL" claim below): `UsageEntity`
(UsageEntity.kt:6-15) declares rx, tx, fgRx, fgTx as non-null Kotlin `Long`
(UsageEntity.kt:11-14). Room maps these to NOT NULL columns, so `rx + tx` /
`fgRx + fgTx` are non-NULL on every existing row, and a SQL `SUM` over one or
more existing non-NULL values cannot be NULL. NULL aggregates therefore only
arise from the empty-input case, which is what the type/GROUP-BY analysis
below rules out.

### topAppsSince — UsageLogDao.kt:30-35

`GROUP BY pkg` (line 32), returns `List<AppUsageRow>` (line 35). A GROUP BY
query produces one output row per group; with zero matching rows there are
zero groups → zero result rows → Room maps to an empty `List`, never a row
with NULL columns. With ≥1 matching row, every group contains ≥1 existing
row, so each group's `SUM(rx + tx)` / `SUM(fgRx + fgTx)` (line 31) is over
non-NULL values (see shared fact) → never NULL. `AppUsageRow`'s non-null
`Long` fields (UsageLogDao.kt:9) are therefore only ever fed non-NULL values.

### dailySince — UsageLogDao.kt:42-46

`GROUP BY tickStart` (line 44), returns `List<TickTotal>` (line 46). Identical
GROUP BY semantics: empty match → zero groups → zero rows → empty `List`, not
a NULL row. Non-empty: each group's `SUM(rx + tx)` (line 43) is over existing
rows of non-NULL columns → never NULL. `TickTotal`'s non-null `Long` fields
(UsageLogDao.kt:11) are safe by construction.

### latestTickTotal — UsageLogDao.kt:48-53

`INNER JOIN ticks t ON t.id = u.tickId` (line 50) restricted to
`WHERE t.endMs = (SELECT MAX(endMs) FROM ticks)` (line 51), `GROUP BY
u.tickStart` (line 51), returns nullable `TickTotal?` (line 53). Two cases:

1. The latest tick (e.g. the ISSUE-007 entry-stamp row, inserted with no
   usage rows) has no `usage` rows: the INNER JOIN produces zero joined rows
   → zero groups → zero result rows → Room maps to `null`, and the return
   type is explicitly `TickTotal?` — the NULL/empty case is handled by the
   type system, not mapped into non-null fields.
2. The latest tick has usage rows: the join yields those rows; `GROUP BY
   u.tickStart` produces one group whose `SUM(u.rx + u.tx)` (line 49) is over
   existing rows of non-NULL columns → never NULL.

(Even in the degenerate case of multiple tick rows sharing the same MAX
endMs, each resulting group's SUM is still over existing non-NULL rows.)

### Adjacent note (not in scope, zero-change observation)

`latestEndMs` (UsageLogDao.kt:27-28) is also a bare aggregate
(`SELECT MAX(endMs) FROM ticks`, no GROUP BY) that returns one NULL row on an
empty `ticks` table — but its return type is already `Long?`, so Room maps
NULL to `null` legitimately. No NULL-into-non-null hazard; no change needed.

## Scope evidence

git status --porcelain (working tree vs HEAD a853443, which is the phase-1
red commit "TDD red: totalsSince IFNULL guard pin test (M6 ISSUE-008 phase
1)" on top of 517f04c):

```
 M app/src/main/java/com/drelabs/datacheck/data/db/UsageLogDao.kt
```

git diff (entire diff; one SQL string line changed, nothing else):

```diff
--- a/app/src/main/java/com/drelabs/datacheck/data/db/UsageLogDao.kt
+++ b/app/src/main/java/com/drelabs/datacheck/data/db/UsageLogDao.kt
@@ -35,7 +35,7 @@ interface UsageLogDao {
     suspend fun topAppsSince(sinceMs: Long, limit: Int): List<AppUsageRow>
 
     @Query(
-        "SELECT SUM(rx + tx) AS total, SUM(fgRx + fgTx) AS fgTotal FROM usage WHERE tickStart >= :sinceMs",
+        "SELECT IFNULL(SUM(rx + tx), 0) AS total, IFNULL(SUM(fgRx + fgTx), 0) AS fgTotal FROM usage WHERE tickStart >= :sinceMs",
     )
     suspend fun totalsSince(sinceMs: Long): TotalsRow?
```

`git status --porcelain app/src/test/` → empty (test tree untouched this
phase; pin test lives in commit a853443). No git operations performed; no
gradle/java runs (no local JDK/SDK — CI-only verification per manifest).

## Risks

- **Low**: the pin test is structural (asserts on the SQL string, not row
  mapping) — honestly labeled as such in the test file; behavioral NULL
  mapping remains unexecutable in JVM tests under the no-new-deps constraint.
  Room's compile-time SQL validation plus the IFNULL-by-construction SQL is
  the actual safety mechanism.
- **None for callers**: IFNULL only changes NULL→0 on the empty-match case;
  non-empty results are bit-identical (SUM of existing rows). Call sites
  treat `TotalsRow(0,0)` and `null` equivalently per the manifest's verified
  call-site analysis.
- **None for schema**: @Query SQL text change only; no migration, no version
  bump.

## Result

Phase 2 complete: totalsSince NULL-safe by SQL construction; other
aggregates audited safe from code (GROUP BY zero-rows semantics + non-null
entity columns + nullable return type); scope confirmed one file, one line.
Ready for orchestrator push #2 — expected CI green (pin test now passes; 40
existing tests unaffected; Room processor validates the SQL).

## Defective pin test — discovery and fix (phase 2 resumed after CI red)

### The defect (CI-verified, runs 34625633777 and 34626521082)

Both CI runs failed at UsageLogDaoSqlGuardTest.kt line 29 — the
`assertNotNull("totalsSince must carry a @Query annotation", query)` — not
at the IFNULL guard assertions. Root cause:
`UsageLogDao::class.java.methods.single { it.name == "totalsSince" }
.getAnnotation(Query::class.java)` returns null because
androidx.room.Query has BINARY retention (RetentionPolicy.BINARY): the
annotation is kept in class bytecode for Room's annotation processor but
is invisible to RUNTIME reflection.

Consequence: the guard assertions never executed in either run. Phase 1's
"red" (commit a853443) was misattributed — it was the null-annotation
assert firing, not the intended guard assertions, so the "red" never
proved the test could detect the unguarded SQL. Same defect class as the
ISSUE-002 operand defect: a defective test mechanism whose failure
masqueraded as the intended red.

### The fix — reflection pin converted to a source-file pin

Only `UsageLogDaoSqlGuardTest.kt` changed; the DAO and its IFNULL SQL
(commit 1b37cd4) are untouched. No git operations (orchestrator pushes).

- Subject access: read UsageLogDao.kt as text. Path candidates:
  `src/main/java/com/drelabs/datacheck/data/db/UsageLogDao.kt` (module
  dir — AGP unit tests run with workingDir = app/) then
  `app/src/main/java/com/drelabs/datacheck/data/db/UsageLogDao.kt`
  (repo root), first existing wins. If none exists the test fails loudly
  (error() reporting the working directory and the candidates tried) —
  a pin test that cannot see its subject must be red, never silently
  skipped.
- Extraction: the text between the `@Query(` occurrence preceding
  `suspend fun totalsSince` and the function declaration — i.e. the SQL
  string literal(s) of the annotation block. Robust to reformatting and
  multi-literal concatenation (whitespace is compacted away before the
  contains-checks); both anchor indexes are themselves asserted, so a
  missing fun or missing @Query block fails loudly too.
- Assertions: unchanged three normalized-compact substrings (both IFNULL
  wrappings + `fromusagewheretickstart>=:sincems`), with the extracted
  @Query block text now shown in every failure message.
- Honest scope (KDoc updated): the pin proves the SQL as written in
  source, not Room's runtime mapping; Room's annotation processor still
  validates the SQL at compile time.

True-red check (verified by compacting both SQL variants from the diff
above in this session): the pre-fix SQL
(`selectsum(rx+tx)astotal,sum(fgrx+fgtx)asfgtotal...`) fails the first
assertion, and the post-fix SQL (1b37cd4) contains all three substrings —
so the new mechanism genuinely distinguishes guarded from unguarded SQL,
which the reflection version never could.

### New expected outcome

41/41 green on the next CI run: 40 existing tests + the fixed pin test.
Verification remains CI-only (no local JDK/SDK on this machine, per
manifest). The earlier "expected CI green" claim above was falsified by
the two red runs; this section supersedes it.
