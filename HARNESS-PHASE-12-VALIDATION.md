# Phase 12 Parallel Execution Validation

Date: 2026-09-04
Status: IN_PROGRESS — authoritative deterministic checks all pass; awaiting a
fresh independent verifier. Phase 12 remains `in_progress` until that
verifier returns `PASS` with no blocking findings.

## Environment Constraints (inherited, design-defining)

- No kernel namespaces (`unshare`, user/mount namespaces) — they corrupt the
  proot session on this device (incident 2026-08-29). The orchestrator is
  statically checked namespace-free; isolation is inherited from the Phase 11
  sandbox.
- No concurrent OpenCode processes. The parallelism under test lives in
  concurrent sandboxed node adapter processes spawned by the orchestrator;
  all validation runs sequentially, one command at a time.
- The orchestrator must not implement or review itself: it invokes the Phase
  10 runner and Phase 11 sandbox executables only (it has no LLM, no edit of
  issue content beyond status lines, and no review logic).

## Rubric

| ID | Requirement | Evidence |
|---|---|---|
| A | Selection: only dependency-ready `afk` issues (`STATUS: ready`, known `COMMANDS`, every blocker `done`) with genuine output-independent parallel branches (blocker-closure check), at most TWO concurrent sandboxed implementers, lowest IDs first, never `hitl`/`blocked`/unknown work. | `orchestrator.mjs` `selectBatch`/`parallelSafe`/`blockerClosure`; dry-run and hitl-only, empty-queue scenarios |
| B | Concurrency: two selected issues run concurrently as separate plain node runner processes, each inside its own Phase 11 issue sandbox (distinct `sandbox/<issue-id>` branch + worktree, distinct scopes, network denied, restricted-allowlist shell), pre-created sequentially so worktree creation never races. | `orchestrator.mjs` prepare phase; happy-path scenario asserts overlapping `runner_start`/`runner_end` timestamps, per-issue worktrees/policies/gates; `sandbox-leak` scenario asserts every fs scope stays inside the per-issue run dir |
| C | Independent review per branch after implement+check, BEFORE merge: Phase 10 runner gates (implementation exit 0, checks exit 0, `VERDICT: PASS`) inside the sandbox; no merge until every per-branch gate artifact exists. | happy path asserts per-issue `result.json` gates + `review.md` `VERDICT: PASS` before any `merge_started` event |
| D | Controlled merge orchestration: sequential merge queue (one merge at a time), full post-merge check run after each merge in a dedicated merge worktree, merge commit lands only after checks pass, recorded merge chain ends exactly at `main`. | `orchestrator.mjs` merge queue; happy path asserts merge order, per-merge `post_merge_check` events, first-parent chain `init -> merge 001 -> merge 002`, merged content on `main` |
| E | Merge/push/deploy human-gated: the orchestrator PREPARES an unapproved recorded gate (`humanApprovalRequiredFor: [merge, push, deploy]`, `approved: false`); NO merge executes without `--authorize-merge` recording approval (time, approver); push/pull/fetch/remote/deploy have no code path (positive git-subcommand allowlist, statically asserted). | `merge-gates/<id>.json`; happy path asserts zero merges without authorization; `run-validation.sh` `no-remote-mutation` + `git-allowlist` checks |
| F | File-overlap contention: uncoordinated branches touching the same files (branch-diff file-list overlap) defer the lower-priority issue — blocked with evidence, both branches intact; mutually coordinated overlap (declared in `COORDINATION:`) proceeds to the merge queue. | `file-overlap` scenario (ISSUE-002 deferred, shared-file evidence in `contention-report.json` + `deferred` event, ISSUE-001 merges); `merge-conflict` scenario gates for both coordinated issues |
| G | Merge conflict: conflicting fixture issues are deferred (marked blocked), the merge worktree is aborted and rolled back cleanly, conflict evidence is captured, and nothing is forced through. | `merge-conflict` scenario: ISSUE-002 `blockReason: merge_conflict`, `CONFLICT` in `merge-attempt.log`, aborted worktree clean and at `main`, branch unmutated, ISSUE-001 merged |
| H | Post-merge check failure: the merge is aborted (main unchanged), the issue is marked blocked fail-closed with evidence, and independent siblings still merge. | `post-merge-failure` scenario: ISSUE-001 `post_merge_check_failed`, `merge_aborted` event, worktree rolled back to base, ISSUE-002 merged |
| I | Protected-ref safety across concurrent worktrees: `main`/`production` never move except through the recorded human-gated merge chain; any outside movement fails ALL in-flight attempts closed (issues blocked, gates revoked, no merge executed). | `protected-refs` scenario: rogue commit on `main` between prepare and authorize → `protected_refs_mutated` stop, both issues `failed_closed_refs`/blocked, gates revoked, zero `merge_started`, `refs-checkpoint.json` evidence; happy path + every scenario asserts main's recorded chain |
| J | Retry exhaustion and resumability (inherited Phase 10 semantics): at most two retries inside the sandboxed runner; exhaustion blocks that issue while the independent sibling still completes and can merge; adapter exit 75 (interrupt) preserves exact mid-stage state, `--resume` completes the unfinished stage without consuming another attempt; settled siblings keep their prepared gates during interruption. | `retry-exhaustion` scenario (exit 1, ISSUE-001 blocked with `failure.json`, ISSUE-002 merges); `interrupt-resume` scenario (exit 75, runner state `interrupted`/stage `check`, resume completes review-only then both merge); `resume-gates` scenario (resume preserves gates byte-identically, no merge without authorization); `state-guard` (second run without `--resume` exits 2) |
| K | Dry-run mode: shows the selected parallel set (ids, branches, parallel-safety), the merge plan, and the human gates; invokes no adapters and mutates nothing. | `dry-run` scenario (backlog byte-identical, no run dir) + `run-validation.sh` `cli-dry-run`/`cli-dry-run-plan` checks |
| L | Explicit stop conditions: retries exhausted, merge conflict, post-merge check failure, contention, protected-ref mutation, interruption, human-required queue, blocked queue, empty queue, iteration-less guard, malformed input fail-closed, exclusive run lock. | scenarios above + `malformed-input` (exit 2, no state, byte-identical backlog), lock in `orchestrator.mjs` |
| M | Evidence durable and visible: atomic state writes, `events.jsonl` event log (selected, runner_start/end, reconciled, deferred, gate_prepared, merge_authorized, merge_started, post_merge_check, merge_completed/aborted, fail_closed, stop), per-issue attempt artifacts from the Phase 11 sandbox, contention report, refs checkpoint, per-command records with cwd/env provenance/duration/exit code. | fixture run trees under `/tmp/opencode/p12-validation/scenarios/`; records under `/tmp/opencode/p12-validation-keep/` |

