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

| Suite | Status | Cases | Pass | Fail | Mean score | Duration |
|-------|--------|-------|------|------|-----------|----------|
| architecture-audit | pass | 4 | 4 | 0 | 1.0 | 1s |
| fresh-review | pass | 5 | 5 | 0 | 1.0 | 1s |
| issue-sandbox | pass | 14 | 14 | 0 | 1.0 | 85s |
| manual-qa | pass | 4 | 4 | 0 | 1.0 | 55s |
| parallel-afk-runner | pass | 12 | 12 | 0 | 1.0 | 47s |
| project-feedback | pass | 11 | 11 | 0 | 1.0 | 17s |
| sequential-afk-runner | pass | 4 | 4 | 0 | 1.0 | 5s |
| tdd-bounded | pass | 11 | 11 | 0 | 1.0 | 4s |
| **Totals** | **8/8 pass** | **65** | **65** | **0** | **1.0** | **~215s** |

### Known Failures

None currently. The manual-qa screenshot case passed on the 2026-09-16 run (43–55s).
If it regresses it is recorded as a single `known_fail` case via
`KNOWN_FAIL_CASES=browser` and does not fail the suite.

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

## Trials Consistency Baseline: 2026-09-16

`bash scripts/run-trials.sh --all --n 3` — every suite runs 3 times; a case × trial
agreement matrix is built per suite. Deterministic suites expect 100%; any variance
is an environmental flake to be investigated as an issue.

| Suite | Tier | Cases | Trials | Consistency |
|-------|------|-------|--------|-------------|
| architecture-audit | deterministic | 4 | 3 | 100% |
| fresh-review | deterministic | 5 | 3 | 100% |
| issue-sandbox | deterministic | 14 | 3 | 100% |
| manual-qa | deterministic | 4 | 3 | 100% |
| parallel-afk-runner | deterministic | 12 | 3 | 100% |
| project-feedback | deterministic | 11 | 3 | 100% |
| sequential-afk-runner | deterministic | 4 | 3 | 100% |
| tdd-bounded | deterministic | 11 | 3 | 100% |
| **All** | — | **65** | **3** | **100% (min 100%)** |

Non-deterministic cases: none. Aggregate artifact:
`metrics/trials-all-20260916-023016.json`.

---

## Improvement Log

### 2026-09-16: Phase 17 — Trials and Consistency

- `scripts/run-trials.sh` repeats a suite N times and builds a case × trial agreement
  matrix. Deterministic suites expect 100%; model-dependent runs (Phase 19+) treat
  agreement as a first-class metric.
- Full baseline `--all --n 3`: 8/8 suites at 100% consistency, no non-deterministic
  cases, 65 cases × 3 trials. Artifact: `metrics/trials-all-20260916-023016.json`.
- `collect-metrics.sh` now emits a `consistency` section when trials artifacts exist.

### 2026-09-10: Phase 13 → Phase 14 transition

**Before** (pre-Phase 13):
- 28 skills, ~3,824 lines
- 2 fixture failures (tdd-bounded: `sqlite3` CLI missing; manual-qa: hardcoded stale path)
- Context overhead: ~26,782 tokens (excalidraw still counted)

**After** (Phase 13 + Phase 14 fixes):
- 26 skills, ~3,690 lines (Phase 13 consolidation)
- 1 fixture failure (manual-qa screenshot timeout — environmental)
- tdd-bounded fixed: replaced `sqlite3` CLI calls with `node:sqlite` built-in (no external dependency)
- manual-qa playwright path fixed: replaced stale `/home/DRE/projects/lumen/` with `/home/DRE/.config/opencode/`
- Context overhead: ~16,782 tokens (excalidraw disabled, excalidraw removed from count)

**Measured improvement**: Fixture pass rate 87.5% (7/8) → 96.4% (54/56 cases → 62/63 cases). tdd-bounded: 3/4 → 11/11 cases.

### 2026-09-16: Phase 16 — Partial Credit

- `fresh-review` scored by recall against `expected-findings.json`, threshold 0.9.
  Mutation (removed seeded F5) scored 0.8333 and failed threshold as intended.
- `fixtures/_lib/RESULTS-CONTRACT.md` documents which suites are scored and why the
  other seven stay binary.
- Baseline unchanged: 65 cases, 65 pass, mean_score 1.0.

### 2026-09-16: Phase 15 — Results Contract v2

- Per-case JSONL results replace `grep`-counting in `collect-metrics.sh`; metrics
  now report a real `mean_score` per suite and overall.
- `metrics/history.jsonl` persists one summary line per collection run in-repo.
- New baseline: 65 cases, 65 pass, 0 fail, mean_score 1.0, ~215s wall.
- Two pre-existing fixture defects fixed: stale `project-feedback` android case
  and `_lib` being counted as a suite.

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
