# OpenCode Harness Audit

Date: 2026-08-24
Scope: global OpenCode harness under `~/.config/opencode`, plus project-level
instruction files discoverable under `/home/DRE/projects`.
Method: read-only inventory and behavior tracing. No active OpenCode configuration
was changed during this audit.

## Executive Summary

The current harness is a useful policy and memory baseline, but it is not yet an
AI building harness. It has model/provider configuration, broad global operating
rules, persistent session memory, graph memory, domain skills, and three specialized
review agents. It does not yet implement the staged workflow from the roadmap:

```text
alignment -> destination document -> vertical issue graph -> bounded implementation
          -> automated checks -> independent review -> human QA -> follow-up issues
```

The highest-priority gaps are the absence of a harness contract, lifecycle skills,
bounded implementer/reviewer roles, a project verification contract, and an
inspectable issue/backlog format.

## Inventory

### Global configuration

File: `~/.config/opencode/opencode.jsonc`

Observed:

- Declares the OpenCode JSON schema.
- Configures three providers: `agentrouter`, `agentrouter-openai`, and `bluesminds`.
- Defines model catalogs for those providers.
- Uses environment-variable interpolation for API keys.
- Does not declare a default model, default agent, instructions list, skill paths,
  commands, configured agents, MCP servers, permissions, compaction policy, or
  telemetry settings.

Implication: OpenCode defaults and auto-discovery currently provide most behavior.
The harness has no explicit central configuration for role separation or workflow
commands. This is a good low-bloat starting point, but it is not an explicit contract.

### Global instructions

File: `~/.config/opencode/AGENTS.md`

Observed policy areas:

- User communication and action-confirmation rules.
- Global Node/GitHub/Vercel build pipeline rules.
- Separate Android/Gradle pipeline rules.
- Graph-memory topology, provenance, verification, retry, and untrusted-input rules.
- Shared editing and destructive-command safeguards.
- Frontend design and verification expectations.
- Review response conventions.

Strengths:

- Explicit human-control boundaries.
- Explicit preservation of unrelated worktree changes.
- Explicit retry budget of two attempts.
- Explicit independent-verifier rule.
- Strong deployment and CI lessons.
- Strong frontend quality constraints.
- Explicit untrusted-input quarantine.

Risks and limitations:

- The file is broad and mixes global communication policy, deployment policy,
  frontend design policy, graph operations, and coding-agent behavior.
- It does not define a feature lifecycle, issue contract, or implementation/review
  handoff artifact.
- It contains many instructions that are always present even when irrelevant to a
  task, increasing permanent context.
- It does not provide a direct context budget or context-reset policy for coding work.
- It does not define standard project verification commands.
- It does not distinguish implementer instructions from reviewer instructions.

The file should be treated as a protected policy baseline. Phase 1 should reduce
duplication and add a concise harness contract without casually rewriting user-mandated
rules.

### Plugins

File: `~/.config/opencode/plugin/memory.js`

Observed behavior:

- Auto-discovered from the global plugin directory.
- Captures the latest user message on `chat.message`.
- Writes a compact entry on `session.idle`.
- Keeps at most eight entries and caps the memory file at 6 KB.
- Injects at most 3 KB of the tail of `memory.md` into every system prompt.
- Never throws; filesystem failures are swallowed.
- Adds a pointer telling the agent to read and append durable facts when relevant.

Strengths:

- Bounded memory injection.
- Useful persistence across sessions.
- Low operational complexity.

Risks and limitations:

- The plugin records the last user request, not validated decisions, artifacts,
  implementation state, or phase completion evidence.
- Its injected memory is not guaranteed to be current truth; it is a chronological
  note stream.
- Swallowed filesystem errors can make memory persistence fail silently.
- It injects memory on every prompt, including tasks where it is irrelevant.
- It does not read or update `HARNESS-ROADMAP.md` automatically.

The plugin should not be expanded into a large automatic memory system. The roadmap
should remain the durable phase control document, while memory remains a compact
pointer and session-history aid.

### Global skills

Directory: `~/.config/opencode/skills`

Installed skills observed:

- `ai-sdk`
- `caveman`
- `context-budget`
- `customize-opencode` (built-in)
- `design-md`
- `e2e-testing`
- `error-handling`
- `find-skills`
- `frontend-design`
- `graph-memory`
- `high-end-visual-design`
- `next-best-practices`
- `nextjs-app-router-patterns`
- `project-memorial`
- `scrollcraft`
- `security-scan`
- `shadcn`
- `vercel-react-best-practices`

