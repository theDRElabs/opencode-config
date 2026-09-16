# ISSUE-006 Phase 2 (GREEN) — Result

Attempt 1, implementer fresh context, 2026-09-11. Resumed after CI-confirmed
red (run 34587597213: exactly the 7 predicted TickBookkeeperTest failures,
4 guards + 17 existing tests green, compile OK). Tests FROZEN —
`git diff --stat -- app/src/test/` and `git status --short -- app/src/test/`
are empty (zero test changes).

## Files changed (exactly three; git status shows only these)

1. `app/src/main/java/com/drelabs/datacheck/data/TickBookkeeper.kt`
   — stub body replaced with the real implementation + two production
   adapters (`RoomTickStore`, `PrefsWindowCache`). Tests untouched.
2. `app/src/main/java/com/drelabs/datacheck/data/SamplingEngine.kt`
   — runTick delegates window bookkeeping to TickBookkeeper; NSM sampling
   extracted verbatim into `sampleWindow(startMs, endMs): TickDraft?`;
   `resolveWindowStart`/`saveTick` deleted (bug F-04 code paths gone).
3. `app/src/main/java/com/drelabs/datacheck/ui/dashboard/DashboardScreen.kt`
   — backfill path ONLY (lines 269-275): catch-up reads
   `dao.latestEndMs()` instead of `prefs.lastTickEndMs`.

Deliberately NOT changed: `UsageLogDao.kt` (no @Query additions were needed
— the formerly dead `latestEndMs()` already exists and becomes the live
source; zero diff, `git diff --stat -- .../db/ .../work/` empty), `TickWorker.kt`
(already calls `SamplingEngine.runTick()`, which now routes through the
bookkeeper), entities/manifest/build (zero diff), BootReceiver (out of scope,
still works — see boot section). No git operations.

## Design decisions

### Mutex location — companion-level, in TickBookkeeper (review NB-1)

`TickBookkeeper.kt:110` — `private val windowMutex = Mutex()` inside
`companion object`; acquired at `TickBookkeeper.kt:78`
(`runWindow ... = windowMutex.withLock { ... }`). Rationale: SamplingEngine
(and with it TickBookkeeper) is constructed per call site (TickWorker.kt:15,
DashboardScreen.kt:273), so a per-instance field cannot serialize anything —
pinned by the two-instance interleaved test. `withLock` is try/finally
internally, so a throwing `sample` (NSM failure) cannot deadlock. Scope of the
critical section: resolve (DB read) → clamp → sample → insert → cache write —
the entire bookkeeping, so atomicity is structural, not call-site discipline.

### DB wins over prefs — cache is never read for resolution

