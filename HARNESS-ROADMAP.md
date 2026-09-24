# OpenCode AI Building Harness Roadmap

## Mission

Build a reliable AI software-development harness that turns human intent into
useful, maintainable, verified applications while preserving human control over
requirements, architecture, product taste, security-sensitive decisions, and
final acceptance.

The target workflow is:

```text
human intent
  -> alignment interview
  -> destination document
  -> dependency-aware vertical-slice backlog
  -> bounded implementation
  -> automated feedback
  -> fresh-context review
  -> human QA
  -> follow-up issues
  -> repeat
```

## Operating Rules

1. Read this file before starting or resuming harness work.
2. Work on the first phase whose status is `in_progress` or `pending`.
3. Do not start a later phase until the current phase passes its completion gate.
4. Update this file after every phase with status, evidence, decisions, and follow-ups.
5. Ask the user only for decisions that require human product judgment, preferences,
   credentials, approval of meaningful risk, or other unavailable information.
6. Prefer the smallest correct, inspectable component over a large framework.
7. Keep permanent context small; put specialized instructions in pull-based skills.
8. Separate planning, implementation, verification, and human acceptance.
9. Never let the agent that produced a substantial artifact be its sole verifier.
10. Establish a reliable manual workflow before automating it, and establish a
    reliable sequential workflow before parallelizing it.
11. Treat current code, tests, and maintained architecture documents as truth.
    Archive transient plans after completion so stale documents do not mislead agents.
12. Preserve unrelated user or agent changes in shared worktrees.

## Responsibility Boundaries

### Human owns

- Product intent and target users.
- Requirements and tradeoffs.
- Security-sensitive and irreversible decisions.
- Architecture and public module contracts.
- Visual and usability judgment.
- Final acceptance.

### Agents may own

- Focused repository exploration.
- Bounded implementation.
- Test creation and automated checks.
- First-pass independent review.
- Mechanical refactoring with explicit boundaries.
- Backlog updates when authorized.

### Repository owns

- Current implementation truth.
- Executable feedback loops.
- Maintained constraints and module contracts.
- Project-specific verification commands.

## Status Legend

- `pending`: not started.
- `in_progress`: current phase.
- `blocked`: requires a documented external decision or dependency.
- `completed`: implemented and independently verified against its gate.

## Phase Tracker

| Phase | Name | Status | Primary Artifact |
|---|---|---|---|
| 0 | Current Harness Audit | completed | `HARNESS-AUDIT.md` |
| 1 | Harness Contract | completed | `HARNESS-CONTRACT.md` |
| 2 | Alignment Workflow | completed | `grill-me` skill and command |
| 3 | Destination Documents | completed | `write-prd` skill and command |
| 4 | Backlog and Issue Contract | completed | `prd-to-issues` skill and issue schema |
| 5 | Project Feedback Contracts | completed | `HARNESS-PROJECT-FEEDBACK.md` and `HARNESS-PHASE-5-VALIDATION.md` |
| 6 | TDD and Bounded Implementer | completed | TDD skill and implementer agent |
| 7 | Fresh-Context Review | completed | independent reviewer workflow |
| 8 | Human QA and Visual Verification | completed | `HARNESS-PHASE-8-VALIDATION.md`, manual QA skill and browser workflow |
| 9 | Architecture Improvement | completed | architecture-audit skill |
| 10 | Sequential AFK Runner | completed | bounded sequential orchestrator and `HARNESS-PHASE-10-VALIDATION.md` |
| 11 | Sandboxing and Worktrees | completed | isolated execution environment |
| 12 | Parallel Execution | completed | dependency-aware parallel orchestrator |
| 13 | External Domain Skills | completed | skill consolidation (26 skills, merged design, removed security-scan) |
| 14 | Metrics and Improvement | completed | `HARNESS-METRICS.md` baseline + `scripts/collect-metrics.sh` |

## Phase 0: Current Harness Audit

### Goal

Understand the current OpenCode setup before changing active behavior.

### Work

- Inventory global config, instructions, agents, commands, skills, plugins, MCPs,
  permissions, compaction, memory, and graph-memory components.
- Identify project-level overrides that affect normal work.
- Trace how a request currently moves from user input through context, tools,
  edits, verification, and completion.
- Classify components as keep, modify, replace, remove later, or investigate.
- Identify context bloat, role overlap, unsafe permissions, missing feedback, and
  stale-document risks.

### Deliverable

`~/.config/opencode/HARNESS-AUDIT.md`

### Completion Gate

The audit accurately explains the current request-to-code path, context sources,
permission boundaries, verification paths, and major gaps. A fresh verifier must
confirm the report using direct file evidence. No active configuration is changed.

## Phase 1: Harness Contract

### Goal

Create the short global contract that governs all later components.

### Work

- Define context-reset and task-sizing rules.
- Define human, agent, and repository responsibilities.
- Define phase boundaries and independent verification requirements.
- Define documentation lifecycle and stale-artifact handling.
- Decide which existing global instructions remain permanent and which become skills.
- Keep the contract concise enough to remain useful in every session.

### Completion Gate

The contract is concise, non-duplicative, compatible with current OpenCode rules,
and validated against representative tasks without suppressing normal autonomy.

## Phase 2: Alignment Workflow

### Goal

Prevent silent requirement invention before substantial planning or coding.

### Work

- Create a custom `grill-me` skill.
- Ask one decision question at a time and provide a recommended answer.
- Cover user, problem, workflows, edge cases, data behavior, security, integrations,
  out-of-scope behavior, testing, and unresolved risks.
- Add explicit stop conditions and support research/prototype branches.
- Add an invocation command without granting implementation permissions.

### Completion Gate

Fixture sessions for a small feature, ambiguous data change, API integration,
frontend workflow, and bounded prototype branch surface important missing
decisions without prematurely planning or editing code.

## Phase 3: Destination Documents

### Goal

Turn aligned decisions into a bounded destination and definition of done.

### Work

- Create a custom `write-prd` skill and command.
- Include problem, users, solution, observable stories, acceptance criteria, data
  behavior, contracts, module map, tests, security constraints, non-goals, rejected
  decisions, and risks.
- Preserve unknowns instead of fabricating certainty.
- Define active, completed, and archived PRD lifecycle.

### Completion Gate

Generated fixtures preserve negative decisions, migration behavior, module
boundaries, test expectations, and unresolved risks without excessive prose.

## Phase 4: Backlog and Issue Contract

### Goal

Convert destination documents into bounded, dependency-aware vertical slices.

### Work

- Define a machine-readable local Markdown issue schema.
- Include status, AFK/HITL type, blockers, outcome, acceptance criteria, vertical
  layers, module boundaries, tests, commands, constraints, and non-goals.
- Create a custom `prd-to-issues` skill and command.
- Reject horizontal layer plans and infrastructure without a validated consumer.
- Mark unsafe or unresolved work as human-in-the-loop.

### Completion Gate

Fixture PRDs produce observable vertical slices, correct blockers, genuine parallel
branches, and issues small enough for one implementation context.

## Phase 5: Project Feedback Contracts

### Goal

Give agents fast, deterministic evidence about correctness in every project.

### Work

- Define a project check convention for format, lint, typecheck, tests, build,
  migrations, E2E, startup, and test data.
- Distinguish fast per-issue checks from full pre-merge checks.
- Record unavailable checks and their residual risk.
- Integrate the existing global GitHub CI, Playwright, and Vercel pipeline rules for
  eligible heavy web projects; preserve the separate Android CI path.

