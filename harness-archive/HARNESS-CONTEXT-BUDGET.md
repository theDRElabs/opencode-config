# Context Budget Report

**Date**: 2026-09-10
**Session**: S1-T3 (Harness Server Alignment)

---

## Summary

```
Context Budget Report
═══════════════════════════════════════

Total always-loaded overhead: ~27,000 tokens
Context model: Claude (200K window)
Effective available context: ~173,000 tokens (86.5%)

Status: HEALTHY — no immediate action needed.
```

---

## Always-Loaded Components (per session)

These load into EVERY session via system prompt, plugins, or instructions:

| Component | Source | Lines | Bytes | Est. Tokens |
|-----------|--------|-------|-------|-------------|
| Base system prompt | opencode built-in | — | — | ~2,500 |
| AGENTS.md | auto-loaded | 142 | 6,537 | ~1,634 |
| HARNESS-CONTRACT.md | `instructions` field | 118 | 5,305 | ~1,326 |
| memory.md (plugin tail) | memory.js inject | 24 | 989 | ~247 |
| hardened-rules (plugin) | hardened-rules.js inject | — | ~300 | ~75 |
| **Subtotal: prose** | | | | **~5,782** |

## MCP Tool Schemas (always available)

MCP servers run in background; their tool schemas are injected into every session:

| Server | Tools | Est. Tokens | Needed? |
|--------|-------|-------------|---------|
| context7 | 2 | ~1,000 | Yes (docs) |
| playwright | ~20 | ~10,000 | **Sometimes** |
| excalidraw | ~20 | ~10,000 | **Rarely** |
| **Subtotal: MCP** | ~42 | **~21,000** | |

## Total Always-Loaded

```
Prose:           ~5,782 tokens
MCP schemas:    ~21,000 tokens
                 ─────────────
Total:          ~26,782 tokens (13.4% of 200K)
```

---

## On-Demand Components (not loaded until invoked)

### Skills (26 total, ~3,560 lines)

**Harness-phase skills** (9, loaded when corresponding command runs):

| Skill | Lines | Tokens |
|-------|-------|--------|
| sequential-afk-runner | 76 | ~500 |
| architecture-audit | 99 | ~650 |
| fresh-context-review | 86 | ~560 |
| manual-qa-plan | 93 | ~600 |
| grill-me | 101 | ~660 |
| prd-to-issues | 106 | ~690 |
| write-prd | 63 | ~410 |
| tdd | 78 | ~510 |
| project-feedback | 38 | ~250 |
| **Subtotal** | **740** | **~4,830** |

**Domain skills** (17, loaded only when matching project type):

| Skill | Lines | Tokens | Notes |
|-------|-------|--------|-------|
| scrollcraft | 404 | ~2,630 | Very large, rarely needed |
| error-handling | 377 | ~2,450 | ECC origin, general patterns |
| e2e-testing | 327 | ~2,130 | Overlaps with harness TDD |
| shadcn | 277 | ~1,800 | Project-specific |
| design-md | 172 | ~1,120 | Stitch-specific |
| next-best-practices | 153 | ~995 | Overlaps with nextjs-app-router |
| vercel-react-best-practices | 149 | ~970 | External, Vercel-authored |
| frontend-design | 143 | ~930 | Merged with high-end-visual-design |
| project-memorial | 143 | ~930 | Archival only |
| find-skills | 141 | ~920 | Meta/discovery |
| context-budget | 136 | ~885 | Audit utility |
| nextjs-app-router-patterns | 115 | ~745 | Agent-only, overlaps with next-best-practices |
| listen | 96 | ~625 | Content mining |
| caveman | 87 | ~565 | Communication mode |
| ai-sdk | 78 | ~510 | Project-specific |
| graph-memory | 71 | ~460 | Utility |
| browse | 40 | ~260 | Utility |
| **Subtotal** | **2,708** | **~17,820** |

### Agents (12 total, ~538 lines)

Only loaded when spawned via Task tool. Descriptions are injected into Task context:

| Agent | Lines | Role |
|-------|-------|------|
| security-reviewer | 131 | Read-only security review |
| silent-failure-hunter | 76 | Silent failure detection |
| pr-test-analyzer | 71 | PR test coverage review |
| vision-reader | 46 | Image reading (glm-5.3 model) |
| fresh-reviewer | 39 | Independent review |
| bounded-implementer | 36 | Issue implementation |
| architecture-auditor | 27 | Architecture audit |
| sequential-afk-runner | 26 | AFK orchestrator |
| issue-writer | 25 | Issue generation |
| manual-qa | 23 | QA planning |
| destination-writer | 20 | PRD writing |
| alignment | 18 | Requirements interview |
| **Subtotal** | **538** | **~3,500** (descriptions only) |

---

## Findings

### 1. MCP is the biggest lever (21K tokens, 78% of overhead)

Playwright (~10K) and Excalidraw (~10K) schemas are loaded every session but only needed for specific tasks. Context7 (~1K) is lightweight and broadly useful.

**Recommendation**: Disable `excalidraw` by default (set `"enabled": false`). Enable on-demand when needed. Playwright is harder — it's needed for manual-qa and e2e-testing, but those are invoked rarely. Consider disabling if not actively using those phases.

**Potential savings**: ~10,000 tokens (disable excalidraw alone)

### 2. Overlapping domain skills (resolved)

| Pair | Resolution |
|------|-----------|
| `nextjs-app-router-patterns` + `next-best-practices` | Marked `nextjs-app-router-patterns` as `user-invocable: false` (complementary, not merged) |
| `frontend-design` + `high-end-visual-design` | Merged tactical content into `frontend-design`, deleted `high-end-visual-design` |
| `e2e-testing` vs `tdd` | No action — both are harness-phase skills, not domain knowledge |

**Potential savings**: ~1,500 tokens per merge (only matters when loaded, not always)

### 3. HARNESS-ROADMAP.md is 59KB but NOT loaded

This is fine — it's a reference file, not injected into context. No action needed.

### 4. Security-scan skill removed (Claude Code-specific)

The `security-scan` skill referenced `ecc-agentshield` and `.claude/` directories — artifacts from the Claude Code ecosystem. Removed entirely as it cannot be adapted for opencode.

### 5. Total overhead is healthy

At 13.4% of context window, the system has ample room. The 28-skill count is not a problem because skills are on-demand. The real concern is MCP tool schemas, not skills.

---

## Recommendations (Priority Order)

1. **Disable excalidraw MCP** → save ~10K tokens per session (set `"enabled": false") — DONE
2. **Merge overlapping skills** → reduce skill count from 28 to 26, save ~2K when loaded — DONE
3. **Remove `security-scan`** → removed (Claude Code-specific) — DONE
4. **Consider disabling Playwright MCP** when not doing QA/E2E → save ~10K more
5. **No action needed on**: AGENTS.md, HARNESS-CONTRACT.md, agents, harness skills

**Maximum potential savings**: ~23K tokens/session (from MCP + merges)
**Realized savings**: ~12K tokens/session (disable excalidraw + skill consolidation)

---

## Verdict

The harness context budget is **healthy**. The 26-skill count is not a problem because skills are lazy-loaded. The real overhead is MCP tool schemas (78% of total). One simple change (disable excalidraw by default) cuts overhead by 37%. Phase 13 consolidation reduced skill count by 2 and removed the Claude Code-only security-scan.
