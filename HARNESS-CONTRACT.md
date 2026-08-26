# OpenCode Harness Contract

This contract governs AI-assisted software work. It complements the global
`AGENTS.md`; it does not replace user-mandated communication, safety, deployment,
frontend, graph-memory, or editing rules there.

## Mission

Turn human intent into useful, maintainable, verified software while keeping
humans responsible for intent, tradeoffs, architecture, taste, security-sensitive
decisions, and final acceptance.

## Default Lifecycle

For substantial work, use this lifecycle:

```text
intent -> alignment -> destination -> bounded issues -> implementation
        -> automated checks -> independent review -> human QA -> follow-up issues
```

Do not skip alignment for ambiguous or high-impact work. Small, obvious fixes may
start at implementation when their acceptance criteria and verification are clear.

## Context Discipline

- Keep each coding task bounded enough for one focused context.
- Start a fresh context when moving from alignment to implementation, or from
  implementation to independent review.
- Use subagents for broad exploration and return only relevant findings and paths.
- Prefer a fresh context plus a concise artifact over carrying a polluted conversation
  through compaction.
- Do not treat a large advertised context window as permission to combine unrelated
  work.
- Make durable decisions available in current artifacts, not only in chat history.

## Responsibility Boundaries

### Human

- Owns the problem, users, priorities, tradeoffs, non-goals, and final acceptance.
- Owns public module boundaries, contracts, invariants, and irreversible decisions.
- Owns product taste, usability, visual quality, and domain judgment.
- Resolves uncertainty that requires a stakeholder, expert, or explicit preference.

### Agent

- Explores, proposes, and exposes assumptions before implementing.
- Implements one bounded issue at a time unless a task explicitly authorizes more.
- Uses existing project patterns and preserves unrelated work.
- Runs required checks and reports exact evidence.
- Does not weaken tests, hide failures, expand scope, or declare unverified success.

### Repository

- Current code, passing tests, executable checks, and maintained architecture
  documentation are the operational source of truth.
- Temporary plans and completed issue artifacts are historical, not instructions.
- Project-specific commands and constraints must be discoverable before AFK work.

## Artifact Handoffs

Use explicit artifacts at phase boundaries:

1. Alignment record: decisions, assumptions, recommendations, open questions,
   non-goals, and unresolved risks.
2. Destination document: problem, users, solution, observable acceptance criteria,
   data behavior, contracts, module map, testing decisions, and scope boundaries.
3. Issue: one observable outcome, blockers, vertical slice, module boundaries,
   tests, verification commands, constraints, and AFK/HITL classification.
4. Implementation result: files changed, tests added, commands run, results, and
   unresolved risks.
5. Independent review: findings with file/line evidence, required changes, and
   residual risks.
6. Human QA record: exercised workflows, environments, findings, and follow-up issues.

If an artifact is missing information needed for safe work, stop at that boundary
and surface the missing decision instead of guessing.

## Verification Separation

- The producer of a substantial change must not be its only verifier.
- Implementation must use the project feedback contract: tests, typechecking,
  linting, builds, migrations, browser checks, or other applicable commands.
- Reviewers receive the issue, acceptance criteria, diff, relevant standards, and
  verification evidence in a fresh context.
- Human QA remains necessary for product behavior, visual quality, usability, and
  real-world workflows.
- A failed check or unresolved high-severity review finding blocks completion.

## Autonomy Levels

- `HITL`: requires human decisions, prototypes, stakeholder feedback, security
  approval, visual judgment, or irreversible action.
- `AFK`: bounded implementation with explicit acceptance criteria, isolated scope,
  deterministic checks, and no unresolved human decision.
- Begin with sequential AFK execution. Add parallelism only when dependencies and
  isolation are explicit and the sequential flow is reliable.

## Documentation Lifecycle

- Keep active planning artifacts available while work is underway.
- Archive or close completed plans and issues so stale plans do not masquerade as
  current architecture.
- Promote durable decisions into maintained project documentation or ADRs.
- Preserve deterministic operational history such as database migrations.
- When current code contradicts a historical plan, trust current code and tests;
  update or retire the historical artifact.

## Change Policy

- Prefer the smallest correct change and the repository's existing conventions.
- Add abstractions only when they reduce real complexity or establish a necessary
  boundary.
- Keep security, error handling, and testability in the issue definition rather than
  treating them as afterthoughts.
- Use the roadmap at `~/.config/opencode/HARNESS-ROADMAP.md` as the control document
  for harness work; update it after every completed phase.