## Complete Source and Evidence Handoff

Every changed source path is listed in `/root/.config/opencode/HARNESS-PHASE-12-DIFF.md`.
The verifier must read that file and all files it lists. Selected excerpts are
not substitutes for the complete artifacts.

Generated evidence:

- `/tmp/opencode/p12-validation/logs/` — final validation results.txt and
  per-check logs including the complete `scenarios.log` (all 15 scenario
  groups).
- `/tmp/opencode/p12-validation/scenarios/` — fixture repos, backlogs, run
  directories with per-issue sandbox evidence (policies, deny logs, diffs,
  reviews, gates), merge worktrees, contention reports, refs checkpoints.
- `/tmp/opencode/p12-validation-keep/` — authoritative per-command records
  (`*.record.json` with command, cwd, environment provenance, duration, exit
  code, log path) for the p12 full validation, p11 regression, p10
  regression, and `opencode debug config`; plus `records/` with the TDD
  red/green consolidated record, the reproducible cycle-1 red
  (`orchestrator-stub-red.mjs`, `repro/`, `cycle1-red-reproduced.log`).

## Sequential Validation Record

All checks ran one at a time. No concurrent OpenCode processes were used;
the only parallelism was inside the orchestrator under test (spawned node
adapter processes).

1. TDD cycle 1 (selection, dry run, queue stops, happy path, retry
   exhaustion, state guards): genuine red against the argument-parser-only
   stub (`dry run stop reason wrong: not_implemented`, exit 1, recorded).
   Fix iterations (full details in `records/README.md`): exec-bit on the
   stage adapter (implementation), merge-history assertion corrections
   (test), `--max-retries 0` in the exhaustion scenario (test), the Node 24
   `node --check` ESM quirk discovery → `.mjs` sources (real), stop-reason
   precedence — blocked outranks pending gate (implementation). Green: exit
   0, 62.5s.
2. TDD cycle 2 (contention, conflict, post-merge failure, protected refs):
   genuine red (`file-overlap` expected exit 1, got 0 — no contention policy
   existed). Implemented contention deferral with `COORDINATION:` opt-in,
   merge-conflict abort/block, post-merge-failure abort/block, and the
   protected-ref fail-closed checkpoint with gate revocation. Green: exit 0,
   172.7s.
3. TDD cycle 3 (interrupt/resume, gate-preserving resume, sandbox scope
   containment): genuine red (exit-75 runner crashed the reconcile). Fixes:
   interrupted issues stay resumable; settled siblings keep their gates
   during interruption; the prepare block re-enters on the `interrupted`
   phase. Green: exit 0, 403.5s.
4. Authoritative full validation: `bash run-validation.sh` exit `0` —
   syntax-orchestrator, syntax-test, syntax-adapter, syntax-stage-adapter,
   syntax-full-check, syntax-record, syntax-shell, namespace-free,
   no-remote-mutation, git-allowlist, cli-dry-run, cli-dry-run-plan,
   scenarios (215s), all `0`.
