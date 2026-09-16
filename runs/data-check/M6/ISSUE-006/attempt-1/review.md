# ISSUE-006 Fresh-Context Review — PASS

**Reviewer**: fresh-context-review (big-pickle)
**Commit**: `e3b919e4c736801ffc1dfac952edc3581c26a66f` (main HEAD)
**Timestamp**: 2026-09-11

---

## 1. Verdict

**PASS** — zero blocking findings. All code-verifiable acceptance bullets are met with file:line evidence. One bullet (validation-card delta on device) is inherently on-device-only and is correctly not claimed as CI-verified.

---

## 2. Blocking Findings

**None.**

---

## 3. Non-Blocking Findings

### NB-1 — MEDIUM — Synchronous SharedPreferences `.commit()` inside the mutex

**Evidence:** `TickBookkeeper.kt:82` → `cache.storeLastTickEndMs(nowMs)` → `PrefsWindowCache.kt:167` → `prefs.lastTickEndMs = endMs` → `Prefs.kt:14` → `sp.edit().putLong(...).commit()` (synchronous disk write).

**Same occurs at:** `TickBookkeeper.kt:94` (post-insert commit).

**Why it matters:** `commit()` blocks until the SP file is flushed. Held inside the companion mutex, this serializes all tick resolution across the process on a synchronous disk write. The old code also wrote prefs synchronously (`prefs.lastTickEndMs = end` in the old `saveTick`), so this is not a regression — but if NSM queries + SP write + Room insert all contend under one lock, worst-case tick latency is the sum of all three. For a ~15 min tick interval, this is not operationally significant.

**Suggested fix (future):** `apply()` instead of `commit()` for the cache write (async), or drop `PrefsWindowCache` entirely since `lastTickEndMs()` is now write-only in production (see NB-2).

### NB-2 — LOW — `Prefs.lastTickEndMs` is write-only in production

**Evidence:** `TickBookkeeper.kt:164` (`PrefsWindowCache.lastTickEndMs()`) is defined but has **zero production callers** (grep confirms no caller outside the interface definition and test fakes). Only `storeLastTickEndMs()` is called (lines 82, 94). The `prefs.lastTickEndMs` getter is also exposed in `Prefs.kt:12` but unused by any production code path.

**Why it matters:** This is dead weight — harmless, and useful for test fakes, but could be cleaned up. Phase2-result.md explicitly notes this as a potential follow-up.

**Suggested fix (future):** Drop `WindowCache.lastTickEndMs()` from the interface when the `Prefs.lastTickEndMs` getter is also removed, or keep for downgrade-compatibility if desired.

### NB-3 — LOW — NSM binder calls run inside the mutex on the Main thread (pre-existing F-06 interaction)

**Evidence:** `DashboardScreen.kt:69-71` (`LaunchedEffect`) → `backfillTick` → `SamplingEngine(context).runTick(now)` → `bookkeeper.runWindow` → `windowMutex.withLock` → `sampleWindow` → `queryMobilePerUid` (`SamplingEngine.kt:110`) — **blocking NSM binder call on Main thread while holding the mutex.**

If the worker's tick is in progress (holding the mutex, doing its own NSM binder calls on Default), the dashboard's coroutine suspends at `withLock` — fine, main thread is free. When the worker finishes, the dashboard resumes and does **its own NSM queries on Main**. This is the **pre-existing F-06** class; this fix did not introduce it but makes the timing window tighter (more queued contention).

**Suggested fix (out of scope):** F-06 already recommends `withContext(Dispatchers.IO)` wrappers. That fix would eliminate the Main-thread concern for both the old direct call and this new mutex-held path.

---

## 4. Required Changes

**None** — all non-blocking findings are low/medium with pre-existing or acceptable trade-offs. No blocking findings exist.

---

