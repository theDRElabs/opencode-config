# Evals Upgrade Plan — Phases 15–22

**Created**: 2026-09-15
**Status**: Ready for delegation
**Executor model**: sequential-afk-runner (one phase = one bounded issue), except where marked HITL
**Control documents**: `HARNESS-ROADMAP.md` (phase log), `HARNESS-METRICS.md` (baselines)
**Source principles**: @Hrushikeshhhh evals post (2026-09-14) — trials/consistency, token spend, partial credit, real-failure sourcing, judge calibration, weekly transcript reading, eval-of-evals

---

## Why this plan exists

The harness already has a real eval layer: 8 fixture suites, 63 cases, deterministic code graders, a baseline table, and an improvement log (see `HARNESS-METRICS.md`, 2026-09-10 baseline). Seven gaps remain against the source principles:

| # | Gap | Evidence (verified 2026-09-15) |
|---|-----|-------------------------------|
| G1 | No trials/repeats — consistency unmeasured | `collect-metrics.sh` runs each suite once |
| G2 | No token/cost accounting | metrics track static context overhead only, not spend |
| G3 | Binary pass/fail — no partial credit | `run_case` in every `run-validation.sh` asserts exit code equality only |
| G4 | Fixtures are hand-written, not sourced from real failures | no intake process; known incidents (manual-qa screenshot timeout, tdd sqlite3 miss) never became regression cases |
| G5 | LLM-judge (fresh-context-review) has no calibration | no agreement % vs expected, no judge version stamp, no "unknown" escape |
| G6 | No weekly transcript-reading ritual | `runs/` contains transcripts nobody is scheduled to read |
| G7 | No eval-of-evals | no reference-output validation, no mutation testing of graders |

**Keystone constraint**: nearly everything builds on one missing primitive — a machine-readable, per-case, scored results format. Today `collect-metrics.sh` counts cases by grepping `exit=` lines and infers fail counts from suite exit codes (fragile, sometimes wrong). Phase 15 fixes this first; do not reorder.

---

## Current-state facts the executor must rely on (do not re-derive)

- Fixture suites live in `~/.config/opencode/fixtures/<suite>/run-validation.sh`, discovered by directory scan.
- Every suite uses the same `run_case` bash pattern printing `name exit=N expected=N cwd=... duration_s=... evidence=...` to a `results.txt` in `/tmp/opencode/`.
- Metrics output goes to `/tmp/opencode/metrics-<ts>/` — **ephemeral, lost on reboot**. No history is persisted in-repo.
- `sqlite3` CLI is NOT installed. SQLite access works via `node:sqlite` (DatabaseSync) — proven pattern in `fixtures/tdd-bounded`.
- `~/.local/share/opencode/opencode.db` has a `session` table with columns: `id, project_id, directory, title, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, agent, model, time_created, time_updated` — full per-session token accounting exists.
- Agent-run transcripts (the model-dependent kind) live in `~/.config/opencode/runs/<project>/<milestone>/ISSUE-*/attempt-*/` as `implementation-result.md`, `review.md`, `events.jsonl`.
- `fresh-review` fixture already has `expected-findings.json` — a seed calibration set.
- Known environmental failure: manual-qa screenshot capture times out (no GPU/fonts). Functional parts pass. Do not "fix" by weakening the case; isolate or skip-with-reason.
- Harness config dir is a git repo. Git email MUST be `144799227+theDRElabs@users.noreply.github.com`.
- Node is available; `timeout`, `find`, `grep`, standard coreutils available.

---

## Phase 15 — Results contract v2 + persistent metrics history

**Fixes**: G3 (enabling layer), metrics fragility, ephemeral history
**Depends on**: nothing
**Classification**: AFK
**Budget**: ≤ 12 files touched, ≤ 3h

### Work

