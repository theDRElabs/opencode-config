# OpenCode Config

The complete AI software-development harness for [OpenCode](https://opencode.ai). This is the brain that tells OpenCode how to build software responsibly.

## What's in here

| Directory | What it does |
|-----------|-------------|
| `agent/` | 12 role-restricted AI agents (reviewer, implementer, QA, orchestrator, etc.) — each can only do one job |
| `skills/` | 34 pull-based instruction sets that activate on demand (27 in-tree + 7 symlinked into `~/.opencode/skills/`): TDD, alignment, PRD writing, frontend design, etc. |
| `commands/` | User-facing entry points for workflows (`grill-me`, `implement-issue`, `run-afk`, etc.) |
| `fixtures/` | Test fixtures used to validate each harness phase |
| `scripts/` | Harness tooling (`collect-metrics.sh` runs all fixture validation suites) |
| `harness-archive/` | Archived phase artifacts (audit reports, validation evidence) — kept for provenance, not loaded into context |
| `graph/` | Separate repo (git-ignored here) — persistent knowledge graph (entities, relations, episodes) |

| File | What it does |
|------|-------------|
| `opencode.jsonc` | OpenCode config — providers, models, MCP servers, and instruction paths |
| `AGENTS.md` | Operating rules — communication, safety, deployment, and graph-memory policies |
| `HARNESS-CONTRACT.md` | The contract — lifecycle, responsibilities, verification, and autonomy levels |
| `HARNESS-ROADMAP.md` | 15-phase build plan with completion gates, evidence, and phase log |
| `HARNESS-METRICS.md` | Harness metrics baseline and how to re-measure health |
| `memory.md` | Rolling session memory |

## How it works

The harness enforces a pipeline:

```
human intent
  -> alignment interview (grill-me)
  -> destination document (write-prd)
  -> dependency-aware vertical-slice issues (prd-to-issues)
  -> bounded implementation (bounded-implementer + TDD)
  -> automated checks (project-feedback)
  -> independent review (fresh-reviewer)
  -> architecture audit for cross-cutting changes (architecture-audit)
  -> human QA (manual-qa-plan)
  -> follow-up issues -> repeat
  -> unattended execution (run-afk): sequential, then parallel, AFK runners
```

Every step has a clear owner, evidence requirements, and a gate before the next step starts. The agent that implements is never the agent that verifies. Unattended runs execute in per-issue Git worktrees inside a sandbox that denies host secrets, network, destructive commands, and production-branch writes.

## Current status

All 15 harness phases are complete (Milestones A–C: manual pipeline -> safe sequential autonomy -> controlled parallel building).

- 34 skills, 12 agents, 9 commands; always-loaded context ~16.8K tokens (~8.4% of a 200K window).
- Metrics baseline: 62/63 fixture cases pass (96.4%) across 8 suites; the one known failure is the headless-Chromium screenshot timeout on GPU-less servers (environmental, not a harness defect).
- Re-measure with `bash ~/.config/opencode/scripts/collect-metrics.sh`.

## Restore on a new device

```bash
git clone https://github.com/theDRElabs/opencode-config.git ~/.config/opencode
git clone https://github.com/theDRElabs/graph-memory.git ~/.config/opencode/graph
cd ~/.config/opencode && npm install
```

Note: a few design/UI skills are symlinks into `~/.opencode/skills/` (installed via `npx skills install`); reinstall them on a fresh device so the symlink targets exist.

## Private

This repo is private. It contains API key references (placeholders in `.env.example`; real keys live in `.env`, which is git-ignored), environment-specific config, and harness evolution evidence.