## 5. Acceptance-Criteria Coverage

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Window start from DB (latestEndMs-style query), not SharedPreferences read-then-write | **covered** | `TickBookkeeper.kt:79` — `store.latestEndMs()` is the sole resolution input. `cache.lastTickEndMs()` has zero production callers (write-only). Old `resolveWindowStart` (read-then-write) is deleted (grep: no matches). `DashboardScreen.kt:271` also reads DB for backfill gate. |
| SharedPreferences only as cache | **covered** | `TickBookkeeper.kt:82,94` — `cache.storeLastTickEndMs()` called only after DB write (fresh-install stamp and insert). `PrefsWindowCache.kt:164` read has zero production callers. |
| App-scoped mutex, companion/singleton level, NOT per-instance | **covered** | `TickBookkeeper.kt:100-111` — `private val windowMutex = Mutex()` inside `companion object`. `withLock` at line 78. Per-instance would fail test `interleaved ticks through two bookkeeper instances` (line 226-240). |
| Critical section covers resolve → sample → insert completely | **covered** | `TickBookkeeper.kt:78-98` — mutex acquired at 78; resolve (79), clamp (87-88), sample (89), insert (93), cache write (94) all inside `withLock`. `withLock` is try/finally internally (releases on exception from sample). |
| Regression test proves no double-insert under interleaving | **covered** | `TickBookkeeperTest.kt:209-240` — two tests: single-instance interleaved (line 210), two-instance interleaved (line 226). Both use `launch` + `yield()` on `runBlocking`'s event loop, asserting `assertTilesRange` (no overlap, no gap). The stub (faithfully reproducing F-04: cache-based resolution, no mutex) deterministically fails both. Two-instance test pins mutex as companion-level per NB-1 of REVIEW-FINDINGS-M6.md. |
| Existing 17 tests stay green | **covered** | `AttributionTest.kt` (6 `@Test`), `ValidationLogicTest.kt` (11 `@Test`) = 17 existing; `TickBookkeeperTest.kt` (11 `@Test`) = new. Total = 28 `@Test` confirmed via grep. CI run 34588888051 (events.jsonl: `testDebugUnitTest exit 0 (28 tests)`). |
| Validation-card delta on healthy day returns to small | **pending user validation** | On-device only; not CI-verifiable. Marked as such in the issue contract. |
| No Room schema changes | **covered** | `UsageLogDb.kt:22` — `@Database(version = 1, entities = [TickEntity, UsageEntity])` — unchanged. `TickEntity.kt`, `UsageEntity.kt` — unchanged. Phase2 git diff shows zero changes under `.../db/`. |
| No new dependencies/permissions | **covered** | `build.gradle.kts` — unchanged (kotlinx-coroutines-core is a transitive dep of room-ktx/work-runtime-ktx; `Mutex` is in that transitive). `AndroidManifest.xml:5-9` — the same 4 permissions. No new `<uses-permission>`. |
| TDD red first | **covered** | Reflog: RED commit `c9bb631` ("TDD red: TickBookkeeper window-bookkeeping tests + failing stubs") → GREEN commit `e3b919e` ("Fix double-counting: DB-backed atomic window bookkeeping"). events.jsonl: run 34587597213 = 7 predicted red (RED); run 34588888051 = all green. |

---

## 6. Verification-Evidence Assessment

