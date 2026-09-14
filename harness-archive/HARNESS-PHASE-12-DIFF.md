# Phase 12 Complete Change Set

Every path changed or created for Phase 12 (Parallel Execution). The
verifier must read all of them.

## New files

- `/root/.config/opencode/fixtures/parallel-afk-runner/orchestrator.mjs` —
  the parallel AFK orchestrator: dependency-ready + output-independent batch
  selection (at most two, blocker-closure check), per-issue private backlog
  copies, concurrent Phase 10 runner processes each inside its own Phase 11
  issue sandbox (worktrees pre-created sequentially), reconciliation of
  per-copy statuses and follow-up issues, branch-diff file-overlap contention
  check with `COORDINATION:` opt-in, recorded unapproved human merge gates,
  `--authorize-merge` recording approval, sequential merge queue (one merge
  at a time, dedicated detached merge worktree, `--no-commit --no-ff`, full
  post-merge check before the commit lands via pinned `update-ref`),
  merge-conflict and post-merge-failure abort/block with evidence,
  protected-ref fail-closed checkpoint (outside movement of `main`/
  `production` revokes all gates and blocks every in-flight issue),
  interruption (exit 75) with exact resume, dry run, malformed-input
  fail-closed, exclusive run lock, atomic state writes, and the
  `events.jsonl` log. Positive git-subcommand allowlist with pinned `reset`
  /`update-ref`/`merge --abort` forms; no push/pull/fetch/remote/deploy code
  path exists.
- `/root/.config/opencode/fixtures/parallel-afk-runner/sandbox-stage-adapter.mjs`
  — wraps each runner stage in the Phase 11 sandbox (mirrors the Phase 11
  integration adapter; inner adapter path supplied via
  `SANDBOX_STAGE_ADAPTER`).
- `/root/.config/opencode/fixtures/parallel-afk-runner/parallel-adapter.mjs`
  — the sandboxed fixture adapter: implement (real worktree commits, genuine
  first-attempt red source for the failed-tests scenario, wall-clock pause
  for the concurrency proof), check (real `node --check` verification), and
  review (fresh-process verdict with seeded finding scenario), driven by
  `CONSTRAINTS: SCENARIO=...`.
- `/root/.config/opencode/fixtures/parallel-afk-runner/full-check.mjs` — the
  full post-merge check adapter running in the merge worktree: every `.mjs`/
  `.js` file must pass `node --check`, expected merged files must exist, and
  the `post-merge-failure` scenario simulates a full-suite regression only
  the merged combination exposes.
- `/root/.config/opencode/fixtures/parallel-afk-runner/test-orchestrator.mjs`
  — the adversarial scenario suite (15 groups): dry run, hitl-only stop,
  empty queue, happy path (concurrency proof, per-branch sandbox isolation
  and gates, no merge without the recorded gate, sequential gated merges,
  per-merge post-merge checks, merged content on `main`), retry exhaustion
  with sibling survival, state guard, malformed input, file-overlap
  contention deferral, coordinated merge conflict fail-closed, post-merge
  check failure abort, protected-ref fail-closed, interrupt/resume with
  sibling isolation and gate preservation, gate-preserving resume, sandbox
  scope containment.
- `/root/.config/opencode/fixtures/parallel-afk-runner/record.mjs` — the
  per-command evidence recorder (command array, cwd, environment provenance,
  started-at, duration, exit code, log path) replacing the buggy
  `record-run.sh` pattern; argv parsed by scanning, never by assumed
  positions (per the memory.md lesson).
- `/root/.config/opencode/fixtures/parallel-afk-runner/run-validation.sh` —
  sequential validation: syntax checks for all sources, namespace-free
  static check, no-remote-mutation and git-allowlist static assertions,
  CLI dry run with plan assertions, and the full scenario suite.
- `/root/.config/opencode/HARNESS-PHASE-12-VALIDATION.md` — this phase's
  validation artifact (rubric, handoff, records, residual risks, gate).
- `/root/.config/opencode/HARNESS-PHASE-12-DIFF.md` — this file.

## Modified files

- `/root/.config/opencode/HARNESS-ROADMAP.md` — Phase 12 tracker row set to
  `in_progress`; Phase 12 implementation record added to the phase log.

## Evidence directories (generated)

- `/tmp/opencode/p12-validation/logs/` — final validation logs and
  `results.txt` (all 13 checks exit 0).
- `/tmp/opencode/p12-validation/scenarios/` — per-scenario fixture repos,
  backlogs, and run trees with per-issue sandbox evidence, gates, merge
  worktrees, contention reports, and refs checkpoints.
- `/tmp/opencode/p12-validation-keep/` — authoritative per-command records
  (`p12-full-validation`, `p11-regression`, `p10-regression`,
  `config-resolution`), plus `records/` with the TDD consolidated record,
  the preserved pre-implementation stub (`orchestrator-stub-red.mjs`), the
  `repro/` bundle, and the re-reproduced cycle-1 red
  (`cycle1-red-reproduced.log` + record).

## Unchanged (regression-verified)

- `/root/.config/opencode/fixtures/issue-sandbox/` — Phase 11 sandbox
  validation re-run at exit `0` unchanged.
- `/root/.config/opencode/fixtures/sequential-afk-runner/` — Phase 10 runner
  validation re-run at exit `0` unchanged.
- `opencode debug config` re-run at exit `0` (apiKey values redacted in the
  retained log).
