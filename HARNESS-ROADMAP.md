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
| 9 | Architecture Improvement | pending | architecture-audit skill |
| 10 | Sequential AFK Runner | pending | bounded sequential orchestrator |
| 11 | Sandboxing and Worktrees | pending | isolated execution environment |
| 12 | Parallel Execution | pending | dependency-aware parallel orchestrator |
| 13 | External Domain Skills | pending | vetted skill set and adoption record |
| 14 | Metrics and Improvement | pending | harness metrics and tuning loop |

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
