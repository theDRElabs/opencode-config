# OpenCode Config

**A complete AI software-development harness for [OpenCode](https://opencode.ai) — built on a 3GB RAM Android phone, with no laptop and no VPS.**

This is the setup that makes an AI coding agent actually follow your instructions instead of drifting: context discipline, a persistent knowledge graph, role-restricted agents, and verification that can't be faked. The rule the whole thing is built around: **the agent that implements is never the agent that verifies.**

- 12 agents, each locked to one job
- 34 skills that activate on demand
- 9 workflow commands
- 62/63 fixture cases passing (96.4%) across 8 suites
- ~16.8K tokens of always-loaded context (~8.4% of a 200K window)

## Why this exists

Most "AI coding" advice assumes a machine that can install anything. This was built on an Infinix Smart 7 Plus — 3GB RAM, 64GB storage, Android 12 — where installs took hours, parallel runs force-quit Termux, and builds OOM'd. Renting a VPS wasn't an option.

So the phone became a thin client: proot-distro Debian hosts the agent, and heavy work (installs, builds, deploys) runs in free remote environments via GitHub Actions and Codespaces. Everything in this repo is the harness layered on top of that.

The phone setup itself lives in a separate, currently private `termux-setup` repo (`BUILD-LESSONS.md`, `TERMUX-DEV-KNOWLEDGE.md`). It is referenced here rather than linked because that repo is not public yet.

## What it enforces

```text
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
  -> unattended execution (run-afk): sequential, then parallel
```

Every step has an owner, an evidence requirement, and a gate before the next one starts. Unattended runs execute in per-issue git worktrees inside a sandbox that denies host secrets, network, destructive commands, and production-branch writes.

Three pieces exist specifically because they fixed something that annoyed me:

| Piece | Fixes |
|---|---|
| [`graph-memory`](https://github.com/theDRElabs/graph-memory) | Agent re-learning facts I'd already corrected, wasting tokens and repeating mistakes |
| `grill-me` skills | Building the wrong thing because intent was never pinned down — the skill questions you first |
| Fixtures + independent verification runs | Agents hallucinating "task done" when it wasn't — nothing advances without proof |

## Repo layout

| Path | What it is |
|---|---|
| `agent/` | 12 role-restricted agents (reviewer, implementer, QA, orchestrator, …) |
| `skills/` | 34 pull-based instruction sets (TDD, alignment, PRD writing, frontend design, …) |
| `commands/` | User-facing entry points: `grill-me`, `implement-issue`, `run-afk` |
| `fixtures/` | Test fixtures validating each harness phase |
| `metrics/` | Trial results, judge calibration, token reports, health history |
| `runs/` | Agent-run transcripts, read during the weekly review |
| `harness-archive/` | Phase artifacts kept for provenance, not loaded into context |
| `plugin/` | OpenCode plugin code |

### Key files

| File | What it is |
|---|---|
| `opencode.jsonc` | Providers, models, MCP servers, instruction paths |
| `AGENTS.md` | Operating rules — communication, safety, deployment, graph-memory policy |
| [`HARNESS-CONTRACT.md`](./HARNESS-CONTRACT.md) | The contract: lifecycle, responsibility boundaries, verification, autonomy levels |
| `HARNESS-ROADMAP.md` | 15-phase build plan with completion gates and evidence |
| `HARNESS-METRICS.md` | Metrics baseline and how to re-measure health |
| `WEEKLY-REVIEW.md` | The weekly transcript-reading ritual |
| `memory.md` | Rolling session memory |
| `harness-test.sh` | Run the fixture suite |
| `harness-backup.sh` | Timestamped tarball of the config |

## Install

```bash
git clone https://github.com/theDRElabs/opencode-config.git ~/.config/opencode
cd ~/.config/opencode
npm install

# graph-memory is a separate repo, cloned into place
git clone https://github.com/theDRElabs/graph-memory.git ~/.config/opencode/graph

bash harness-test.sh   # expect 62/63; the known failure is a headless-Chromium screenshot timeout
```

Back up anytime with `bash harness-backup.sh`.

## The weekly review

A fixed weekly slot, 30–60 minutes, timeboxed. If there were no new runs since the last review, skip — and the marker doesn't move.

It reads new run transcripts, failed fixture cases, trial flakes, and judge disagreements, then looks for: the agent going off-track without self-correcting, context bloat, token spend outliers, **unfair failures** (environment-caused, not agent-caused — these become fixtures instead of being scored against the agent), and new successful patterns worth promoting into a skill.

Every review appends an audit line to `HARNESS-METRICS.md`. A review with no entry did not happen.

## Status

All 15 harness phases complete (Milestones A–C: manual pipeline → safe sequential autonomy → controlled parallel building). One known failure: a headless-Chromium screenshot timeout, environmental.

## Secrets

No API keys are committed. `.env.example` holds placeholders only; real keys live in an untracked `.env`. CI fails if a `.env` or private key is ever tracked.

## License

[MIT](./LICENSE)