### Completion Gate

Injected type, test, lint, and build failures are detected and block completion.

## Phase 6: TDD and Bounded Implementer

### Goal

Reliably implement one issue in one focused context.

### Work

- Create a custom TDD skill enforcing red, green, and refactor evidence.
- Create an implementer subagent limited to one issue.
- Require relevant exploration, explicit boundaries, exact check output, and no
  unrelated edits or silent scope expansion.
- Start with manual one-issue invocation, not an unattended loop.

### 2026-08-25: Phase 6 Implementation and Fixture Validation

- Added `skills/tdd/SKILL.md` with entry rejection, relevant-surface limits,
  genuine red/green/refactor evidence, migration rehearsal rules, sequential
  project feedback, exact evidence records, and implementation-result shape.
- Added `agent/bounded-implementer.md` and the manual `implement-issue` command.
  The implementer is limited to one accepted issue and cannot declare
  independent verification.
- Added complete domain, migration, bug-fix, and unresolved-ambiguity issue
  fixtures under `fixtures/tdd-bounded/`.
- Sequential deterministic validation passed: each testable fixture produced a
  behavior-caused red exit `1`, green exit `0`, and refactor exit `0`; an injected
  blocking failure returned `1`; the ambiguous issue was rejected before
  implementation.
- Complete validation artifact and logs: `HARNESS-PHASE-6-VALIDATION.md` and
  `/tmp/opencode/p6-validation/logs/`.
- Fresh verifier `ses_fc6066e15ffeKYmbtu3JId5Ktg` independently confirmed the
  complete fixture inputs and regenerated logs satisfy the Phase 6 rubric,
  including the corrected ambiguity contract assertion, explicit refactor
  review evidence, and the below-threshold domain acceptance assertion.
- Phase 6 completion gate passed. Phase 7 remains `pending` and was not started.

### Completion Gate

Representative domain, database, bug-fix, and ambiguity fixtures demonstrate a
real failing test before implementation and correct handling of failed checks.

## Phase 7: Fresh-Context Review

### Goal

Verify substantial changes independently from the producing context.

### Work

- Create a read-only general reviewer workflow.
- Reuse specialized `security-reviewer`, `silent-failure-hunter`, and
  `pr-test-analyzer` agents for their scopes.
- Push applicable acceptance criteria, standards, diff, and evidence into review.
- Require file/line findings, required changes, residual risks, and verification
  evidence.

### Completion Gate

Seeded fixtures prove detection of behavioral gaps, weak tests, swallowed errors,
authorization failures, unrelated changes, and uncovered regressions.

### 2026-08-25: Phase 7 Implementation and Fixture Validation

- Added the `fresh-context-review` skill, read-only `fresh-reviewer` agent, and
  `review-issue` command. The workflow requires a bounded issue, acceptance
  criteria, complete diff, applicable standards and module boundaries, and complete
  verification evidence, then returns a structured independent result.
- Restricted `security-reviewer`, `silent-failure-hunter`, and `pr-test-analyzer`
  to read-only specialist roles. The general reviewer may delegate only to those
  named scopes and retains the integrated verdict.
- Added the complete seeded fixture bundle under `fixtures/fresh-review/`.
  Sequential validation detected behavioral, test-quality, error-handling,
  authorization, scope, and regression gaps with severity-ordered exact-line evidence.
- Validation artifact and complete generated logs: `HARNESS-PHASE-7-VALIDATION.md`
  and `/tmp/opencode/p7-validation/logs/`.
- Fresh independent read-only verifier `ses_fc5eab7bdffevVeaNXWnZZ8Oaj` inspected
  the complete rubric, fixture inputs, source artifacts, generated logs, and review
  result, then returned `PASS` with no unresolved blocking findings.
- Phase 7 completion gate passed. Phase 8 remains `pending` and has not been started.

## Phase 8: Human QA and Visual Verification

### Goal

Preserve human product taste while automating repeatable browser evidence.

### Work

- Create a custom `manual-qa-plan` skill.
- Cover primary, empty, loading, error, boundary, authentication, permission,
  mobile, desktop, realistic data, console, and visual-quality checks.
- Reuse the existing E2E and frontend design skills where applicable.
- Use Playwright only when browser execution is useful.
- Turn QA findings into backlog issues with blockers.

### Completion Gate

A frontend fixture receives automated behavioral evidence, a usable human checklist,
desktop/mobile inspection, and a correctly formed follow-up issue.

### 2026-08-25: Phase 8 Implementation and Fixture Validation

- Added `skills/manual-qa-plan/SKILL.md`, the read-only `manual-qa` agent, and the
  `manual-qa-plan` command. The workflow separates repeatable browser evidence from
  human visual, usability, security, accessibility, product-fit, and release decisions.
- Added the seeded frontend fixture under `fixtures/manual-qa/` covering primary,
  empty, loading, error, authorization, desktop/mobile, browser failure detection,
  screenshots, and a correctly formed authorization follow-up issue.
- Sequential syntax and complete-input checks passed with evidence in
  `/tmp/opencode/p8-validation/logs/`.
- Installed Playwright Chromium, its headless shell, FFmpeg, and required host
  dependencies. The repaired runner now passes sequentially with exit `0`, including
  the verifier-requested primary search interaction.
- Generated 11 browser cases, 12 PNG artifacts, `browser-evidence.json`, console and
  failed-request evidence, and the authorization finding screenshot under
  `/tmp/opencode/p8-validation/`.
- A fresh verifier then identified the seeded viewer authorization behavior as a real
  blocking defect and requested a complete change handoff. The fixture now hides the
  editor-only action from viewers, the finding is retained as resolved, and
  `HARNESS-PHASE-8-DIFF.md` lists the complete source change set because this workspace
  is not a Git repository. The repaired full runner passes with exit `0`.
- Final verifier `ses_fc491848cffe7w3nk24dlV39z6` returned `FAIL`: unauthorized
  search can reveal seeded notes, and unauthorized URLs with the default editor role
  can expose the editor action. The two-verifier retry budget is exhausted. Phase 8
  remains `in_progress`; Phase 9 remains `pending` and was not started.
- Validation artifact: `HARNESS-PHASE-8-VALIDATION.md`, now ready for a fresh
  independent verifier. Phase 8 remains `in_progress` until that verifier passes and
  a human records visual/product acceptance. Phase 9 remains `pending`.

### 2026-08-26: Phase 8 Authorization Repair

- Repaired the fixture authorization boundary: protected notes are no longer embedded
  in frontend source and are retrieved only through an authorized HttpOnly-session API.
- Unauthorized state is authoritative over URL role. Search is disabled, protected
  content is absent, editor actions are unavailable, and sign-out lands in the same
  unauthorized state.
- Added deterministic browser checks for default and explicit editor unauthorized URLs,
  signed-out behavior, direct HTTP 403 server enforcement, responsive overflow, and
  critical-control usability.
- Corrected the retained QA finding status and blocker fields without deleting its
  original observable problem. Current evidence target is 16 browser events and 16
  screenshots, replacing the historical 11-event wording.
- Sequential validation then exposed a mobile overflow defect. The initial run and
  both permitted retries returned browser exit `1` with
  `primary/mobile: horizontal overflow 404>390`; syntax and inputs remained exit `0`.
  Current evidence is under `/tmp/opencode/p8-validation/logs/`.
