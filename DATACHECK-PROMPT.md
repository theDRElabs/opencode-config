# DataCheck — New Session Prompt (M6: issues 003 + 004)

Read `/home/ubuntu/projects/data-check/AGENTS.md` and
`/home/ubuntu/projects/data-check/docs/BACKLOG-M6.md` first. The backlog is the
tracker of record; its ISSUE blocks are the contracts.

## Project

DataCheck is a personal-use Android app (Kotlin + Jetpack Compose) that tracks
mobile data usage per app (FG/BG), posts a notification ping every ~15
minutes, and keeps a full log. Sideloaded only, no Play Store. Fully offline
(no INTERNET permission).

**Repo:** private `theDRElabs/data-check`, branch `main`
**Local path:** `/home/ubuntu/projects/data-check`
**Build:** CI-only on GitHub Actions (no local JDK/SDK on this machine —
never run gradle/java locally). Commits/pushes REQUIRE explicit user approval
per AGENTS.md.

## Current State (end of previous session)

M1–M5 complete. M6 in progress: **ISSUE-001 and ISSUE-002 are done** (green
CI, fresh reviews PASS, evidence in `~/.config/opencode/runs/data-check/M6/`
— see `events.jsonl` and the per-issue attempt dirs; backlog statuses carry
run IDs and commit SHAs).

What exists now, on top of M1–M5:
- Signed release APK from CI: `datacheck-release-apk` artifact (~1.03 MB,
  hard 4 MiB size gate in the `release` job). Keystore committed at
  `keystore/` (PKCS12, passwords in `keystore/keystore.properties` — locked
  user decision).
- Validation card: Settings toggle (`showValidationCard`, default off) →
  dashboard card comparing NSM raw mobile total today vs sum of logged ticks
  today + delta, with error state on NSM failure. Logic in
  `data/Validation.kt`, unit-tested (`ValidationLogicTest`, 11 tests;
  TDD red/green runs recorded).
- Reviewer follow-up candidate (not yet an issue): engine midnight-window
  math in `SamplingEngine.rawMobileTotalTodayBytes` is untested — add to
  triage if the user wants.

## What To Do (this session)

Work the backlog per the sequential-afk-runner discipline (one issue at a
time: fresh implementer context → deterministic checks → fresh independent
reviewer; evidence under
`~/.config/opencode/runs/data-check/M6/<ISSUE>/attempt-N/`; append every
transition to `events.jsonl`; batch commits for user approval):

### ISSUE-003 — Write VALIDATION.md QA kit (ready; do first)
AFK, docs-only. Deliverable: `VALIDATION.md` at repo root containing:
- Day-long accuracy procedure: dashboard total vs Android Settings → Data
  usage, ±1% pass tolerance, and mismatch-attribution steps using the
  validation card (Settings → enable "Validation" toggle → read card: NSM
  raw vs logged-ticks delta tells our-sampling-bug vs system-level).
- Reboot test: reboot, wait one tick interval, ping resumes, totals
  reconcile from NSM.
- Sideload/upgrade steps using the signed `datacheck-release-apk` CI
  artifact (same signing identity → in-place upgrade).
- Results-recording template (date, figures, pass/fail per check).
Verification: procedures must match ACTUAL implemented behavior (read the
code, do not guess); no app code changes; CI stays green after the docs
commit. Fresh review against the ISSUE-003 block in the backlog.

### ISSUE-004 — Fresh-context review of existing Kotlin sources (ready)
AFK, strictly read-only. Deliverable: `docs/REVIEW-FINDINGS-M6.md` with
file:line evidence, severity, and suggested fix per finding. Covers
SamplingEngine, Scheduler/TickWorker/BootReceiver, PingNotifier,
DashboardScreen/SettingsScreen, CsvExporter, Room DB layer. Budget: stop
after 15 findings or one full pass. Findings are NOT implemented — the user
triages them (HITL). Locked decisions (WorkManager-only, mobile-only, the 4
permissions) are constraints, not findings.

003 and 004 are independent; 003 first is preferred because ISSUE-005
(on-device validation, HITL, owner: user) is blocked on it.

## Constraints (locked — do not reopen without user approval)

- Mobile data only, no Wi-Fi; WorkManager only, no exact alarms
- No INTERNET permission ever; exactly 4 permissions
- APK < 4 MB release; CI-only builds; keystore lives in-repo (decided)
- No new dependencies; no Room schema changes without migrations

## Session end

After 003+004 are done: update backlog statuses with evidence, commit docs
with user approval, and hand the user the ISSUE-005 on-device checklist
(their work) plus the ISSUE-004 findings for triage.
