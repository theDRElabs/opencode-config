# Phase 13: External Domain Skills

Read `/home/DRE/.config/opencode/HARNESS-ROADMAP.md` (lines 1-50 for rules, then search for Phase 13) and execute Phase 13: External Domain Skills.

## Context

The harness has 28 skills. Three pairs overlap (merge candidates from context budget audit):
- `nextjs-app-router-patterns` (114 lines) + `next-best-practices` (153 lines) — both cover Next.js App Router
- `frontend-design` (55 lines) + `high-end-visual-design` (98 lines) — both cover visual design
- `e2e-testing` (327 lines) overlaps with `tdd` (78 lines) + harness review

One skill is a Claude Code artifact that doesn't work here:
- `security-scan` (166 lines) — references `ecc-agentshield` and `.claude/` directories

## What To Do

1. Read all 3 overlapping pairs and determine: merge the smaller into the larger, or mark one as `user-invocable: false` (lazy-loaded by agent only, not user command)
2. Read `security-scan/SKILL.md` — decide: adapt for opencode (replace `.claude/` refs with opencode equivalents) or remove entirely
3. Apply the changes
4. Update `/home/DRE/.config/opencode/HARNESS-CONTEXT-BUDGET.md` with new skill count and token estimates
5. Update `/home/DRE/.config/opencode/HARNESS-ROADMAP.md` Phase 13 status to completed

## Rules

- Do not merge harness-phase skills (grill-me, write-prd, prd-to-issues, tdd, etc.) — those are the lifecycle, not domain knowledge
- When merging, preserve all unique content from both skills
- Mark each task `[in_progress]` before starting, `[completed]` after verification
- Do not touch active agent definitions or command files unless a skill merge requires it