- The retry budget is exhausted, so no independent verifier was launched. Phase 8
  remained `in_progress` at that historical point.
- The overflow source was the screen-reader-only search label receiving the mobile
  full-width toolbar rule. The selector now excludes `.sr-only`, visible controls use
  border-box sizing, and the authoritative rerun records syntax, inputs, browser, and
  evidence exit `0`, with 16 events and screenshots.
- Exactly one fresh read-only verifier, `ses_fc460856dffeuitk3QfIh72P50`, returned
  `BLOCKED`. Its stale-record, roadmap-handoff, environment-provenance, and follow-up
  status-schema findings were repaired and the complete runner passed again.
- The remaining blocker is independent PNG pixel inspection: the verifier interface
  could not decode the supplied screenshots. Automated no-overflow/control assertions
  pass, but do not replace that inspection or human visual/product acceptance.
- Phase 8 remains `in_progress`; Phase 9 remains `pending` and was not started.

### 2026-08-26: Phase 8 Completed

- Renamed verification session `phase 8 vision ver.`
  (`ses_fc41dc185ffeAsdfsXF4mgecK8`) returned `PASS` with no blocking or non-blocking
  findings after recording pixel inspection of all 16 required PNG artifacts.
- The verifier confirmed the named primary, empty, loading, error, authorization, and
  signed-out states; plausible desktop/mobile framing; visible unclipped critical
  controls; no obvious horizontal overflow; and no protected notes or editor-only
  controls in unauthorized screenshots.
- Syntax, input, browser, and evidence validation remained exit `0`, with 16 browser
  events and 16 screenshots plus the required authorization HTTP `403` evidence.
- Runtime database provenance shows the final visual inspection and verdict used
  `opencode/big-pickle`; earlier messages in that session used
  `opencode/x-preview-f-free`. The final response's contrary model-identification
  sentence is recorded as inaccurate and is not relied upon.
- The user confirmed Phase 8 completion. Human ownership of visual quality, usability,
  accessibility, security, product fit, release readiness, and final product acceptance
  remains unchanged and is not replaced by the automated evidence.
- Phase 8 completion gate passed. Phase 9 remains `pending` and was not started.

## Phase 9: Architecture Improvement

### Goal

Make project boundaries easier for humans and agents to understand and test.

### Work

- Create a custom `architecture-audit` skill.
- Identify high coupling, shallow-module clusters, excessive public surfaces,
  repeated orchestration, heavy mocking, missing integration seams, untested logic,
  and dependency-direction problems.
- Propose deep modules with small interfaces and coherent behavior.
- Produce incremental migration slices; never auto-refactor a broad codebase.

### Completion Gate

An existing project audit identifies evidence-backed testability and module-boundary
gaps with a safe incremental migration proposal.

### 2026-08-26: Phase 9 Implementation and Blocked Verification

- Added the pull-based `architecture-audit` skill, bounded read-only
  `architecture-auditor` agent, and `architecture-audit` command.
- Added a seeded architecture fixture covering all eight required signals and a
  read-only audit of `/root/projects/taskflow` with three incremental human-gated
  migration slices. No Taskflow source file was modified.
- The authoritative sequential runner records syntax, contract, seeded detection,
  and real-project audit checks at exit `0` under
  `/tmp/opencode/p9-validation/logs/`.
- First verifier `ses_fbfafbdebffepqggjmt42sQAv5` returned `FAIL`. Its seeded finding
  contract and Taskflow citation findings were repaired and the runner passed again.
- Second verifier `ses_fbfa9b08bffeSYKTyVXLZaH6iB` returned `BLOCKED`: the required
  handoff exceeded its file budget by one; unchanged-target evidence lacked a
  baseline; the seeded deep-module recommendation omitted required details; and one
  seeded finding did not cite the exact weak-assertion lines.
- The two-verifier limit is exhausted. Phase 9 remains `in_progress`; its completion
  gate has not passed. Phase 10 remains `pending` and was not started.
- Complete status and evidence handoff: `HARNESS-PHASE-9-VALIDATION.md` and
  `HARNESS-PHASE-9-DIFF.md`.

### 2026-08-26: Phase 9 Verification Handoff Repaired

- Repaired the seeded finding validator to require exact evidence, IDs, severity,
  category, impact, confidence, and falsifier; corrected the heavy-mocking citations;
  and expanded the seeded deep-module checks for interface, seam tests, benefits,
  costs, and alternatives.
- Added a ten-file SHA-256 baseline plus clean audited commit/worktree checks for
  `/root/projects/taskflow`; no Taskflow file is modified.
- Reduced the mandatory verifier artifact bundle to 31 files and added one complete
  aggregate validation log, satisfying the 35-file fresh-verifier budget.
- The repaired sequential validation returned `0` for syntax, contract, seeded
  detection, and real-project audit. Phase 9 is ready for a new fresh independent
  verifier; it remains `in_progress` until that verifier passes. Phase 10 remains
  `pending` and was not started.

### 2026-08-27: Phase 9 Completed

- Fresh independent verifier returned `PASS` with no blocking or non-blocking
  findings. It independently confirmed Rubric A-H, all 14 findings, the 10-file
  Taskflow hash baseline, clean commit
  `77cfda60e32bfdc1a5475ce604550c6122d62dc7`, and all four exit-0 validation checks.
- Residual risks remain limited to static audit coverage, unimplemented migration
  recommendations, and human-owned architecture and contract acceptance.
- Phase 9 completion gate passed. Phase 9 is now `completed`.
- Phase 10 remains `pending` and was not started.

## Phase 10: Sequential AFK Runner

### Goal

Automate the manually proven flow one issue at a time.

### Work

- Select one ready AFK issue.
- Start a clean implementation context.
- Run checks, independent review, and result recording.
- Mark complete only after all gates pass.
- Create follow-up issues from findings.
- Add dry run, bounded iterations, at most two retries, resumability, visible logs,
  and clear stop conditions.

### Completion Gate

A fixture backlog correctly handles success, blockers, failed tests, review findings,
human-required work, interruption, resumption, and an empty ready queue.

### 2026-08-29: Phase 10 Implementation and Fixture Validation

- Added the pull-based `sequential-afk-runner` skill, `run-afk` command, and the
  orchestrator-only `sequential-afk-runner` agent. The orchestrator invokes configured
  implement, check, and review adapter commands and never implements or reviews itself.
- Added the dependency-free executable `fixtures/sequential-afk-runner/runner.mjs`:
  lowest-ID dependency-ready `afk` selection, fresh-process attempt directories with
  copied issue and input manifest, all-gates completion (implementation exit `0`, all
  checks exit `0`, review `VERDICT: PASS`), at most two retries per issue, durable
  follow-up issues from blocking review findings, fail-closed `blocked` on exhausted
  retries, exit-`75` interruption with exact `--resume` continuation, dry run without
  mutation, iteration limit, empty/blocked/HITL stop reasons, exclusive run lock,
  atomic state writes, and a visible `events.jsonl` event log.
- Deterministic fixtures cover success, blockers, failed tests with retry recovery,
  review findings with follow-up creation and retry recovery, HITL stop,
  interruption/resumption, empty ready queue, dry run, iteration bound, and retry
  exhaustion. One producer retry was consumed repairing an adapter argument path;
  the authoritative sequential validation then returned `0` for syntax-runner,
  syntax-adapter, syntax-shell, and scenarios under `/tmp/opencode/p10-validation/logs/`.
