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

## Token & Cost Baseline: 2026-09-16

`bash scripts/token-report.sh` — rollups from the opencode `session` table via
`node:sqlite` (no `sqlite3` CLI on this host). Layers split harness-development spend
from project-execution spend.

| Layer | Sessions | Input tokens | Output tokens | Cost |
|-------|----------|--------------|---------------|------|
| harness_development (`~/.config/opencode`) | 0 | 0 | 0 | $0.000000 |
| project_execution (all other dirs) | 183 | 50,071,453 | 2,315,033 | $0.019276 |
| **Total** | **183** | **50,071,453** | **2,315,033** | **$0.019276** |

Also recorded: 976,651 reasoning tokens, 303,524,922 cache-read tokens, 0
cache-write tokens.

Top agents by input+output: `build` (103 sessions, 45,565,427 in), `fresh-reviewer`
(15), `general` (13), `explore` (12). Top directory: `/mnt/c/Users/Administrator`
(140 sessions, 46,578,239 in).

Known gap: the `harness_development` layer is empty — all 183 sessions have a
`directory` outside the harness config dir, so harness work is currently
indistinguishable from project work by directory alone. The optional
`runs/ISSUE-*/attempt-*` ↔ session join was skipped because `events.jsonl` contains
no session IDs.

---

## Improvement Log

### 2026-09-16: Phase 21 — Weekly Transcript-Reading Ritual (logged dry-run review)

- Added `WEEKLY-REVIEW.md` (cadence, inputs in priority order, what to look for,
  required log format, known limits), `commands/weekly-review.md`, and the marker
  `runs/.last-weekly-review`.
- **Dry-run review performed over `runs/data-check/M6`** as the first real instance.
  The last-review marker matched 34 files (33 across the 7 `ISSUE-*/attempt-1`
  bundles plus the milestone `events.jsonl`). What was actually read this session:
  the milestone `events.jsonl` in full; ISSUE-008's `review.md` in full (69 lines,
  head + tail regions overlapping); the first 30 lines only of the other six
  `review.md` (ISSUE-001 65L, 002 147L, 003 106L, 004 73L, 006 141L, 007 70L);
  and targeted regions of ISSUE-008's `phase2-result.md`. The `issue.md`,
  `input-manifest.md`, `implementation-result.md`, and the other `phase*-result.md`
  files were not read. That gap is the honest limit of this dry run and is itself a
  finding: one milestone's worth of transcripts does not fit a 30–60 min budget when
  read at depth.

Findings:

1. **Defective-test mechanism masked by the red phase (medium; 2 occurrences).**
   ISSUE-002: the phase-1 test wrote `7_999_999_000_000L` but asserted
   `1_000_000_000L`, and the red phase masked it because the stub returned 0
   (`events.jsonl` `test-defect-fixed`, 13:54). ISSUE-008: the pin test read
   `androidx.room.Query` by runtime reflection, which has BINARY retention, so red and
   green both failed at the same `assertNotNull` and the phase-1 red was misattributed
   (`events.jsonl` `green-failed-test-defect`, 17:20; confirmed in the ISSUE-008
   review). `run_case` asserts exit-code equality only, which is why both slipped
   through.
   → **Proposed fixture case** (feeds Phase 20): a tdd-bounded case asserting that a
   red run fails *at the intended assertion*, not merely non-zero.
2. **Reviewer contexts without shell or file-write (medium; 5 of 7 reviews).**
   ISSUE-001, 002, 006, 007, and 008 reviews disclose no shell and no file-write tool,
   so `git diff` / `git show` and CI re-execution were impossible; ISSUE-001/002/003
   could not be written to their requested path and were persisted verbatim by the
   orchestrator. Same task, different constraint set across attempts — an unfair
   comparison.
   → **Proposed fixture case** (feeds Phase 20): assert the review protocol declares
   tool availability up front, or that a missing shell is recorded rather than
   silently narrowing the evidence.