`runWindow` resolves the start EXCLUSIVELY from `store.latestEndMs()`
(TickBookkeeper.kt:79). `cache.lastTickEndMs()` has zero production call
sites — grep shows only the interface declaration (line 29) and test fakes.
The cache (`PrefsWindowCache`, TickBookkeeper.kt:160-167) is strictly
write-through: stamped after fresh-install stamp (line 82) and after every
commit (line 94). A stale, missing, or ahead-of-DB prefs value is
structurally unable to influence a window; a crash between insert and cache
write is absorbed by the next DB read. Kept (issue contract: "SharedPreferences
only as a cache") — also preserves downgrade compatibility.

### How the DAO adapts to TickStore — RoomTickStore, no DAO edits

`RoomTickStore(private val dao: UsageLogDao)` (TickBookkeeper.kt:121-159):
- `latestEndMs()` → `dao.latestEndMs()` — the dead @Query (UsageLogDao.kt:28)
  is now the live source of truth.
- `stampStart(atMs)` → existing `@Transaction insertTickWithUsages` with an
  EMPTY tick row (`TickEntity(startMs=atMs, endMs=atMs, 0, 0)`, no usage rows)
  — DB-visible stamp with NO schema change. Invisible to usage-based queries
  (totalsSince/topAppsSince/dailySince/exportRows/latestTickTotal all read or
  join the `usage` table, which gets no rows); visible only via MAX(endMs).
- `insertTick(...)` → same `insertTickWithUsages`, mapping WindowUsage →
  UsageEntity(tickId=0, tickStart=startMs, ...) exactly as the old saveTick did.

### Engine wiring

`SamplingEngine.kt:23` — `bookkeeper = TickBookkeeper(RoomTickStore(dao),
PrefsWindowCache(prefs))`. `runTick` (lines 25-50): `runWindow(nowMs) { start,
end -> sampleWindow(start, end) } ?: return null`; then retention
(`dao.deleteOlderThan(committed.endMs - RETENTION_MS)` — was inside saveTick,
same cutoff, still runs on every commit, now after the mutex releases:
idempotent prune, no double-count surface); then `prefs.rebootPending = false`
(cleared ONLY on commit, exactly as before); then builds TickResult from
CommittedWindow with identical field values (tick id=0, rows tickId=0,
tickStart=start — same as pre-insert construction in old saveTick).
`sampleWindow` (lines 70-102) is the old runTick body verbatim: mobile-only
per-uid NSM query, empty→null (no insert, start preserved), device total with
per-uid fallback, FG/BG via stateSplitForUid else foregroundFractions else
Attribution.split. Only delta: rows built as WindowUsage (persistence fields
live in the adapter).

### Call sites

- TickWorker.kt:16 → `engine.runTick()` → bookkeeper. No edit needed.
- DashboardScreen.kt:269-275 backfillTick → reads
  `UsageLogDb.get(context).usageLogDao().latestEndMs() ?: 0L` (line 271,
  DB source of truth on the dashboard path too); 10-min catch-up threshold
  and `runTick(now)` call unchanged. This is the exact F-04 race pair
  (dashboard catch-up vs WorkManager tick) now serialized by one mutex over
  one DB-backed resolver.

## Acceptance criteria — evidence

1. **Window start from DB, not prefs read-then-write** —
   TickBookkeeper.kt:79 `val lastEnd = store.latestEndMs()` is the only
   resolution input; prefs written only via `cache.storeLastTickEndMs`
   (lines 82, 94), never read for resolution. DashboardScreen.kt:271 reads
   DB too. Old `resolveWindowStart` (read-then-write) deleted.
2. **App-scoped mutex at companion/singleton level** —
   TickBookkeeper.kt:100-110: `companion object { ... private val
   windowMutex = Mutex() }`; acquired TickBookkeeper.kt:78. Per-instance
   lock would fail the two-instance test; this one passes it by construction.
3. **Regression test proves no double-insert under interleaving** —
   TickBookkeeperTest.kt frozen (zero diff); tests
   `interleaved ticks through one bookkeeper...` and `...through two
   bookkeeper instances...` exercise the real mutex on runBlocking's
   event loop with yield-forced interleave. Implementation serializes
   resolve→sample→insert, so windows tile [1000,2000]+[2000,2500].
4. **No Room schema changes / no new dependencies / no manifest edits** —
   `git status --short` shows only the 3 allowed source files;
   `git diff --stat -- app/src/main/java/.../db/ .../work/` empty; entities
   and build.gradle.kts untouched; TickBookkeeper uses only
   kotlinx.coroutines.sync (coroutines-core, already on classpath — same
   dependency phase 1 tests relied on).
5. **Locked behavior preserved**:
   - mobile-only: TYPE_MOBILE NSM queries unchanged (sampleWindow verbatim)
   - notification: TickWorker.postPing + PingNotifier untouched
   - first-install stamps-and-skips: runWindow null branch stamps DB+cache,
     returns null (test `fresh install stamps the database start point...`)
   - boot reconciliation full-window: BootReceiver (work/BootReceiver.kt:11)
     sets rebootPending and reschedules; the next tick resolves start from
     DB latest end (not prefs) and samples the full gap back to last tick
     end, clamped at 6h (TickBookkeeper.kt:88); rebootPending cleared only
     on commit (SamplingEngine.kt:29, unchanged condition)
   - 6h clamp: TickBookkeeper.kt:88 + MAX_WINDOW_MS (line 101); test
     `gap longer than the max window is clamped` pins it
   - crash-after-insert: DB end governs the next window (test
     `crash after insert does not re-log the already committed window`)

## Risks

- **Empty-tick stamp row is new DB state**: a zero-byte tick appears in the
  `ticks` table on fresh install (and only there). All dashboards/exports
  read the `usage` table or join it, so it is invisible; worst case it makes
  `exportRows`/CSV output unchanged (no usage rows). If a future feature
  enumerates raw ticks, it will see the stamp.
- **Upgrading installs**: normal installs have DB ticks, so dbEnd resolves
  and prefs history is irrelevant. Degenerate case (DB wiped externally but
  prefs non-zero): treated as fresh install → one window skipped, zero
  double-log — fails safe in the right direction.
- **Retention moved outside the mutex**: a crash between insert and prune
  leaves >30d rows for one extra tick. Harmless (F-03 retention mismatch is
  an explicit non-goal).
- **NSM sampling now inside the mutex**: a hung NSM query would hold the
  lock. Acceptable: ticks are ~15 min apart; the serialization is exactly
  what F-04's fix requires; queries already had try/catch guards.
- **prefs.lastTickEndMs is write-only in production now** (no reader). Kept
  per the issue contract's cache allowance; a future cleanup could drop it.
- **CI-only verification**: no local toolchain — compile/lint/green is
  expected on the next CI run (28 unit tests: 11 TickBookkeeper + 17
  existing, all expected green), not proven here.

## Deviations from the manifest plan

None material. Two smaller-than-allowed notes: (1) UsageLogDao needed NO
@Query additions — `latestEndMs()` already existed as dead code and became
the live source, so the "DAO adapts" step landed as a wrapper class instead
of DAO edits; (2) TickWorker.kt needed no edit — it already delegates to
SamplingEngine, which now routes through the bookkeeper, so the "worker goes
through the same path" requirement is met with a zero-diff file.