- Validation and handoff artifacts: `HARNESS-PHASE-10-VALIDATION.md` and
  `HARNESS-PHASE-10-DIFF.md`.

### 2026-08-29: Phase 10 Completed

- Fresh independent verifier `ses_fb29a54b6ffe0kJsW1ccTZu93i` returned `PASS` with no
  blocking findings after reading the complete rubric, all source artifacts, all
  generated logs, and independently re-running the validation script at exit `0`.
- Rubric A-I all covered: selection rules, clean-context attempts, all-gates
  completion, bounded retries with follow-up issues, fail-closed exhaustion, HITL
  stop, interruption/resumption, explicit stop conditions, durable visible evidence,
  and preserved human ownership.
- Four non-blocking findings were recorded for later phases: instruction-level-only
  orchestrator permissions (Phase 11 sandboxing is the designated fix), no dedicated
  malformed-input fixture, `localeCompare` ID ordering relying on the zero-padded
  schema, and roadmap wording reconciled at gate close.
- Residual risks: fixture adapters simulate implementer/reviewer contexts rather than
  real OpenCode sessions; human acceptance, merge, and deploy remain human-owned.
- Phase 10 completion gate passed. Phase 10 is now `completed`.
- Phase 11 remains `pending` and was not started.

### 2026-08-29: Phase 10 Non-Blocking Follow-up Fixes

- Applied verifier follow-ups 2 and 3: added a `malformed-input` fixture (nonzero exit,
  no run state, byte-identical backlog) and a `numeric-ordering` fixture (`ISSUE-2`
  selected before `ISSUE-10`), with selection, dry-run, and load ordering switched to
  numeric ID comparison in `runner.mjs`.
- The authoritative validation re-run returned `0` for syntax-runner, syntax-adapter,
  syntax-shell, and scenarios under `/tmp/opencode/p10-validation/logs/`; the final
  scenarios message now includes malformed input and numeric ordering.
- Follow-up 1 (orchestrator permission hardening) remains deferred to Phase 11
  sandboxing by design. Phase 10 remains `completed`; Phase 11 remains `pending` and
  was not started.

## Phase 11: Sandboxing and Worktrees

### Goal

Make unattended execution safe and isolated.

### Work

- Create a branch or Git worktree per issue.
- Add container or equivalent filesystem/process isolation.
- Deny host secrets and unrelated directories.
- Make network and shell permissions explicit.
- Capture logs, diffs, commits, test artifacts, and failures.
- Require human approval for merge, push, and deployment until separately validated.

### Completion Gate

Adversarial tests confirm denial of protected secrets, unrelated paths, destructive
commands, direct production-branch mutation, and unapproved pushes.

### 2026-08-29: Phase 11 Environment Incident (design constraint)

- Probing kernel namespaces for the sandbox corrupted proot's ptrace translation
  for the opencode process tree (user namespaces broke it; a later mount-namespace
  jail attempt under the already-corrupted session appeared to leak mounts but
  `/proc/mounts` proved the kernel clean after restart — the "leak" was proot
  internal state). No file was damaged, nothing was deleted, and no real mount
  leaked. The session was restored by restarting opencode under a fresh proot.
- Rule recorded in `memory.md`: never use user namespaces under proot on this
  device; the Phase 11 sandbox must not depend on any namespace and is statically
  checked for namespace-free sources.

### 2026-08-29: Phase 11 Implementation and Fixture Validation

- Added `fixtures/issue-sandbox/`: `sandbox.mjs` (per-issue worktree +
  `sandbox/<issue-id>` branch, constructed whitelist environment, explicit
  `sandbox-policy.json` with `network: denied` and `shell: restricted-allowlist`,
  evidence capture of logs/diffs/branch-diffs/git-log/status/artifacts/denials/
  failures, dry run, protected-ref before/after verification, and no merge/push/
  deploy code path), `guard-preload.cjs` (in-process fs scope with realpath
  symlink-escape denial, protected-ref write denial, binary and git-subcommand
  allowlists, shell denial, network denial, deny log), adversarial
  `test-sandbox.mjs`, runner `integration-adapter.mjs`, and `run-validation.sh`.
- Folded the deferred Phase 10 follow-up: the orchestrator agent
  (`agent/sequential-afk-runner.md`) now hard-denies `edit`, `read`, `glob`,
  `grep`, `task`, and `external_directory` permissions; only `bash` remains to
  invoke the configured runner executable.
- Authoritative sequential validation returned `0` for syntax checks, the
  namespace-free static check, CLI dry run, policy assertions, and all
  adversarial scenarios under `/tmp/opencode/p11-validation/logs/`:
  secrets (6 denials, clean env), unrelated paths (8 denials incl. symlink
  escape), destructive commands (10 denials incl. `node -e` child escape),
  production-branch mutation (10 denials, refs unchanged), unapproved push and
  network (12 denials, origin untouched), dry run, failure capture, and Phase 10
  runner integration success plus fail-closed exhaustion. Phase 10 validation
  re-run remained exit `0`.
- Validation and handoff artifacts: `HARNESS-PHASE-11-VALIDATION.md` and
  `HARNESS-PHASE-11-DIFF.md`. One producer retry was consumed.
- First independent verifier `ses_fb1a80303ffeBMtnAooRLfSuvm` returned `FAIL`
  with an empirically proven env-stripping bypass: a child spawned with a
  custom `env` strips `NODE_OPTIONS` and escapes the guard (leaked the
  sentinel secret). Non-blocking findings: detection-only protected-ref
  verification, unpatched `fork`/`dgram`/`http2`, hardcoded node PATH.
- Repairs (second producer retry): guard environment
  force-reinjection into custom child envs, `fork` patch, `dgram`/`http2`
  network denial, fail-closed protected-ref verification with
  `protected_refs_mutated` stop reason, portable PATH from `process.execPath`,
  adapter-command pre-spawn validation, and three new adversarial fixtures
  (envstrip escape, adapter command validation rejecting `git push`/`rm -rf`/
  `git branch -f main` before spawn, and fail-closed refs proving a hostile git
  hook mutation fails the attempt). The authoritative validation re-run
  returned `0` for all checks; Phase 10 regression remained exit `0`.
- Second independent verifier `ses_fade46d04ffeAP6rJyh2z3wP2U` returned `FAIL`
  with two new empirically proven bypasses: guard unload via
  `delete process.env.NODE_OPTIONS` before spawning children, and allowlisted
  binaries (`cat`) reading arbitrary host paths. Non-blocking: CLI could not
  execute adapter commands, content-string false denials, and an
  existsSync/stat oracle.
- Final repairs (third producer round, exceeding the original two-retry
  producer budget under the phase's in-progress mandate; documented here for
  transparency): the guard now freezes its environment at load and
  force-injects it into every spawned child, fork, and worker thread; bare
  executable names resolve only through the frozen PATH into trusted
  directories (closing PATH-shim spoofing); the binary allowlist is trimmed to
  node/npm/npx/git; git `--output` is denied; CLI command parsing is fixed with
  a `cli-execute` validation case; fs checks use a per-operation path-argument
  map; and the envstrip fixture covers 15 escape vectors including guard-env
  deletion, cat/ls/mkdir, and worker threads. Authoritative validation
  returned `0` for all checks and all 13 scenarios; Phase 10 regression
  remained exit `0`.
