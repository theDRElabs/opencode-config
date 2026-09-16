# Phase 22 kickstart prompt

Paste the block below into a fresh session to run the final phase.

---

~/.config/opencode/EVALS-UPGRADE-PLAN.md — run Phase 22 (Eval-of-evals /
meta-validation), AFK, the last phase of the 15–22 plan. Build
scripts/meta-validate.sh with the two checks the plan specifies:

1. Reference-solution check — every suite with an expected-output artifact
   (fresh-review expected-findings.json, the Phase 19 calibration corpus,
   tdd-bounded green paths) must PASS against its own reference. A suite
   that fails its own reference is broken (grader bug or rotting fixture).

2. Mutation testing — inject known defects into COPIES of fixture inputs in
   /tmp/opencode/meta-validate/ (never mutate the real fixtures in place)
   and verify graders FAIL:
   - fresh-review: delete a real issue from expected-findings → grader
     must score < 1.0
   - tdd-bounded: flip a run-green script to always-exit-0 → suite must catch it
   - minimum 3 mutations across suites; every mutation must be caught, and
     any that passes must be REPORTED as a gap, not silently patched.

Output metrics/meta-validation-<ts>.json (checks run, passed, mutations
caught/missed) + a human summary. Wire it into harness-test.sh as an
additional suite row or a separate gate. Update HARNESS-ROADMAP.md phase
log and add a mutations-caught% baseline to HARNESS-METRICS.md.

Acceptance gates (from the plan):
  bash ~/.config/opencode/scripts/meta-validate.sh   # exit 0; all references
                                                     # pass, all mutations
                                                     # caught (or explicitly
                                                     # reported as gaps)
  git status --short                                 # clean after run —
                                                     # zero mutations leak
  metrics/meta-validation-*.json exists

Already-shipped context you must rely on (do not re-derive):
- Phase 19 judge calibration is committed (902cddf): corpus at
  fixtures/fresh-review/calibration/ (13 cases, 2 positive controls,
  3 negative controls, 2 unknown-verdict), runner at
  scripts/calibrate-judge.sh, artifact metrics/judge-calibration-20260916-103327.json.
  Its PASS-case expected-findings.json files carry `findings: []` with the
  historical notes under `non_blocking_notes`; the verdict is the scored
  signal there. Use the positive-control cases (pos-amount-validation,
  pos-swallowed-upload) and seeded-review for reference/mutation checks.
- fixture case-result contract: fixtures/_lib/RESULTS-CONTRACT.md
- shared lib: fixtures/_lib/run-case.sh (run_case, run_scored_case)
- collect-metrics.sh parses per-case JSONL via node; history in
  metrics/history.jsonl
- manual-qa known-fail policy: KNOWN_FAIL_CASES=browser

Known gotchas:
- sqlite3 CLI absent — use node:sqlite (DatabaseSync), never the CLI
- opencode-provided models fail (no payment method); use xkiro models, e.g.
  xkiro/deepseek/deepseek-v4-flash
- `opencode run --agent fresh-reviewer` silently falls back because
  fresh-reviewer is mode: subagent — inject the judge protocol via the prompt
- runs/*/events.jsonl carries no session IDs
- manual-qa screenshot case is KNOWN_FAIL_CASES=browser

Leave unrelated working-tree changes untouched (.env.example, memory.md,
opencode.jsonc, GLOBAL-AGENTS-REWRITE-PLAN.md, agent/slice4-reviewer-glm.md,
and the pending HARNESS-ROADMAP.md status-row edit if still uncommitted).

Follow the Execution Protocol: one phase at a time, stop at any gate
requiring a human decision, and do NOT weaken a failing case or delete the
manual-qa screenshot case to make the gate pass. This is the final phase —
after it passes, the plan is complete.