1. **Define the case-result record** (single source of truth). Each suite's `run-validation.sh` must emit, alongside existing output, one JSON line per case to `$LOGS/case-results.jsonl`:
   ```json
   {"suite":"tdd-bounded","case":"domain-red","expected":1,"actual":1,"score":1.0,"status":"pass","duration_s":2,"evidence":"/path/to/log","timestamp":"2026-09-15T21:00:00Z"}
   ```
   - `score` is 0.0–1.0. Phase 15 keeps it binary (0 or 1) — the field exists so later phases don't break the format.
   - Minimal implementation: extend the shared `run_case` pattern (each suite has its own copy — update all 8 identically; consider extracting a shared `fixtures/_lib/run-case.sh` sourced by all suites to end the copy-paste).
2. **Fix `collect-metrics.sh`**: parse `case-results.jsonl` (via `node`, not grep) instead of counting `exit=` lines and inferring failures. Emit: per-suite case counts, per-suite mean score, totals. Keep `--json` and human modes. Backward-compat: if a suite emits no JSONL, fall back to current behavior with a `legacy` flag.
3. **Persist history in-repo**: append one summary line per collection run to `metrics/history.jsonl` (new dir `~/.config/opencode/metrics/`). Commit history with the harness repo. `/tmp` stays as scratch only.
4. **Update `harness-test.sh`** to consume the same JSONL for its health report.

### Acceptance gates (all must pass)

```bash
bash ~/.config/opencode/harness-test.sh                # exit 0 (manual-qa known-fail policy: see below)
bash ~/.config/opencode/scripts/collect-metrics.sh --json | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{const j=JSON.parse(d);if(!j.totals.mean_score)process.exit(1);console.log('ok',j.totals)})"
test -s ~/.config/opencode/metrics/history.jsonl       # history persisted
```
- Every suite emits valid JSONL (verify: `node -e` parse of each `case-results.jsonl`, no exceptions).
- Case counts from JSONL match the 2026-09-10 baseline (63 cases) or better.
- Manual-qa: suite may fail on the known screenshot timeout; the run must record it as a single failing **case**, not corrupt the suite's other case results.

### Deliverables
`fixtures/_lib/run-case.sh` (if extracted), 8× updated `run-validation.sh`, rewritten `collect-metrics.sh`, updated `harness-test.sh`, `metrics/history.jsonl`, roadmap Phase 15 entry.

---

## Phase 16 — Partial credit

**Fixes**: G3
**Depends on**: Phase 15
**Classification**: AFK
**Budget**: ≤ 6 files touched, ≤ 2h

### Work

1. Add `score` semantics to the results contract doc (write `fixtures/_lib/RESULTS-CONTRACT.md`): 0.0 = total failure, 1.0 = full success, continuum allowed.
2. Upgrade graders where a continuum genuinely exists — do NOT force it where binary is honest:
   - `fresh-review/assert-review.js`: score = fraction of `expected-findings.json` findings correctly identified (recall) — a review finding 3 of 4 real issues scores 0.75, not 0.
   - `project-feedback` suite: partial pass when some checks pass (if its graders support per-check output; otherwise leave binary and note why).
   - tdd-bounded, issue-sandbox, architecture-audit, runners: keep binary (contract acceptance is binary) — document this decision in RESULTS-CONTRACT.md.
3. Suite-level score = mean of case scores; add to metrics output and history.
4. Set thresholds, not cliffs: `harness-test.sh` reports suite score; a suite "passes" at score 1.0 for binary suites; scored suites get explicit thresholds in their `run-validation.sh` (e.g. fresh-review ≥ 0.9).

### Acceptance gates

- Mutation check: temporarily remove one expected finding from a copy of the fresh-review fixture input → grader must emit score < 1.0 and the suite must still respect its threshold logic (restore after).
- `collect-metrics.sh --json` shows `mean_score` per suite; history line includes it.
- RESULTS-CONTRACT.md documents which suites are binary and why.

---

## Phase 17 — Trials and consistency

**Fixes**: G1
**Depends on**: Phase 15
**Classification**: AFK
**Budget**: ≤ 4 files, ≤ 2h + runtime

### Work