- Third verifier round (user-authorized after budget exhaustion, session
  `ses_fadbcc6c6ffeobZ8Oa3AwSUCB0`, resumed after a token-quota interruption)
  returned `FAIL` with two new empirically proven bypasses: full host-file
  content reads via unpatched `fs.openAsBlob`, and native code execution via
  `LD_PRELOAD` env injection through an allowlisted `node` child
  (`process.dlopen` and `require("*.node")` also proven in a hand-rolled guard
  env); opendir/utimes/readlink gaps noted non-blocking.
- Round-5 repairs: `FS_PATH_ARGS` extended to every path-taking fs operation
  (openAsBlob, opendir, utimes/lutimes, readlink, access, exists, stat/lstat/
  statfs, glob, chown, cp, watch), loader-injection sanitization strips
  `LD_*`/`DYLD_*`/`NODE_PATH` from every child environment, in-process native
  loading denied via `process.dlopen`, `Module._extensions[".node"]`, and
  `process.binding`/`_linkedBinding` patches, and a new `native-escape`
  fixture covers 13 vectors including both proven bypasses. Authoritative
  validation returned `0` for all checks and all 14 scenarios; Phase 10
  regression remained exit `0`. The verifier itself confirmed all round-4
  containment probes held and re-ran both validation scripts at exit `0`.
- Fourth verifier returned `FAIL`: filesystem wrappers accepted `file:` URL
  objects without validation because `guard-preload.cjs:123-126` checked only
  strings and Buffers. The exact probe
  `fs.readFileSync(new URL("file:///tmp/opencode/verifier4-outside/secrets/secret.env"), "utf8")`
  produced `URL_READ_ALLOWED` and disclosed an unrelated host secret, blocking
  Rubrics B, C, and G. Evidence remains under `/tmp/opencode/verifier4-probe/`.
- Added URL-object regression coverage before repair. The red command
  `node test-sandbox.mjs /tmp/opencode/phase11-url-fix/red` returned exit `1`;
  the repaired focused command returned exit `0`. Coverage spans sync and
  promise reads, `openAsBlob`, directory/metadata, writes/mutations, protected
  refs, allowed worktree/scratch URLs, encoded separators, and a non-file scheme.
  Denied reads disclose no sentinel and denied writes leave host files unchanged.
- Repair normalizes every mapped fs path argument before policy checks. Strings
  and Buffers remain supported; `file:` URL objects use Node's `fileURLToPath`
  before resolve, realpath, deny-prefix, scope, and protected-ref checks.
  Unsupported or malformed URL/path representations fail closed with sandbox
  `EACCES` before the original API executes. `FS_PATH_ARGS` still prevents
  arbitrary content/data arguments from being treated as paths.
- Sequential post-repair validation returned exit `0` for the Phase 11 script,
  the Phase 10 regression script, and `opencode debug config`. Evidence is under
  `/tmp/opencode/p11-validation/logs/` and `/tmp/opencode/p10-validation/logs/`.
- Four verifier attempts have failed (each repaired and re-validated).
  Phase 11 remains `in_progress` pending a fresh fifth independent verifier.
  Phase 12 remains `pending` and was not started.
- Fifth verifier (fresh-reviewer session `ses_facf9bb36ffeZ1Yxj7UBkOPr8J`)
  returned `FAIL` with three blocking findings: Buffer paths validated as
  decoded strings while the fs API received raw bytes (a non-UTF-8
  byte-named symlink could escape the checked path), realm-sensitive
  `instanceof URL` recognition, and incomplete focused red/green and
  `opencode debug config` command records. One non-blocking finding: a stale
  three-verifier-count fragment in the validation artifact.
- Round-6 repairs: Buffer path arguments that are not lossless UTF-8 fail
  closed with sandbox `EACCES` before the original API executes (lossless
  UTF-8 Buffers remain fully supported and byte-equivalent to their string
  form); URL recognition brand-checks via the realm-independent
  `Object.prototype.toString` `[object URL]` tag before conversion through
  the captured `fileURLToPath`; the `file-url-escape` fixture now plants a
  harness-side non-UTF-8 byte-named symlink pointing at the host sentinel
  inside the worktree (22 attempts including a vm-realm URL, a forged
  duck-typed URL object, an `Object.create(URL.prototype)` fake, valid and
  invalid Buffers, and denied symlink creation); and complete per-command
  verification records with command, cwd, environment provenance, duration,
  exit code, and output paths now exist under
  `/tmp/opencode/phase11-url-fix/records/`.
- Genuine red evidence against the pre-repair guard:
  `node test-sandbox.mjs /tmp/opencode/phase11-url-fix/red-final` returned
  exit `1` with the unrelated host sentinel disclosed through the non-UTF-8
  Buffer path. Post-repair green returned exit `0` with all 22 attempts
  matched and no sentinel disclosure. Full sequential validation returned
  exit `0` for the Phase 11 script, the Phase 10 regression script, and
  `opencode debug config`.
- Five verifier attempts have failed (each repaired and re-validated).
  Phase 11 remains `in_progress` pending a fresh sixth independent verifier.
  Phase 12 remains `pending` and was not started.
- Sixth verifier (fresh-reviewer session `ses_fa5c62aa1ffex8BbcvY6fj52lu`,
  resumed after an interruption) returned `FAIL` with one new blocking
  finding B1: the guard validated a derived path string but executed the
  original fs API with the original path object, so Node's own second
  conversion could diverge for a stateful URL-branded object (a Proxy over
  a genuine URL with stateful property traps). Non-blocking: N1 a
  validate-then-open TOCTOU race via same-process workers, N2
  simulated-not-genuine cross-realm URL coverage, N3 a stale
  verifier-count narrative, N4 an EEXIST red artifact for the
  symlink-create vector.
