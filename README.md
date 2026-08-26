# OpenCode Config

The complete AI software-development harness for [OpenCode](https://opencode.ai). This is the brain that tells OpenCode how to build software responsibly.

## What's in here

| Directory | What it does |
|-----------|-------------|
| `agent/` | Role-restricted AI agents (reviewer, implementer, QA, etc.) — each can only do one job |
| `skills/` | Pull-based instruction sets that activate on demand (TDD, alignment, PRD writing, etc.) |
| `commands/` | User-facing entry points for workflows (`grill-me`, `implement-issue`, etc.) |
| `fixtures/` | Test fixtures used to validate each harness phase |
| `graph/` | Separate repo — persistent knowledge graph (entities, relations, episodes) |

| File | What it does |
|------|-------------|
| `opencode.jsonc` | OpenCode config — providers, models, and instruction paths |
| `AGENTS.md` | Operating rules — communication, safety, deployment, and graph-memory policies |
| `HARNESS-CONTRACT.md` | The contract — lifecycle, responsibilities, verification, and autonomy levels |
| `HARNESS-ROADMAP.md` | 15-phase build plan with completion gates and evidence |
| `HARNESS-AUDIT.md` | Phase 0 audit of the original setup |
| `HARNESS-PHASE-*-VALIDATION.md` | Evidence that each completed phase passed its gate |
| `memory.md` | Rolling session memory |

## How it works

The harness enforces a pipeline:

```
human intent
  -> alignment interview (grill-me)
  -> destination document (write-prd)
  -> vertical-slice issues (prd-to-issues)
  -> bounded implementation (bounded-implementer + TDD)
  -> automated checks (project-feedback)
  -> independent review (fresh-reviewer)
  -> human QA (manual-qa-plan)
```

Every step has a clear owner, evidence requirements, and a gate before the next step starts. The agent that implements is never the agent that verifies.

## Current status

Phases 0-8 complete. Phases 9-14 pending (architecture audit, sequential runner, sandboxing, parallel execution, external skills, metrics).

## Restore on a new device

```bash
git clone https://github.com/theDRElabs/opencode-config.git ~/.config/opencode
git clone https://github.com/theDRElabs/graph-memory.git ~/.config/opencode/graph
cd ~/.config/opencode && npm install
```

## Private

This repo is private. It contains API keys references (in `.env`, not committed), environment-specific config, and harness evolution evidence.
