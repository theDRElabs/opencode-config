# ISSUE-006 Phase 1 (RED) — Result

Attempt 1, implementer fresh context, 2026-09-11. Repo at
/home/ubuntu/projects/data-check, branch `main`, HEAD 7cf2fee at start.

## Files created (only these two; nothing else touched)

1. `app/src/main/java/com/drelabs/datacheck/data/TickBookkeeper.kt` — new
   pure-logic unit + two interfaces. Zero Android imports, zero external
   imports (the stub body needs none; the suspend function *type* is pure
   Kotlin). Instantiable in JVM unit tests.
2. `app/src/test/java/com/drelabs/datacheck/TickBookkeeperTest.kt` — 11 JVM
   unit tests, plain JUnit 4 + `kotlinx.coroutines.runBlocking/launch/yield`
   (already on the test classpath via room-ktx/work-runtime-ktx transitives —
   verified: main code compiles `CoroutineWorker` + suspend DAO calls, so
   coroutines-core is on the same-module compile/test classpath; no new
   dependencies added, build files untouched).

No changes to SamplingEngine.kt, TickWorker.kt, DashboardScreen.kt,
UsageLogDao.kt, or any build/manifest file. No git operations performed.

## Design (the testable unit)

- **`TickBookkeeper.runWindow(nowMs, sample: suspend (startMs, endMs) -> TickDraft?): CommittedWindow?`**
  — owns the ENTIRE critical section (resolve → sample → insert → cache
  write), so atomicity is structural rather than call-site discipline. This
  is the API the phase-2 fix implements and wires into SamplingEngine; the
  signatures are final unless a test itself proves defective.
- **`TickStore`** (suspend, DAO-shaped, production adapter wraps UsageLogDao
  in phase 2):
  - `latestEndMs(): Long?` — DB is the source of truth (revives the dead
    `UsageLogDao.latestEndMs` as the live query)
  - `stampStart(atMs)` — fresh-install stamp, must be DB-visible
  - `insertTick(startMs, endMs, deviceRx, deviceTx, usages)` — one window
    commit (maps to the existing @Transaction insertTickWithUsages)
- **`WindowCache`** (sync, non-authoritative): `lastTickEndMs()` /
  `storeLastTickEndMs()` — models SharedPreferences as cache only; every
  disagreement with the DB must resolve in the DB's favor (pinned by tests).
- Nested data classes `WindowUsage` / `TickDraft` / `CommittedWindow` follow
  the house style (like `SamplingEngine.TickResult`, `Validation.CardState`).
- The two-instance concurrency test forces the phase-2 mutex to be
  companion/singleton-level (review NB-1): a per-instance `Mutex` fails it,
  because SamplingEngine is constructed per call (TickWorker vs dashboard).

## The stub (why tests fail)

The stub body reproduces the confirmed F-04 bug exactly: reads the window
start from the cache (read-then-write, like `Prefs.lastTickEndMs`), never
consults `store.latestEndMs()`, stamps fresh installs into the cache only,
and has no mutex. Tests compile against it and fail at runtime.

## Expected CI result: 7 failures, 4 passes (17 existing tests unaffected)

### Expected FAILING (7) — expected value vs stub value

| # | Test | Expected (correct) | Stub produces (bug) |
|---|------|--------------------|---------------------|
| 1 | `stale cached end loses to the database end` | start=2000 (DB end); insert [2000,3000] | start=1000 (stale cache); insert [1000,3000] — overlap re-log |
| 2 | `cached end ahead of the database also loses` | start=2000 | start=2500 (cache wins in stub) |
| 3 | `missing cache entry falls back to the database` | committed [2000,3000] | stub treats null cache as fresh install: stamps cache=3000, returns null |
| 4 | `crash after insert does not re-log the already committed window` | exactly one new insert [2000,3000], tiling after prior [1500,2000] | re-logs [1500,3000], overlapping the already-committed [1500,2000] |
| 5 | `fresh install stamps the database start point and samples nothing` | store.stampedAt=1000, store.latestEndMs()=1000 | stamp goes to cache only; store.stampedAt=null, latestEndMs()=null |
| 6 | `interleaved ticks through one bookkeeper never double-log a window` | inserts tile [1000,2000]+[2000,2500] | no lock → both resolve start=1000 → overlapping [1000,2000]+[1000,2500] (deterministic: single-threaded runBlocking event loop, `yield()` inside the sample callback forces the interleave before either insert) |
| 7 | `interleaved ticks through two bookkeeper instances never double-log a window` | same tiling as #6, across two TickBookkeeper instances (worker vs dashboard construction pattern) | identical overlap failure — this is the on-device F-04 race (dashboard catch-up vs WorkManager tick) |

Failures #1–#5 prove "DB wins, prefs is only a cache"; #6 proves the critical
section is atomic; #7 proves the lock is app-scoped (NB-1), not per-instance.

### Expected PASSING against the stub (4) — regression guards for phase 2

These pin behavior the current code already gets right single-threaded, so
the phase-2 refactor must not lose it:

1. `sequential windows are gapless and non-overlapping` (also pins the
   cache write-through contract: cache==3500 after commit)
2. `tick at or before the last end is skipped` (nowMs <= lastEnd → null)
3. `empty sample commits nothing and keeps the window start` (NSM-empty
   window must not advance the start)
4. `gap longer than the max window is clamped` (start = now −
   TickBookkeeper.MAX_WINDOW_MS = 6 h; also pins the 6 h constant)

Manifest scenario coverage: sequential non-overlap (guard 1), interleaved/
concurrent no-double-insert (#6, #7), stale-prefs-loses-to-DB (#1, #2, #3),
fresh-install stamp (#5), crash-after-insert no re-insert (#4), 6 h clamp
preserved (guard 4). All six scenarios present.

## Structural check evidence

`git status --short` after writing:

```
 M docs/BACKLOG-M6.md
?? app/src/main/java/com/drelabs/datacheck/data/TickBookkeeper.kt
?? app/src/test/java/com/drelabs/datacheck/TickBookkeeperTest.kt
```

- `docs/BACKLOG-M6.md` was already modified BEFORE this phase began (observed
  in the first `git status` of this session, before any file was created);
  not touched by this work.
- Only the two new files are untracked; no tracked file modified.
- Grep for `TickBookkeeper|TickStore|WindowCache` across `app/src`: 51
  matches, ALL inside the two new files — the unit is referenced by its
  tests and by nothing in SamplingEngine/TickWorker/DashboardScreen/DAO
  (i.e., not wired; wiring is phase 2).
- 11 `@Test` methods in TickBookkeeperTest.kt.

## Risks / notes for phase 2

- Concurrency tests are deterministic on runBlocking's single-thread event
  loop (yield-driven interleave); they do NOT use real threads, so they prove
  the mutex contract, not thread-safety of the fakes — production fakes are
  irrelevant there anyway.
- Phase 2 must: implement runWindow with DB-backed resolution (latestEndMs
  wins over cache in all cases incl. cache-miss), companion-level Mutex with
  try/finally unlock (sample may throw), stampStart on DB (RoomTickStore
  adapter; e.g. empty tick row — no schema change needed), insert inside the
  lock, cache write-through after commit (pinned by guard 1), clamp
  preserved, and keep signatures unchanged.
- Green tests against the stub are intentional (guards), so the phase-1 CI
  signal is: build OK, exactly these 7 tests red, everything else green.