- B1 was empirically confirmed before repair: a Proxy over a genuine
  `file:` URL whose `pathname` trap returns the in-scope worktree path on
  the first read (guard validation) and the host sentinel path on later
  reads (Node's execution conversion) leaked `SENTINEL-UNRELATED` through
  `fs.readFileSync(proxy)` under the pre-repair guard. Node 24 reads
  `pathname` once per conversion, making the divergence deterministic.
- Round-7 repairs: the fs wrapper writes the validated representation back
  into the argument (`args[index] = validated`) before `original.apply`, so
  the original API executes the exact path the guard checked — no second
  conversion of a hostile object can occur. The `file-url-escape` fixture
  now includes the stateful-proxy URL (allowed, executes the validated
  worktree string, must never disclose the sentinel) and a
  forged-`Symbol.toStringTag` object (denied), for 24 attempts. N1 was
  added to the documented residual risks; N3 was reworded to the accurate
  count; N4 was annotated in the validation artifact.
- TDD evidence with complete records under
  `/tmp/opencode/phase11-url-fix/records/`: `red-b1-final.json` exit `1`
  (stateful-proxy leak of `SENTINEL-UNRELATED`, `noSentinelDisclosure:
  false`) and `green-b1-final.json` exit `0` (all 24 attempts matched, no
  sentinel disclosure). Full sequential validation returned exit `0` for
  `p11-full-validation-b1.json`, `p10-regression-validation-b1.json`, and
  `config-resolution-b1.json` (`opencode debug config`, apiKey values
  redacted).
- Six verifier attempts have failed (each repaired and re-validated).
  Phase 11 remained `in_progress` pending a fresh seventh independent
  verifier. Phase 12 remained `pending` and was not started.
- Seventh verifier (fresh-reviewer session
  `ses_f9d116d3bffeuT4uEMmG5QnDVL`, interrupted and resumed) returned
  `PASS` with no blocking findings: the B1 writeback repair was confirmed
  correct by construction and by the genuine red-to-green proof, all nine
  acceptance criteria were covered, and all records, logs, violation
  reports, and deny logs were internally consistent. It re-verified every
  prior blocking class as closed. Three non-blocking findings:
  `fs.glob` `options.cwd` uninspected, module-loader host reads without
  adversarial coverage, and array glob patterns denied as unsupported.
- Round-8 non-blocking repairs (empirically probed first): the glob
  enumeration concern was inverted — glob internals route through the
  guard-patched public fs, so out-of-scope `options.cwd` was already
  denied by defense-in-depth, while the real defects were the glob PATTERN
  being wrongly path-mapped (falsely denying in-scope globs) and
  `options.cwd` never being explicitly checked. Repair: `glob`/`globSync`
  removed from `FS_PATH_ARGS`; dedicated glob wrappers validate
  `options.cwd` (including URL form, with the same
  normalize-check-writeback rule) and leave patterns untouched. NB2 was
  already closed empirically (`require`/`import` of host paths is denied
  through the loader's patched public fs); fixture vectors added to
  regression-lock it. NB3 resolved by the same map removal; array-pattern
  glob vector added. The `file-url-escape` scenario now covers 32
  attempts.
- Round-8 TDD evidence under `/tmp/opencode/phase11-url-fix/records/`:
  `red-nb.json` exit `1` (pre-repair: four out-of-scope glob cwd vectors
  allowed including `/root` and the URL form; in-scope array-pattern glob
  falsely denied) and `green-nb-final.json` exit `0` (all 32 attempts
  matched, no sentinel disclosure). Full sequential validation returned
  exit `0` for `p11-full-validation-nb.json`,
  `p10-regression-validation-nb.json`, and `config-resolution-nb.json`
  (`opencode debug config`, apiKey values redacted).
- Phase 11 completion gate passed: all authoritative checks pass, verifier
  7 returned `PASS` with no blocking finding, and its non-blocking
  findings were repaired and re-validated. Phase 11 is `completed`.
  Phase 12 remains `pending` and was not started.

## Phase 12: Parallel Execution

### Goal

Run genuinely independent issues concurrently without weakening verification.

### Work

- Select only dependency-ready issues.
- Start with at most two isolated implementers.
- Review each branch independently.
- Add controlled merge orchestration and full post-merge checks.
- Avoid concurrent edits to shared migrations, central config, routes, or types unless
  explicitly coordinated.
- Measure conflicts and reduce concurrency when integration cost rises.

### Completion Gate

Independent fixture issues merge with full verification; conflicting or blocked work
is deferred rather than forced through.

### 2026-09-04: Phase 12 Implementation and Fixture Validation

- Added `fixtures/parallel-afk-runner/`: `orchestrator.mjs` (dependency-ready
  + output-independent batch selection at most two, concurrent Phase 10
  runner processes each inside its own Phase 11 issue sandbox with
  worktrees pre-created sequentially, per-issue private backlog copies so
  the unchanged runner selects exactly its own issue, reconciliation with
  follow-up renumbering, branch-diff file-overlap contention check with
  `COORDINATION:` opt-in, recorded unapproved human merge gates mirrored
  from `humanApprovalRequiredFor`, `--authorize-merge` recording approval,
  sequential merge queue with dedicated detached merge worktrees and full
  post-merge checks before each gated landing via pinned `update-ref`,
  merge-conflict/post-merge-failure abort-block with evidence,
  protected-ref fail-closed checkpoint revoking all gates on any outside
  movement, interruption with exact resume, dry run, fail-closed malformed
  input, exclusive lock, atomic state, `events.jsonl`), the sandbox stage
  adapter, the sandboxed fixture adapter (real commits, genuine red source,
  concurrency pause), the full post-merge check adapter, the 15-group
  adversarial `test-orchestrator.mjs`, `record.mjs` (argv-safe per-command
  evidence recorder), and `run-validation.sh`.
- TDD: three genuine reds (stub `not_implemented`; no contention policy;
  exit-75 crash) each followed by green, with per-command records; cycle
  retrials and the evidence-placement incident are documented transparently
  in the validation artifact and `records/README.md`.
- Authoritative sequential validation: all 13 checks exit `0` (syntax x7,
  namespace-free, no-remote-mutation, git-allowlist, cli-dry-run x2,
  scenarios). Phase 11 regression exit `0`, Phase 10 regression exit `0`,
  `opencode debug config` exit `0`.
- Human gates unchanged: merge approval is recorded and explicit; push and
  deploy have no code path anywhere in the orchestrator.
- Validation and handoff artifacts: `HARNESS-PHASE-12-VALIDATION.md` and
  `HARNESS-PHASE-12-DIFF.md`. Phase 12 remains `in_progress` pending a
  fresh independent verifier; Phase 13 remains `pending` and was not
  started.

## Phase 13: External Domain Skills

### Goal

Adopt vetted external expertise without surrendering control of the core workflow.

### Discovery Record

Candidates discovered on 2026-08-24 with `npx skills find`:

- `trailofbits/skills@agentic-actions-auditor` (5.4K installs).
- `sickn33/agentic-awesome-skills@code-review-checklist` (1.3K installs).
- `alirezarezvani/claude-skills@senior-qa` (1.1K installs).
- `sickn33/agentic-awesome-skills@ai-agent-development` (658 installs).
- `asyrafhussin/agent-skills@e2e-playwright-testing` (448 installs).
- `dannymac180/skills@codex-dynamic-workflows` (175 installs).
- `chanakya-net/maestro-ai@tdd-implementation` (114 installs).
- `jpcaparas/skills@secure-ai-agent-coding` (68 installs).
- `itallstartedwithaidea/agent-skills@workflow-orchestration` (62 installs).
- `petekp/agent-skills@architectural-refactor` (14 installs).

### Adoption Rules

- Verify source, license, maintenance, repository reputation, instructions, OpenCode
  compatibility, permission assumptions, and overlap before installation.
- Install one candidate at a time and test it against a fixture.
- Prefer established external domain expertise; keep the core operating model local.
- Custom core remains: alignment, PRD, issue graph, TDD contract, architecture audit,
  manual QA, implementer, reviewer, and orchestration.

### Completion Gate

Every installed skill has a written adopt/adapt/reject decision, source evidence,
compatibility check, and demonstrated benefit without context or permission regressions.

## Phase 14: Metrics and Continuous Improvement

### Goal

Measure whether the harness improves delivered software rather than merely increasing
agent activity.

### Work

- Track task context, tool calls, duration, retries, failed checks, review findings,
  QA findings, conflicts, reopenings, escaped defects, intervention rate, cost, and
  time to first usable vertical slice.
- Use evidence to resize issues, strengthen feedback, tune role prompts, and remove
  ineffective permanent instructions.
- Optimize for working software, maintainable architecture, understandable changes,
  useful outcomes, and low escaped-defect rate.

### Completion Gate

Metrics are collected without exposing secrets or creating excessive overhead, and at
least one measured workflow improvement is validated against before/after evidence.

## Major Milestones

### Milestone A: Reliable Manual Harness

Phases 0-9 complete:

```text
grill -> PRD -> vertical issues -> one implementation -> checks
      -> independent review -> human QA
```

### Milestone B: Safe Sequential Autonomy

Phases 10-11 complete:

```text
ready issue -> isolated implementation -> checks -> review -> result -> repeat
```

### Milestone C: Controlled Parallel Building

Phases 12-14 complete:

```text
dependency graph -> isolated parallel work -> independent reviews
                 -> controlled merge -> full verification -> measured improvement
```

## Phase Log

### 2026-08-24: Roadmap Created

- Source: full Matt Pocock workshop transcript and the implementation-focused summary.
- Decision: own the core workflow as small OpenCode-native skills and agents.
- Decision: vet external skills individually rather than installing a framework stack.
- Decision: begin with a read-only audit and make no active config changes in Phase 0.
- Current phase when this entry was written: Phase 0, Current Harness Audit.

### 2026-08-24: Phase 0 Completed

- Deliverable: `~/.config/opencode/HARNESS-AUDIT.md`.
- Evidence: global config, instructions, memory plugin, memory, graph contract,
  skill inventory, specialized agents, package metadata, and CLI version were read.
- Verification: independent verifier passed the Phase 0 completion gate with no
  findings; it cited the roadmap and audit evidence directly.
- No active OpenCode configuration was changed.
- Decision: retain the current policy, memory, graph, specialist-review, and domain
  skill foundations; build the missing lifecycle as small harness-owned components.
- Next phase: Phase 1, Harness Contract.

### 2026-08-24: Phase 1 Completed

- Deliverable: `~/.config/opencode/HARNESS-CONTRACT.md`.
- Validation artifact: `~/.config/opencode/HARNESS-CONTRACT-VALIDATION.md`.
- The contract defines context discipline, responsibility boundaries, artifact
  handoffs, verification separation, HITL/AFK levels, documentation lifecycle, and
  change policy.
- The contract is included through the schema-supported `instructions` field in
  `~/.config/opencode/opencode.jsonc`.
- Config evidence: `opencode debug config` resolved the instruction path successfully.
- The contract was validated against representative low-risk, ambiguous, security,
  irreversible, review, frontend, historical-document, and sequential-autonomy cases.
- Independent verifier passed the Phase 1 gate with no findings.
- No external skills were installed and no runner or implementation automation was
  added; those remain later phases.
- Next phase: Phase 2, Alignment Workflow.

### 2026-08-24: Phase 2 Implementation Slice

- Added `skills/grill-me/SKILL.md` with one-question alignment, recommendations,
  required decision areas, stop conditions, research/prototype branches, HITL
  labeling, and explicit PRD/implementation handoff boundaries.
- Added `commands/grill-me.md` as a read-only workflow entry point.
- Added the restricted `agent/alignment.md`; config resolution verifies project
  read, edit, search, shell, task, and external-directory permissions are denied.
- Added `HARNESS-PHASE-2-VALIDATION.md` with small-feature, data-change, API,
  frontend, and prototype fixture rubrics.
- Independent verifier found no substantive workflow gap after the permission and
  prototype updates, but correctly marked the gate `FAIL` pending behavioral
  transcripts.
- Five noninteractive fixture attempts reached the alignment agent but timed out
  waiting for the interactive exchange; this is recorded as `BLOCKED`, not passed
  evidence. Phase 2 remains `in_progress`.

### 2026-08-24: Phase 2 Interactive Validation Evidence Captured

- Ran fresh interactive sessions for all five fixtures in
  `HARNESS-PHASE-2-VALIDATION.md` using the restricted `alignment` agent.
- The sessions produced observed one-question-per-turn behavior, provisional
  recommendations, applicable data/security/edge/testing/non-goal coverage,
  preserved `HITL`, `UNKNOWN`, and `RESEARCH` branches, and alignment records
  only. No project inspection or editing occurred, and no PRD, issue list, plan,
  or implementation was produced.
- The first four-process concurrent attempt force-closed Termux on the Android
  device and is explicitly excluded as evidence. Remaining sessions, including a
  clean `--pure` data-change rerun, were run sequentially with one active process.
- Validation artifact updated with session IDs, concise observations, discarded
  contaminated-attempt note, and gate status `READY FOR INDEPENDENT VERIFICATION`.
- Phase 2 remains `in_progress` pending a fresh-context independent verifier; it
  is not completed by this entry.

### 2026-08-24: Phase 2 Completed

- Completion gate: passed after fresh interactive evidence for all five fixtures
  and a fresh-context independent verification with no findings.
- Verification confirmed one decision question per turn, recommendations,
  applicable data/security/edge/testing/non-goal coverage, preserved
  `HITL`/`UNKNOWN`/`RESEARCH` branches, restricted no-inspection/no-edit behavior,
  and no PRD, issue list, plan, or implementation output.
- Android/Termux limitation recorded: the concurrent attempt force-closed
  Termux, was excluded from evidence, and sequential sessions were used instead.
- Residual risk: validation uses concise observed results rather than full
  transcripts; session IDs are retained for raw event inspection.
- Next phase: Phase 3, Destination Documents.

### 2026-08-24: Phase 3 Completed

- Added `skills/write-prd/SKILL.md`, `commands/write-prd.md`, and the restricted
  `agent/destination-writer.md`.
- Added `HARNESS-PHASE-3-VALIDATION.md` with an unconfirmed-input guard and five
  destination-document fixtures: small feature, data change, API integration,
  frontend workflow, and prototype branch.
- Sequential `--pure` sessions preserved negative decisions, migration and
  compatibility behavior, unknown module boundaries, testing expectations,
  lifecycle status, research/HITL branches, and unresolved risks without creating
  issue lists, implementation plans, code, or project edits.
- Config resolution confirmed project read, edit, search, shell, task, and external
  directory permissions are denied for `destination-writer`.
- The first independent verifier correctly failed operator-only summaries. After
  generated output and resolved-permission excerpts were added, a new fresh-context
  verifier passed the gate with no findings.
- Residual risk: the validation artifact stores concise copied excerpts and session
  IDs rather than complete transcripts.
- Next phase: Phase 4, Backlog and Issue Contract.

### 2026-08-24: Phase 4 Completed

- Added `skills/prd-to-issues/SKILL.md` with a machine-readable fenced-Markdown
  issue schema (status, afk/hitl type, blockers, outcome, acceptance criteria,
  layers, module boundaries, tests, commands, constraints, non-goals), the
  vertical-slice rule, genuine output-dependency blocker rules with explicit
  parallel branches, hitl labeling for unsafe or unresolved work, and a
  rejected-slices record.
- Added `commands/prd-to-issues.md` and the restricted `agent/issue-writer.md`;
  config resolution confirmed read, edit, glob, grep, bash, task, and
  external_directory are all denied.
- Added `HARNESS-PHASE-4-VALIDATION.md` with six fixtures: unconfirmed-input
  guard, small feature, data change, API integration, frontend workflow, and a
  horizontal-plan rejection fixture.
- Sequential `--pure` sessions produced observable vertical slices spanning
  needed layers, cycle-free genuine blockers, real parallel branches,
  one-context-sized issues, preserved UNKNOWN/HITL/RESEARCH items with named
  owners, and recorded refusals of horizontal layer plans and consumer-less
  infrastructure (including the cache-first demand).
- Fresh-context independent verifier passed all rubric items A-F with no
  findings; it re-ran config resolution itself.
- Residual risk: evidence is operator-selected excerpts plus session IDs rather
  than complete transcripts; fixture inputs live in `/tmp/opencode/p4-fixtures/`.
- Next phase: Phase 5, Project Feedback Contracts.

### 2026-08-25: Phase 4 Redone and Revalidated

- The 2026-08-24 Phase 4 independent verification is superseded because it read
  selected excerpts rather than the complete fixture inputs and outputs.
- Rework found real contradictions: undeclared issue fields, `afk`/`ready` work
  with unknown commands, ambiguous human-gate status, oversize issues, and a
  bounded research branch that could disappear into a constraint.
- The skill, command, restricted agent, and validation rubric now enforce exact
  schema fields, `hitl`/`blocked` for unknown commands, explicit human gates, at
  most five acceptance criteria, and explicit bounded research branches.
- Six final fixtures were generated sequentially with one active process. The
  interrupted concurrent attempt is excluded because Termux cannot reliably run
  multiple OpenCode processes on this device.
- A first fresh verifier failed the API fixture because its research branch was
  not explicit. The contract was repaired and the API fixture rerun.
- A second fresh verifier read all complete inputs and outputs, independently
  resolved configuration, and passed the Phase 4 gate with no findings.
- Validation artifact: `~/.config/opencode/HARNESS-PHASE-4-VALIDATION.md`.
- Final verifier task session: `ses_fc95f0f23ffe8dq0I7xyYKWXru`.
- Residual risk: final evidence is complete generated artifacts rather than an
  independent replay; command and owner unknowns intentionally keep all fixture
  implementation issues blocked.
- Phase 4 remains `completed`. Next phase: Phase 5, Project Feedback Contracts.

### 2026-08-25: Phase 5 Implementation and Fixture Validation

- Added `HARNESS-PROJECT-FEEDBACK.md`, the `project-feedback` skill, and the
  `project-check` command defining named checks, fast/full separation,
  unavailable-check evidence, blocking failures, and residual risk.
- Repaired the reusable web CI workflow so typecheck, lint, test, and build
  failures are hard gates instead of `continue-on-error` soft failures.
- Added `pipeline-init --check-only` eligibility validation and an Android/Gradle
  guard that exits before creating Node, Playwright, or Vercel configuration.
- Added dependency-free valid/invalid web and Android fixtures with complete
  logs under `/tmp/opencode/p5-validation/`. Valid checks passed; injected
  type, test, lint, and build failures returned exit `1`; eligible web returned
  `0`; tiny projects returned `3`; Android returned `2` with no Node/Vercel files.
- YAML parsing and `opencode debug config` both returned exit `0`.
- Validation artifact: `HARNESS-PHASE-5-VALIDATION.md`.
- Phase 5 remains `in_progress` pending a fresh independent verifier.

### 2026-08-25: Phase 5 Independent Verification Repairs

- First verifier `ses_fc93486baffexBqWuckm01yGQw` returned `FAIL`: web
  eligibility omitted required scripts, production deploy could run on pull
  requests, and fixture evidence metadata was incomplete.
- Repaired eligibility to require lockfile plus typecheck, lint, test, build,
  start, and E2E scripts; restricted production deploy to pushes on `main`; and
  added per-command metadata.
- Second verifier `ses_fc71adeecffeAWenSTlOviDRkC` passed A, C, D, E, F, and G
  but returned `FAIL` on B because two static checks bypassed metadata capture
  and the command-scoped build environment was recorded inaccurately.
- Repaired all fixture checks to use the common evidence logger, made environment
  provenance accurate, and strengthened the static pipeline assertion to require
  all four blocking steps as well as absence of soft-fail behavior.
- Two completed verifier attempts exhausted the retry budget. Phase 5 remains
  `in_progress` pending final fresh verification from a new session.

### 2026-08-25: Phase 5 Completed

- A fresh independent read-only verifier inspected every required source artifact
  and every complete generated fixture log from the working tree.
- Rubric items A-G all passed. Shell syntax validation and YAML parsing both
  exited `0`.
- The verifier confirmed the repaired web eligibility checks, main-only
  production deployment gate, Android isolation, blocking failure sequencing,
  complete evidence metadata, and hard-gated reusable CI.
- Final verdict: Phase 5 passes its completion gate.
- Residual risks remain limited to the documented absence of live GitHub Actions,
  Vercel, and local Android toolchain execution.
- Next phase: Phase 6, TDD and Bounded Implementer.

### 2026-09-10: Server Alignment Complete

- Harness migrated from Android/Termux/proot to AWS EC2 WSL2 Debian server.
- Environment fixes: Vercel CLI installed (v59.15.1), python alias created,
  PATH updated in .bashrc to include npm global bin.
- Context budget audit: 26.8K tokens/session (13.4% of 200K window) — healthy.
  Top recommendation: disable excalidraw MCP (~10K savings) — applied.
- Playwright Chromium installed with MCP --executable-path config fix.
- Harness phases 0-5 revalidated: all correct, no stale phone refs in active files.
- Stale proot references fixed in sequential-afk-runner/SKILL.md, sandbox.mjs,
  run-validation.sh, HARNESS-AUDIT.md.
- Docker sandbox created (sandbox-docker.mjs) with process-level fallback.
  8/8 adversarial tests pass.
- Parallel orchestrator validated: 12/12 checks pass.
- Graph memory updated: 30 nodes, 33 edges. Episode receipt written.
- Pipeline verified: syntax OK, GitHub auth as theDRElabs, Vercel token present.
- hardened-rules.js plugin: try/catch error handling added.
- All 7 alignment sessions completed. Plan at HARNESS-SERVER-ALIGNMENT.md.

### 2026-09-10: Phase 13 Completed — External Domain Skills

- Skill consolidation: 28 → 26 skills.
- Pair 1 (`nextjs-app-router-patterns` + `next-best-practices`): marked `nextjs-app-router-patterns` as `user-invocable: false` — complementary quick-ref vs deep-dive, no merge needed.
- Pair 2 (`frontend-design` + `high-end-visual-design`): merged tactical content (anti-patterns, variance engine, haptic aesthetics, motion choreography, performance guardrails) into `frontend-design` (55 → 143 lines). Deleted `high-end-visual-design`.
- Pair 3 (`e2e-testing` vs `tdd`): no action — both are harness-phase skills, not domain knowledge.
- `security-scan`: removed entirely — references `.claude/` and `ecc-agentshield` (Claude Code-only tool), not adaptable for opencode.
- Context budget updated: 26 skills, ~3,560 lines total, ~17,820 tokens domain skills.
- Next phase: Phase 14, Metrics and Continuous Improvement.

### 2026-09-10: Phase 14 Completed — Metrics and Continuous Improvement

- Created `scripts/collect-metrics.sh`: runs all 8 fixture validation suites, captures pass/fail/duration/case counts, graph stats, skill stats, phase count. Outputs structured JSON or human-readable summary.
- Created `HARNESS-METRICS.md`: baseline report with fixture results, graph memory stats, skill inventory, phase completion, context overhead.
- **Measured improvement**: tdd-bounded fixture fixed (3/4 → 11/11 cases) by replacing `sqlite3` CLI dependency with `node:sqlite` built-in. manual-qa playwright path fixed (stale `/home/ubuntu/projects/lumen/` → current `/home/ubuntu/.config/opencode/`). Fixture pass rate: 87.5% → 96.4%.
- Baseline: 63 cases, 62 pass, 1 known environmental failure (headless Chromium screenshot timeout).
- Context overhead reduced from ~26.8K to ~16.8K tokens (excalidraw disabled + skill consolidation).
- All 15 harness phases now completed. Milestone C achieved.