1. New `scripts/run-trials.sh`:
   ```bash
   bash scripts/run-trials.sh --suite tdd-bounded --n 5
   bash scripts/run-trials.sh --all --n 3      # default n=3, full run
   ```
   Runs a suite N times, collects per-trial `case-results.jsonl`, builds a consistency matrix (case × trial → agreement %), writes `metrics/trials-<suite>-<ts>.json`.
2. **Two-tier interpretation** (critical — do not skip):
   - Deterministic suites (all 8 current ones): 100% agreement expected across trials. Any variance = environmental flake (like the manual-qa timeout) → open an issue, don't blame the "agent".
   - Model-dependent evals (Phase 19+ calibration runs, real AFK runs): agreement % is a first-class metric. Same task, same conditions, N runs, same verdict?
3. Add `consistency` section to metrics output when trials data exists.
4. Run a full `--all --n 3` baseline and record it in HARNESS-METRICS.md.

### Acceptance gates

```bash
bash ~/.config/opencode/scripts/run-trials.sh --suite tdd-bounded --n 3   # exit 0, consistency 100%
test -f ~/.config/opencode/metrics/trials-*.json                          # trial artifact exists
```
- Consistency matrix renders in HARNESS-METRICS.md baseline update.
- Any non-deterministic case is classified env-flake vs real-variance with evidence (the failing trial's log path).

---

## Phase 18 — Token and cost accounting

**Fixes**: G2
**Depends on**: Phase 15 (history format)
**Classification**: AFK (spike is bounded; if schema is unusable, stop and report — do not invent data)
**Budget**: ≤ 4 files, ≤ 2h

### Work

1. New `scripts/token-report.sh` (bash + `node:sqlite`, NO sqlite3 CLI):
   - Rollups from `opencode.db` `session` table: tokens/cost grouped by `agent`, by `directory` (project), by day; top-N most expensive sessions.
   - Output: human table + `--json`.
2. Distinguish two token layers in the report (name them explicitly):
   - **Harness-development spend** (sessions in `~/.config/opencode` dir) — cost of building/maintaining the harness.
   - **Project execution spend** (sessions in project dirs, e.g. data-check) — what the agents cost doing real work.
3. Wire into `collect-metrics.sh`: append per-collection-day totals to `metrics/history.jsonl`.
4. Optional (only if trivially joinable): link `runs/data-check/M6/ISSUE-*/` attempts to session IDs via `events.jsonl` or manifests for per-issue cost. If the join is not clean, skip and record that finding.

### Acceptance gates

```bash
bash ~/.config/opencode/scripts/token-report.sh --json | node -e "/* verify non-empty totals + agent grouping */"
```
- Report shows real numbers (session table is populated — verified non-empty).
- History lines carry token totals going forward.
- No fabrication: any gap (e.g. un-attributable sessions) is reported, not guessed.

---

## Phase 19 — LLM-judge calibration (fresh-context-review)

**Fixes**: G5
**Depends on**: Phases 15, 16 (scored results)
**Classification**: AFK for corpus + tooling; HITL for the human-grade anchor set (user grades ~10 cases once)
**Budget**: ≤ 8 files, ≤ 4h agent time + one HITL session

### Work

1. **Build the calibration corpus** (new dir `fixtures/fresh-review/calibration/`): 10–15 cases, each = `{diff.patch, issue.md, standards.md, expected-findings.json}`:
   - Seed from existing fixture (1 case, already present).
   - Convert 5–8 real reviews from `runs/data-check/M6/ISSUE-*/attempt-*/review.md` (the diff and review exist per issue — pair them).
   - Add 2–3 negative controls: diffs with NO real issues; the correct verdict is "no findings" (catches a judge that always finds something).
   - Add 1–2 ambiguous cases where the correct verdict is "unknown/insufficient information".
2. **Judge protocol changes** (edit `skills/fresh-context-review/SKILL.md`):
   - Judge output must carry a version stamp: model id + prompt/skill version + date.
   - Add explicit escape: "return `unknown` when evidence in the diff/transcript is insufficient — never fabricate a verdict."
   - One dimension per judge invocation: if a review grades correctness AND completeness AND style, that becomes separate judge passes, not one blended verdict.
3. **Calibration runner** `scripts/calibrate-judge.sh`: runs the judge (via a fresh Task subagent per case — producer ≠ verifier) over the corpus, scores agreement vs `expected-findings.json` (recall, precision, unknown-rate), writes `metrics/judge-calibration-<ts>.json`.
4. **HITL gate**: user hand-grades the corpus once (10 min/case max — the expected-findings files make this a confirm/edit pass). Where user and expected disagree, user wins; corpus is updated.
5. Record baseline agreement % in HARNESS-METRICS.md. Target: ≥ 0.85 recall, ≥ 0.75 precision, unknown-rate < 10% on ambiguous cases. Do not tune the judge to hit the numbers in the same run that measures them — that's for a later iteration.

### Acceptance gates

- Corpus: 10+ cases, ≥ 2 negative controls, ≥ 1 unknown-verdict case, all with expected outputs.
- Calibration run produces a JSON artifact with per-case verdicts + aggregate agreement.
- SKILL.md changes committed; version stamp present in a sample judge output.
- Disagreement list produced for the HITL session (case, expected, actual, hypothesis).

---

## Phase 20 — Real-failure sourcing pipeline

**Fixes**: G4
**Depends on**: Phase 15 (format)
**Classification**: AFK
**Budget**: ≤ 10 files, ≤ 3h

### Work

1. **Intake template** `fixtures/_intake/TEMPLATE.md`:
   - Source (bug tracker / support queue / incident / manual check), date, symptom, minimal reproduction, expected outcome, outcome check command, link to original artifact.
2. **Intake rule** (add to `AGENTS.md` harness section + `fixtures/_intake/README.md`): every harness incident that required a fix becomes a fixture case within the same session that fixes it. No exceptions.
3. **Backfill from history** (bounded: stop at 6 cases): mine `HARNESS-ROADMAP.md` phase log + `HARNESS-METRICS.md` improvement log + `git log` of the harness repo for real past failures. Confirmed candidates already known:
   - tdd-bounded sqlite3 CLI absence → the fix (node:sqlite) exists; add a case asserting no `sqlite3` CLI dependency (e.g. grep grader scripts for `sqlite3 ` bare calls, must find none, plus run the suite in an env without it — or simpler: assert the graders run with `PATH` stripped of sqlite3).
   - manual-qa stale hardcoded path (`/home/DRE/projects/lumen/`) → case asserting no stale absolute paths in manual-qa scripts (grader: scan for paths that don't exist on this machine).
   - Any 2–4 more from git log (e.g. Phase 5 "Independent Verification Repairs", Phase 11 environment incident).
4. Each backfilled case lands in the matching suite's `run-validation.sh` with the Phase 15 JSONL format.
5. Update the intake README with the running count: target per source principles is 20–50 real-derived tasks in the suite overall (current hand-written 63 stay; real-derived adds on top).

### Acceptance gates

- `harness-test.sh` passes with all new cases counted in JSONL totals.
- ≥ 4 new real-failure-derived cases exist, each traceable to a documented incident (link in the case's comment).
- Intake template + rule committed; AGENTS.md harness section references it.

---

## Phase 21 — Weekly transcript-reading ritual

**Fixes**: G6
**Depends on**: nothing (can run parallel to 15–20)
**Classification**: HITL (habit needs the user's calendar); artifact creation is AFK
**Budget**: ≤ 3 files, ≤ 1h

### Work

1. Create `WEEKLY-REVIEW.md` in the harness root — the standing checklist:
   - Cadence: weekly, fixed slot; 30–60 min budget; skip only if no new runs.
   - Inputs, in priority order: (a) new `runs/*/ISSUE-*/attempt-*/` since last review, (b) failed fixture cases from the week, (c) trial flakes from Phase 17, (d) judge disagreements from Phase 19.
   - What to look for (from source principles): distraction (agent off-track without self-correction), context bloat, token spend outliers (Phase 18 report), unfair failures ("was that on the agent?"), new successful patterns worth promoting into fixtures/evals.
   - Output: dated entry in the HARNESS-METRICS.md Improvement Log — findings, fixture-case conversions (feeds Phase 20), and any decision made.
2. Add a session-log line format so reviews are auditable: date, transcripts read (paths), findings count, cases created.
3. Optional convenience: `commands/weekly-review.md` command stub that opens the checklist and prints the week's new runs (`find runs/ -newer <last-review-marker>`).

### Acceptance gates

- WEEKLY-REVIEW.md exists with the checklist, inputs, and log format.
- One logged "dry-run" review entry exists (executor performs it over `runs/data-check/M6` as the first instance — that's real data already on disk).
- Command stub (if created) resolves and lists the runs.

---

## Phase 22 — Eval-of-evals (meta-validation)

**Fixes**: G7
**Depends on**: Phases 15, 16, 19
**Classification**: AFK
**Budget**: ≤ 5 files, ≤ 3h

### Work

1. New `scripts/meta-validate.sh` with two checks:
   - **Reference-solution check**: every suite with an expected-output artifact (fresh-review `expected-findings.json`, calibration corpus, tdd green paths) must PASS against its own reference. A suite that fails its reference is broken (grader bug or rotting fixture) — implements "0%/100% across trials usually means a broken task, not an incapable agent".
   - **Mutation testing**: inject known defects into fixture inputs and verify graders FAIL:
     - fresh-review: delete a real issue from expected-findings → grader must score < 1.0.
     - tdd-bounded: flip a run-green script to always-exit-0 → the suite must catch it.
     - Minimum 3 mutations across suites; each mutation must be caught (grader returns fail/non-perfect score). A mutation that passes = the grader can't detect that defect class → report it, don't silently patch.
   - Mutations run on copies in `/tmp/opencode/meta-validate/` — never mutate the real fixtures in place.
2. Output: `metrics/meta-validation-<ts>.json` (checks run, passed, mutations caught/missed) + human summary.
3. Wire into `harness-test.sh` as an additional suite row (or a separate gate the test script calls).
4. Roadmap entry + baseline in HARNESS-METRICS.md (mutations-caught %).

### Acceptance gates

```bash
bash ~/.config/opencode/scripts/meta-validate.sh   # exit 0; all references pass, all mutations caught (or explicitly reported as gaps)
```
- Zero mutations leak into committed fixture files (`git status` clean after run).
- Meta-validation artifact in `metrics/`.

---

## Execution protocol (for the delegated agent)

1. **Order**: 15 → 16 → 17 → 18 → 20 → 22, with 19 after 16 (HITL anchor set before calibration baseline), 21 anytime (independent). One phase at a time — no batching.
2. **Per phase**: follow `skills/sequential-afk-runner` — fresh implementer, deterministic checks (the acceptance gates above), fresh independent verifier receiving ONLY the phase spec + artifacts. Max 2 retries per phase, then stop and escalate with findings.
3. **Bookkeeping per phase** (non-negotiable, same commit): append roadmap phase-log entry, update HARNESS-METRICS.md, append `metrics/history.jsonl`, commit with git email `144799227+theDRElabs@users.noreply.github.com`.
4. **Do not**: weaken a failing case to make a suite pass; delete the manual-qa screenshot case; rewrite suites beyond what the phase specifies; touch unrelated skills/config.
5. **Known-fail policy**: manual-qa screenshot timeout is environmental (no GPU). If it blocks gates, record as known-fail in JSONL (`"known_fail": true`) and let `harness-test.sh` exit 0 with the failure itemized — do not hide it.
6. **Escalate to user** (stop, don't decide alone): schema/data surprises in `opencode.db`, judge calibration numbers far below target after first honest run, any need to modify AGENTS.md beyond the Phase 20 intake rule line.

## Non-goals

- No LLM-judge for the 8 deterministic suites (they don't need it; adding one adds cost without signal).
- No production/performance monitoring, dashboards, or external eval frameworks — local scripts + committed JSONL only.
- No new fixture suites beyond the phases above (backfill cases land in existing suites).
- No prompt tuning of the judge inside Phase 19 — measure first, tune later with evidence.