Strengths:

- Good coverage for Next.js, React, AI SDK, frontend design, E2E, error handling,
  OpenCode configuration, and graph memory.
- Skills are mostly specialized and pull-based.
- Existing E2E and frontend guidance supports the later browser QA phase.

Gaps:

- No `grill-me` skill.
- No PRD/destination-document skill.
- No PRD-to-issue/dependency-graph skill.
- No TDD/red-green-refactor skill.
- No architecture-audit/deep-module skill.
- No manual-QA-plan skill.
- No general fresh-context change-review skill.
- No sequential or parallel orchestrator skill.

The custom workflow skills should be added incrementally and kept small. External
skills should be audited and installed individually, not used as a replacement for
the core harness contract.

### Agents

Global agents observed:

- `pr-test-analyzer`: reviews behavioral test coverage and gaps.
- `security-reviewer`: reviews OWASP risks, secrets, auth, input, and dependencies.
- `silent-failure-hunter`: reviews swallowed errors, fallbacks, and missing propagation.

Strengths:

- Specialized review roles already exist.
- All three contain prompt-defense and untrusted-input baselines.
- Their scopes match the later independent-review phase.

Gaps:

- No explicit implementer agent constrained to one issue.
- No general read-only reviewer receiving a diff, acceptance criteria, and rubric.
- No explorer/planner role contract beyond built-in behavior.
- No merger agent.
- No explicit model or permission separation by role.
- No standardized review output for findings, evidence, and residual risks.

The existing agents should be reused rather than replaced. Their prompts may need
small alignment changes after the Phase 1 contract exists.

### Commands and workflow entry points

No global `.opencode/command(s)` directory or command definitions were found in the
global inventory. The current workflow is therefore primarily conversational and
skill-triggered rather than command-driven.

There is an existing project planning artifact:

- `~/.config/opencode/.agents/plans/lumen-project-planner.md`

It is a project-specific plan, not a generalized workflow contract. It contains
useful implementation details but is not currently connected to issue execution,
verification, or lifecycle management.

### Memory and graph memory

Files:

- `~/.config/opencode/memory.md`
- `~/.config/opencode/graph/`

Graph memory has a documented Extract -> Resolve -> Assemble -> Query workflow,
provenance requirements, temporal invalidation, dangling-reference guards, and
independent-verifier rules. This is a strong durable-facts layer.

The current memory file contains strategy decisions, the trend-radar plan, and
session history. It does not yet contain a structured harness phase state. The new
roadmap provides that missing state and should be preferred for phase tracking.

### Package and runtime

Observed:

- Global package dependency: `@opencode-ai/plugin` version `1.18.18`.
- Installed CLI reports version `1.18.21`.
- A global `.env` exists, and `.env.example` documents provider key names.

Security note: key values were not read. The harness should keep secrets out of
instructions, skills, issue files, logs, and review artifacts.

### Project-level instructions

Project `AGENTS.md` files were found under:

- `/home/DRE/projects/transfer/AGENTS.md`
- `/home/DRE/projects/data-check/AGENTS.md`
- `/home/DRE/projects/transfer/skills/vercel-react-best-practices/AGENTS.md`

Note: `nobuy-scaffold` and `webland` projects referenced in the original audit
(2026-08-24) no longer have AGENTS.md files. Paths updated from `/root/projects`
to `/home/DRE/projects` during server migration (2026-09-10).

These project instructions may materially affect implementation and verification,
but they are intentionally not merged into the global audit. Each target project
needs its own feedback and architecture inventory before AFK execution.

## Current Request-to-Code Path

Based on the observed global setup, the current path is:

```text
user request
  -> global AGENTS.md policy and auto-discovered skills/plugins
  -> conversational exploration and tool use
  -> direct edits by the active primary agent
  -> optional specialist subagent delegation
  -> ad hoc project commands/tests when the agent chooses to run them
  -> conversational report
```

What is missing from this path:

```text
explicit alignment interview
  -> durable destination document
  -> bounded issue with dependencies
  -> one-issue implementer contract
  -> mandatory automated feedback contract
  -> fresh-context independent review
  -> explicit human QA checklist
  -> structured completion evidence
```

