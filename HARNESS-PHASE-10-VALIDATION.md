# Phase 10 Sequential AFK Runner Validation

Date: 2026-08-27
Status: COMPLETED - INDEPENDENTLY VERIFIED

## Rubric

| ID | Requirement | Evidence |
|---|---|---|
| A | The runner selects exactly one dependency-ready `afk` issue: `STATUS: ready`, `TYPE: afk`, known `COMMANDS`, every `BLOCKERS` entry `done`, lowest issue ID, and never selects `hitl`, `blocked`, or unknown-command work. | `fixtures/sequential-afk-runner/runner.mjs` selection loop; `test-runner.mjs` success, blockers, hitl cases |
| B | Each issue runs in a clean implementation context: a fresh adapter process per attempt with copied issue, input manifest, and isolated attempt directory. | `runner.mjs` attempt directory creation; adapter process spawns; `adapter.mjs` fresh-process context IDs |
| C | Completion requires all gates: implementation exit `0`, all deterministic checks exit `0`, and a fresh independent review artifact with `VERDICT: PASS`; `done` is never marked otherwise. | `runner.mjs` stage passing logic; `test-runner.mjs` failed-tests, review-findings, retry-exhaustion cases |
| D | Failed tests and review findings block completion, trigger at most two retries per issue, create durable follow-up issues from review findings, and fail closed to `blocked` when retries are exhausted. | `runner.mjs` retry and follow-up logic; `test-runner.mjs` failed-tests, review-findings, retry-exhaustion cases |
| E | HITL work and unresolved human gates stop the run with an explicit human-required stop reason; human ownership of acceptance, merge, deploy, and final decisions is preserved everywhere. | `runner.mjs` stop reasons; `test-runner.mjs` hitl case; `result.json` `humanAcceptance: false`; skill ownership boundary |
| F | Interruption (adapter exit `75`) preserves state exactly and `--resume` continues the unfinished stage without consuming another attempt. | `runner.mjs` interrupted stop and resume path; `test-runner.mjs` interruption case |
| G | An empty ready queue, blocked-only queue, iteration limit, dry run, and malformed input all produce explicit stop conditions; dry run mutates nothing and invokes no adapters. | `runner.mjs` stop conditions; `test-runner.mjs` empty, blockers, bounded, dry-run cases |
| H | Evidence is visible and durable: exclusive run lock, atomic state writes, `events.jsonl` log, per-attempt artifacts, adapter logs, and complete validation logs; validation is sequential. | `runner.mjs` lock, `writeAtomic`, `appendEvent`; `/tmp/opencode/p10-validation/logs/` |
| I | The workflow stays pull-based and bounded: skill, command, and orchestrator agent define entry requirements, adapter contract, retry limits, stop conditions, and human ownership without granting implementation or review powers to the orchestrator. | `skills/sequential-afk-runner/SKILL.md`; `commands/run-afk.md`; `agent/sequential-afk-runner.md` |

## Complete Source and Evidence Handoff

Every changed source path is listed in `/root/.config/opencode/HARNESS-PHASE-10-DIFF.md`. The
verifier must read that file and all files it lists. Selected excerpts are not substitutes for
the complete artifacts.

Generated evidence directory: `/tmp/opencode/p10-validation/logs/` containing `results.txt`,
`syntax-runner.log`, `syntax-adapter.log`, `syntax-shell.log`, and the complete
`scenarios.log` covering every fixture scenario.

## Sequential Validation Record

All checks run one at a time. No concurrent OpenCode processes are used.

1. Initial run: all syntax checks returned `0`; the scenario check returned `1` because the
   fixture adapter wrote its implementation result to the wrong argument path. One producer
   retry was consumed repairing the adapter argument mapping.
2. Authoritative run: syntax-runner, syntax-adapter, syntax-shell, and scenarios all returned
   `0`. Every fixture scenario passed: success, blockers, failed tests with recovery on retry,
   review findings with follow-up issue creation and recovery on retry, HITL stop,
   interruption and resumption, empty ready queue, dry run without mutation, iteration bound,
   and retry exhaustion failing closed to `blocked`.

The producer retry limit is two; one has been consumed.

## Independent Verification Protocol

Launch one fresh read-only verifier only after the authoritative runner passes. Give it only
this rubric, the complete source and evidence paths, the generated logs, and the Phase 10
completion gate. It must inspect direct artifacts and command evidence, not producer claims;
it must not edit files or run another OpenCode process. Any blocking finding or failed
required check keeps Phase 10 `in_progress`. At most two verifier attempts are allowed.

## Gate

Phase 10 remains `in_progress` until the authoritative checks pass and a fresh independent
verifier returns `PASS` with no blocking finding. Phase 11 remains `pending` and must not
start.

## Final Independent Verification Result

- The fresh verifier `ses_fb29a54b6ffe0kJsW1ccTZu93i` returned `PASS`.
- Blocking Findings: None.
- Non-Blocking Findings (recorded as follow-ups, none block the gate):
  1. `agent/sequential-afk-runner.md` enforces the no-implementation/no-review boundary by
     instructions and the adapter contract rather than permission hard-denial; Phase 11
     sandboxing is the designated structural fix.
  2. Malformed input fails closed through parse errors and nonzero exits, but has no
     dedicated fixture scenario; add one in a future pass.
     RESOLVED 2026-08-29: added the `malformed-input` fixture asserting nonzero exit, no
     `state.json`, and a byte-identical backlog; validation re-run exit `0`.
  3. Selection orders issue IDs with `localeCompare`, which relies on the schema's
     zero-padded `ISSUE-<nnn>` form; a numeric comparison would be more robust.
     RESOLVED 2026-08-29: selection, dry-run, and load ordering now use numeric ID
     comparison, proven by the new `numeric-ordering` fixture (`ISSUE-2` before
     `ISSUE-10`); validation re-run exit `0`.
  4. Roadmap tracker wording was reconciled at gate close.
- Rubric A-I: all `covered` with directly inspected evidence.
- Re-run evidence: the verifier independently re-ran
  `bash /root/.config/opencode/fixtures/sequential-afk-runner/run-validation.sh` and
  recorded exit `0` for syntax-runner, syntax-adapter, syntax-shell, and scenarios.
- Residual risks: fixture adapters simulate implementer/reviewer contexts rather than real
  OpenCode sessions (deferred to Phase 11+); a hard kill between review pass and `done`
  would resume by re-running review only, which re-verifies rather than skipping the gate;
  human acceptance, merge, and deploy remain human-owned.
- Phase 10 completion gate passed. Phase 10 is now `completed`. Phase 11 remains `pending`
  and was not started.