3. **Red-first proven only statically for the corrected mechanism (ISSUE-008).** The
   corrected source-file pin was committed after the SQL fix, so its red was never
   CI-executed; discriminating power was argued statically. Disclosed honestly in the
   review — an evidence gap, not a hidden one.
4. **Token attribution still unresolved (recurring; already logged in Phase 18).**
   `token-report.sh` today: 185 sessions, 51,245,716 input / 2,392,258 output tokens;
   `build` alone 105 sessions / 46,739,690 input. The `harness_development` layer is
   0 sessions, and `events.jsonl` has no session IDs, so per-issue cost remains
   unattributable. Recurrence noted, not re-opened.
5. **New successful pattern to promote: the source-file structural pin.** ISSUE-008's
   conversion from runtime annotation reflection to reading the DAO source and
   asserting normalized SQL substrings is reusable for pinning SQL that reflection
   cannot see (BINARY retention). Candidate for the tdd-bounded skill notes.

No fixture cases were created in this phase — the deliverable is the ritual artifact
plus this dry-run entry; the two proposals above are handed to the Phase 20 intake
pipeline. `metrics/history.jsonl` was not appended: its contract (Phase 15) is one
line per `collect-metrics.sh` run, and no fixture collection ran in this phase.

```
review: date=2026-09-16 transcripts_read=8(2 full, 6 head-30 only) findings=5 cases_created=0 proposed=2
```

### 2026-09-16: Phase 20 — Real-Failure Sourcing

- Intake pipeline committed: `fixtures/_intake/TEMPLATE.md` and
  `fixtures/_intake/README.md`, plus the standing rule in `AGENTS.md` (every
  harness incident that required a fix becomes a fixture case in the same session).
- Backfilled 6 real-failure cases into existing suites (no new suites):
  tdd-bounded `no-sqlite3-cli`, manual-qa `no-stale-absolute-paths`, issue-sandbox
  `env-injection-sanitized`, sequential-afk-runner `numeric-id-ordering`,
  project-feedback `results-contract-no-bypass` and `collectors-exclude-underscore`.
- New baseline: 71 cases, 71 pass, 0 fail, mean_score 1.0 (~159s wall).
  Two of the new graders were themselves false positives on first run (they matched
  their own source text); both were repaired, which is the intake rule working.
- Running count: 6 real-derived cases against a 20–50 target; the 65 hand-written
  cases stay and real-derived adds on top.

### 2026-09-16: Phase 18 — Token and Cost Accounting

- `scripts/token-report.sh` reports per-agent, per-directory, per-day, and top-N
  session token/cost rollups from the real `session` table.
- `collect-metrics.sh` history lines now carry token totals; metrics JSON exposes a
  `tokens` object.
- Findings recorded, not guessed: harness-development layer empty (directory is not
  a reliable harness/project discriminator); runs↔session join unavailable.

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

### 2026-09-16: Phase 19 — LLM-Judge Calibration Baseline

Judge: `xkiro/deepseek/deepseek-v4-flash`. Corpus: 13 cases
(`fixtures/fresh-review/calibration/`). Artifact:
`metrics/judge-calibration-20260916-103327.json`.

| Metric | Value | Target |
|--------|-------|--------|
| verdict_match_rate | 0.846 | — |
| mean_recall | 0.583 | >= 0.85 |
| mean_precision | 0.583 | >= 0.75 |
| unknown_rate | 0.154 | < 0.10 |
| ambiguous_unknown_rate | 1.00 | 1.00 |

This is the first honest calibration run, so the numbers are below target and
are reported as measured. Two instrument defects were fixed before this run
(real-case `source/` path prefix; PASS-case findings scored against another
reviewer's non-blocking notes). Recall and precision are unstable across runs
because the judge varies how many findings it lists. Known weaknesses: false
FAILs on clean no-op controls (2 of 3; which one flips is non-deterministic),
and `verification.log:8:uncovered-regression` missed on every FAIL-expected
case. One ground truth correction came out of the HITL gate: `m6-issue008`
was PASS in the historical review but is FAIL for the bundled case (AC5's
CI-green evidence is not in the bundle).
