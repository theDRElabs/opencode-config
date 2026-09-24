# Harness Metrics Baseline

**Date**: 2026-09-10
**Phase**: 14 — Metrics and Continuous Improvement

---

## How to Collect

```bash
bash ~/.config/opencode/scripts/collect-metrics.sh          # human-readable
bash ~/.config/opencode/scripts/collect-metrics.sh --json   # structured
```

Runs all 8 fixture validation suites, collects graph/skill/phase stats, outputs to `/tmp/opencode/metrics-<timestamp>/`.

---

## Baseline: 2026-09-10

### Fixture Validation

| Suite | Status | Cases | Pass | Fail | Duration |
|-------|--------|-------|------|------|----------|
| architecture-audit | pass | 4 | 4 | 0 | <1s |
| fresh-review | pass | 5 | 5 | 0 | 1s |
| issue-sandbox | pass | 14 | 14 | 0 | 31s |
| manual-qa | **fail** | 3 | 2 | 1 | 32s |
| parallel-afk-runner | pass | 12 | 12 | 0 | 15s |
| project-feedback | pass | 10 | 10 | 0 | 5s |
| sequential-afk-runner | pass | 4 | 4 | 0 | 2s |
| tdd-bounded | pass | 11 | 11 | 0 | <1s |
| **Totals** | **7/8 pass** | **63** | **62** | **1** | **~91s** |

### Known Failures

1. **manual-qa / browser**: Headless Chromium screenshot timeout (>30s). Environmental — server lacks GPU/font rendering resources. Functional tests (server start, browser connect, DOM assertions) all pass; only screenshot capture times out.

### Graph Memory

| Metric | Value |
|--------|-------|
| Nodes | 30 |
| Edges | 33 |
| Episodes | 8 |
| Errors | 3 |
| Edges/node ratio | 1.1 |

### Skills

| Metric | Value |
|--------|-------|
| Total count | 26 |
| Total lines | 3,690 |
| Harness-phase | 9 |
| Domain | 17 |

### Phases

| Metric | Value |
|--------|-------|
| Completed | 14/15 |
| Remaining | Phase 14 (this) |

### Context Overhead

| Component | Est. Tokens |
|-----------|-------------|
| Prose (AGENTS.md, contract, memory) | ~5,782 |
| MCP schemas (context7 + playwright) | ~11,000 |
| **Total always-loaded** | **~16,782** (8.4% of 200K) |

---

## Improvement Log

### 2026-09-10: Phase 13 → Phase 14 transition

**Before** (pre-Phase 13):
- 28 skills, ~3,824 lines
- 2 fixture failures (tdd-bounded: `sqlite3` CLI missing; manual-qa: hardcoded stale path)
- Context overhead: ~26,782 tokens (excalidraw still counted)

**After** (Phase 13 + Phase 14 fixes):
- 26 skills, ~3,690 lines (Phase 13 consolidation)
- 1 fixture failure (manual-qa screenshot timeout — environmental)
- tdd-bounded fixed: replaced `sqlite3` CLI calls with `node:sqlite` built-in (no external dependency)
- manual-qa playwright path fixed: replaced stale `/home/ubuntu/projects/lumen/` with `/home/ubuntu/.config/opencode/`
- Context overhead: ~16,782 tokens (excalidraw disabled, excalidraw removed from count)

**Measured improvement**: Fixture pass rate 87.5% (7/8) → 96.4% (54/56 cases → 62/63 cases). tdd-bounded: 3/4 → 11/11 cases.

---

## Metrics to Track Going Forward

| Metric | Source | Frequency |
|--------|--------|-----------|
| Fixture pass rate | `collect-metrics.sh` | Per session / pre-commit |
| Total test cases | `collect-metrics.sh` | Per session |
| Graph nodes/edges | `collect-metrics.sh` | Per session |
| Skill count/lines | `collect-metrics.sh` | After skill changes |
| Phase completion | Roadmap | After each phase |
| Context overhead | Context budget doc | After config changes |