## Context Flow

Current context sources include:

- Global `AGENTS.md`.
- Provider/model system behavior.
- Auto-discovered global skills when surfaced or invoked.
- Auto-discovered global agents when delegated.
- Memory plugin injection of up to 3 KB of recent memory.
- Current conversation and tool outputs.
- Project-level `AGENTS.md` files when working inside those projects.

Current controls:

- Memory injection is capped.
- Graph and global rules specify independent verification and retry budgets.
- No explicit task-size threshold exists.
- No standard context checkpoint/reset procedure exists.
- No explicit token telemetry is configured in `opencode.jsonc`.
- No artifact handoff format prevents a fresh agent from receiving too much or too
  little context.

## Permission and Safety Flow

Observed baseline:

- Global instructions prohibit destructive commands without approval.
- Global instructions prohibit reverting unrelated changes.
- Graph policy requires untrusted-input quarantine.
- Specialized review agents include prompt-defense rules.
- No explicit global permission map is present in `opencode.jsonc`.
- No worktree or container isolation is present in the global configuration.
- No AFK runner exists to enforce bounded shell or edit behavior.

Conclusion: safety currently depends heavily on instruction-following rather than
configuration-enforced role permissions. This is acceptable for interactive work but
insufficient for unattended execution.

## Verification Flow

Current verification capabilities:

- Existing specialist review agents.
- Existing E2E, frontend, error-handling, and framework skills.
- Project-specific commands described by individual repositories and global pipeline
  rules.
- Global graph verification rule requiring a fresh verifier.

Current weaknesses:

- No mandatory check contract per project.
- No universal requirement to prove a test failed before implementation.
- No standard diff-review handoff.
- No structured human QA artifact.
- No automatic conversion of review/QA findings into issues.
- No completion ledger tying issue status to command output.

## Classification

### Keep

- Provider configuration and environment-variable interpolation.
- User-mandated global safety and communication rules.
- Global CI/deployment lessons.
- Graph-memory system and provenance rules.
- Existing specialized review agents.
- Existing domain skills for frontend, AI SDK, E2E, error handling, and OpenCode.
- Bounded persistent memory plugin, with its scope kept narrow.

### Modify later

- Global `AGENTS.md`: add a concise harness contract and remove duplication only
  after preserving user-mandated requirements.
- Existing review agents: align output and handoff contracts.
- Memory plugin: potentially add a roadmap pointer, but only after validating that
  this does not increase permanent context or silently mutate phase state.
- OpenCode config: add explicit commands, role agents, and permission policies only
  after schema validation and a design decision.

### Build

- `grill-me`.
- `write-prd`.
- `prd-to-issues`.
- Project feedback contract.
- TDD skill and bounded implementer.
- General independent reviewer.
- Manual QA plan.
- Architecture audit.
- Sequential runner.
- Sandboxed worktree runner.
- Parallel orchestrator.
- Metrics.

### Investigate before adoption

- External code-review checklist.
- External senior QA.
- External E2E Playwright testing.
- External agentic-actions auditor.
- External AI-agent-development and workflow skills.

## Phase 0 Findings

1. The harness has strong policy, safety, graph-memory, and domain-skill foundations.
2. The core AI-building workflow is not yet explicit or artifact-driven.
3. Permanent global instructions are broader than the current workflow contract and
   should be carefully partitioned in Phase 1.
4. Persistent memory is bounded but records session history rather than verified
   project state.
5. Existing reviewers are valuable building blocks but lack a common review protocol.
6. No configuration-enforced isolation exists for unattended implementation.
7. No project-independent verification contract exists.
8. The next correct step is Phase 1: define the concise harness contract, not yet
   install external skills or build the runner.

## Completion Evidence

- Global config read: `~/.config/opencode/opencode.jsonc`.
- Global instructions read: `~/.config/opencode/AGENTS.md`.
- Plugin read: `~/.config/opencode/plugin/memory.js`.
- Memory read: `~/.config/opencode/memory.md`.
- Existing agents read: `pr-test-analyzer`, `security-reviewer`,
  `silent-failure-hunter`.
- Graph contract read: `~/.config/opencode/graph/README.md`.
- Global skills inventoried under `~/.config/opencode/skills`.
- OpenCode CLI version observed: `1.18.21`.
- No active configuration edits were made during Phase 0.