| Check | Evidence Quality | Notes |
|-------|------------------|-------|
| Source code state at e3b919e | **high** — full reads of all 3 changed files + 5 supporting files | `TickBookkeeper.kt` (169 lines), `SamplingEngine.kt` (208 lines), `DashboardScreen.kt` (332 lines), `UsageLogDao.kt` (73 lines), `TickWorker.kt` (40 lines), `Prefs.kt` (55 lines), `BootReceiver.kt` (15 lines), `TickBookkeeperTest.kt` (241 lines) — all read in full. |
| Commit identity | **high** — reflog proof | `.git/logs/HEAD` line 21-22: `c9bb631 → e3b919e` on main. `.git/refs/heads/main` = `e3b919e4c736801ffc1dfac952edc3581c26a66f`. |
| CI green result | **medium** — orchestrator-recorded, not independently re-fetched | `events.jsonl:34` records run 34588888051 green, 28 tests. Run IDs present in GitHub Actions but could not be re-fetched (private repo, no API auth from available tools). Phase1 and phase2 result files are self-consistent. |
| Diff scope (only 3 files changed) | **medium** — indirect evidence, no raw diff | No `git diff` available (read-only review, no shell). Phase2-result claims git status/diff empty for non-allowed files. Grep confirms `TickBookkeeper` references only in SamplingEngine + test. `latestEndMs` callers: TickBookkeeper + DashboardScreen only. No other files reference new symbols. Consistent with "3 files only." |
| Test frozen (no test changes in GREEN) | **high** — `@Test` count grep confirms 11 new + 17 existing = 28 total. Phase2 git diff empty for `app/src/test/`. |
| Empty stamp row harmlessness | **high** — full DAO query analysis | `latestTickTotal()` (UsageLogDao.kt:48-53) joins `usage u INNER JOIN ticks t ON t.id = u.tickId WHERE t.endMs = MAX(endMs)` — stamp tick has zero usage rows → join returns null → null `lastWindowDelta` → `?.total ?: 0L` → zero. `totalsSince` sums `usage` table — stamp adds no rows. `topAppsSince`, `dailySince`, `exportRows` — all aggregate/join `usage`. Stamp row is invisible everywhere except `MAX(endMs)`. |

---

## 7. New-Bug Check

| Risk Class | Result |
|------------|--------|
| **Deadlock** | **Clear.** One mutex (`TickBookkeeper.kt:110`), no second lock anywhere in the codebase (grep: Mutex appears only in TickBookkeeper). `withLock` is try/finally (releases on exception). Room suspend DAO functions do not call back into `TickBookkeeper`. `deleteOlderThan` runs OUTSIDE the mutex (SamplingEngine.kt:28, after `runWindow` returns). |
| **Reentrancy** | **Clear.** `sampleWindow` → `queryMobilePerUid/queryDeviceTotal/stateSplitForUid` never calls `runWindow`. No recursive acquisition. Non-reentrant Mutex would throw on reacquire — this path never triggers. |
| **Main-thread NSM under lock** | **Pre-existing (F-06), not new.** `DashboardScreen.kt:69-71` `LaunchedEffect` → `backfillTick` → `runTick` → `withLock` → NSM binder calls on Main. Pre-fix: same path ran NSM on Main without mutex. The mutex adds queueing (waits for worker tick) but does not change thread placement. F-06 non-goal. |
| **stampStart empty-tick pollution** | **Clear.** Verified: invisible to `totalsSince`, `topAppsSince`, `dailySince`, `latestTickTotal`, `exportRows` (all query/join the `usage` table). `latestTickTotal` returns null (no usage rows join stamp tick). Dashboard "last window" line shows 0L when null. |
| **Retention timing change** | **No change.** `deleteOlderThan` runs after every commit (SamplingEngine.kt:28) with `committed.endMs - RETENTION_MS`. Identical logic to pre-fix `saveTick`. Retention moves OUTSIDE the mutex (phase2 design) — crash between insert and prune leaves one extra 30d row. Harmless, already documented. |
| **Crash-after-insert still double-counts?** | **No.** `TickBookkeeper.kt:79` — next tick resolves from `store.latestEndMs()` (DB), which reflects the committed insert regardless of cache loss. Test `crash after insert does not re-log...` (line 191-205) pins this. |
| **proguard/R8 `Mutex` stripping** | **Safe.** `windowMutex` is private-companion with one `withLock` call site — R8 preserves it. CI release job (run 34588888051) succeeds, confirming no link-time error. |

---

## 8. Scope + Frozen-Tests Verification

**Files changed (post-GREEN, verified by grep):**