5. Phase 11 regression: `bash /root/.config/opencode/fixtures/issue-sandbox/run-validation.sh`
   exit `0` (unchanged sources).
6. Phase 10 regression: `bash /root/.config/opencode/fixtures/sequential-afk-runner/run-validation.sh`
   exit `0` (unchanged sources).
7. `opencode debug config` exit `0` (apiKey values redacted from the
   retained log).

Producer retry accounting: cycles 2 and 3 each consumed within the
two-retry budget (cycle 2: red→green in one step; cycle 3: two
implementation fixes). Cycle 1 exceeded the budget across five fix
iterations — two implementation defects, one real design discovery, two
test-assertion corrections — documented in `records/README.md` for
transparency.

Evidence-placement incident: the original cycle record JSONs were destroyed
by the final validation script's `rm -rf` of its own evidence directory
before they were moved out. The consolidated record was reconstructed
byte-accurately from the session-observed `record.mjs` outputs, and the
cycle-1 red was additionally re-reproduced genuinely against the preserved
stub (`records/orchestrator-stub-red.mjs`, exit 1, identical failure
signature). No other evidence was affected; all final-run artifacts are
originals.

## Design Notes

- Per-issue private backlog copies: each concurrent issue gets its own
  backlog copy in which the OTHER batch members are `in_progress`, so the
  Phase 10 runner (unchanged) selects exactly its own issue. Follow-up
  issues created inside a copy are reconciled back to the shared backlog
  under fresh non-colliding IDs.
- The orchestrator's git surface is a positive allowlist
  (`rev-parse, worktree, merge, commit, status, diff, log, update-ref,
  reset`) with `reset` pinned to `--hard HEAD` (merge-worktree rollback),
  `update-ref` pinned to `refs/heads/main` (landing a gated merge commit),
  and `merge --abort` pinned to conflict rollback. `push`/`pull`/`fetch`/
  `remote`/deploy cannot appear by construction; statically asserted in
  validation.
- Merges happen in a dedicated detached merge worktree at the recorded
  expected `main` commit, with `--no-commit --no-ff`; the full check runs on
  the merged tree; only a passing check produces a commit, which lands via
  `update-ref`. `main`'s primary worktree is never checked out anywhere.
- Human gate mirroring: `merge-gates/<id>.json` mirrors `sandbox-context.json`'s
  `humanApprovalRequiredFor` recording; approval is written only by
  `--authorize-merge` with timestamp and approver.

## Residual Risks

- Concurrency proof is timestamp-based (overlapping `runner_start`/`runner_end`
  from the orchestrator's own event log, plus a wall-clock pause inside the
  sandboxed implementer). It proves overlap of the two runner processes, not
  lock-step simultaneous CPU execution (single-core phone).
- The orchestrator trusts the Phase 10 runner and Phase 11 sandbox
  executables as configured; a hostile `--stage-adapter`/`--sandbox-adapter`
  override could run arbitrary code with orchestrator privileges. The
  defaults are fixture-local; production use must pin these paths
  (inherited trust-boundary risk, same class as Phase 11 adapter commands).
- Fixture adapters simulate implementer/reviewer contexts rather than real
  OpenCode sessions (inherited from Phases 10/11).
- Merge conflict detection relies on git's conflict exit; semantic conflicts
  (both branches compile but interact wrongly) are only caught if the full
  post-merge check set exercises the interaction. The fixture full check is
  `node --check` + file presence; real projects need their real full check
  (per the Phase 5 project-feedback contract).
- The `COORDINATION:` opt-in trusts the issue schema's declaration; a wrong
  declaration surfaces as a merge conflict at worst (fail-closed), never as
  silent corruption.
- Protected-ref safety covers `main` and `production` (Phase 11 set). Other
  refs are not protected.
- `state.json` is written atomically but is not fsync'd; a hard power loss
  mid-write could leave it stale (same class as Phase 10).
- Human ownership unchanged: a sandbox `done` or an orchestrator `merged`
  status is not human acceptance; push and deploy remain human-only with no
  code path here.

## Independent Verification Protocol

Launch one fresh read-only verifier only after the authoritative runs pass.
Give it this rubric, `HARNESS-PHASE-12-DIFF.md`, the complete source and
evidence paths, and the Phase 12 completion gate. It must inspect direct
artifacts and command evidence, not producer claims; it must not edit files
or spawn another OpenCode process. It may re-run
`bash /root/.config/opencode/fixtures/parallel-afk-runner/run-validation.sh`
(long: the scenario suite takes ~4 minutes on this device) and the
reproducible cycle-1 red. Any blocking finding or failed required check
keeps Phase 12 `in_progress`. At most two verifier attempts are allowed
before escalation to the user.

## Gate

Phase 12 remains `in_progress` until a fresh independent verifier returns
`PASS` with no blocking findings. Phase 13 remains `pending` and must not
start.