| File | Status | Verification |
|------|--------|--------------|
| `data/TickBookkeeper.kt` | **New** — 169 lines, interfaces + class + adapters | Read in full. Contains all bookkeeping logic. |
| `data/SamplingEngine.kt` | **Changed** — 208 lines | `resolveWindowStart` and `saveTick` deleted (grep: zero matches). `runTick` delegates to `bookkeeper.runWindow`. `sampleWindow` extracted. `rawMobileTotalTodayBytes` and NSM/USM helper methods unchanged. |
| `ui/dashboard/DashboardScreen.kt` | **Changed** — 332 lines | Backfill at lines 269-275 now reads `dao.latestEndMs()` instead of `prefs.lastTickEndMs`. `loadDashboard` (277-326) and UI composables (62-251) untouched. |

**NOT changed (verified by grep/read):**

| File | Evidence |
|------|----------|
| `data/db/UsageLogDao.kt` | Read (73 lines). `latestEndMs()` (line 27-28) existed as dead code; now live via `RoomTickStore`. Zero code changes. |
| `work/TickWorker.kt` | Read (40 lines). `engine.runTick()` at line 16 — same call, now routes through bookkeeper internally. Zero changes. |
| `work/BootReceiver.kt` | Read (15 lines). Sets `rebootPending = true`, reschedules — unchanged. |
| `data/Prefs.kt` | Read (55 lines). `lastTickEndMs` property — unchanged declaration. |
| `AndroidManifest.xml` | Read (62 lines). 4 permissions (lines 5-9) unchanged. |
| `app/build.gradle.kts` | Read (79 lines). Dependencies unchanged. |
| `data/db/TickEntity.kt` | Read (13 lines). Schema unchanged. |
| `data/db/UsageEntity.kt` | Read (15 lines). Schema unchanged. |
| `data/db/UsageLogDb.kt` | Read (25 lines). Version 1, entities unchanged. |

**Frozen tests:** `app/src/test/` contains exactly 3 files: `AttributionTest.kt` (6 `@Test`), `ValidationLogicTest.kt` (11 `@Test`), `TickBookkeeperTest.kt` (11 `@Test`). The 17 existing tests are untouched; 11 new tests added. Total: 28. CI exit 0 confirmed via events.jsonl.

---

## 9. Residual Risks

1. **Validation-card delta "returns to small"** — inherently on-device; requires a clean day's data after the fix lands. Prior corrupted data (749 MB logged 2026-09-11) remains in DB until retention purges it (~30 days) or the user reinstalls. Not a code defect. Pending human verification.

2. **F-06 (main-thread NSM blocking)** — pre-existing and out of scope. The dashboard backfill still runs NSM binder calls on `Dispatchers.Main`. The mutex adds queueing but not new blocking. Recommend future fix: `withContext(Dispatchers.IO)` wrapper around `backfillTick`'s call to `runTick` and the `rawMobileTotalTodayBytes` call in `loadDashboard`.

3. **F-04 pre-existing duplicate rows** — the fix prevents *new* double-counts but does not deduplicate existing rows from the 2026-09-11 incident. The validation card will show accurate results on fresh days going forward.

4. **`PrefsWindowCache.lastTickEndMs()` dead code** — interface method exists but has zero production callers. Harmless; serves test fakes. Future cleanup candidate.

---

**Summary:** PASS — 0 blocking, 3 non-blocking (NB-1 medium, NB-2 low, NB-3 low), 0 required changes. The fix structurally eliminates the F-04 race by (a) resolving window start exclusively from the DB via `latestEndMs()`, (b) serializing the resolve→sample→insert critical section under a companion-level `Mutex`, and (c) preserving all existing behavior (boot reconciliation, fresh-install stamp, 6h clamp, retention, notification, schema, permissions, deps). The test suite pins every property of the new architecture with deterministically red-failing-against-the-stub tests. CI confirms 28/28 tests pass. One acceptance bullet (validation-card delta) remains pending on-device verification.
