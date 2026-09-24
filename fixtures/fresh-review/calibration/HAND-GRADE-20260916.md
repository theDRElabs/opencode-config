# Phase 19 judge calibration — final hand-grade sheet

- Artifact: `metrics/judge-calibration-20260916-103327.json`
- Judge: `xkiro/deepseek/deepseek-v4-flash`, agent `default`, skill `fresh-context-review@2026-09-16`
- Corpus: 13 cases
- Aggregate: verdict_match=0.8462 mean_recall=0.5833 mean_precision=0.5833 unknown_rate=0.1538 ambiguous_unknown_rate=1
- Targets (plan): recall >= 0.85, precision >= 0.75, unknown-rate < 10% on ambiguous

## Hand-grade decisions (user-confirmed)

| decision | case | call |
|---|---|---|
| 1 | m6-issue008 | Ground truth corrected PASS -> FAIL. The historical review PASSed only because the orchestrator verified a CI-green run out-of-band; that evidence is absent from the packaged bundle, so AC5 ("CI green on the fix") is unverified for the case as bundled. The judge found a real gap. |
| 2 | neg-clean-refactor | Judge error. Clean refactor of `src/format.js` preserving behavior; the two cited findings (`src/format.js:2`, `:12`) are the new UNITS table and pickUnit helper, which are the refactor itself. |
| 3 | neg-doc-only | Judge error. README heading rename + one added doc comment; no executable line differs. The cited `README.md:5` is the changed heading. |

The two negative-control false positives are recorded as judge errors, not ground-truth errors. Ground truth is unchanged for those cases (PASS).

## Run history

| run | verdict_match | recall | precision | disagreements | instrument state |
|---|---|---|---|---|---|
| 20260916-074805 | 0.769 | 0.302 | 0.719 | 10 | source/ prefix bug + PASS-findings mis-scoring |
| 20260916-081853 | 0.769 | 0.281 | 0.533 | 12 | prefix fixed, PASS-findings mis-scoring |
| 20260916-083817 | 0.769 | 0.444 | 0.833 | 6 | prefix + scoring fixed |
| 20260916-103327 | 0.846 | 0.583 | 0.583 | 6 | + m6-issue008 ground truth corrected |

Run 083817 -> 103327 delta: verdict_match +0.077 (m6-issue008 now matches), recall +0.139 (pos-amount-validation recovered after the judge listed all findings this run), precision -0.250 (the same two negative-control false positives returned, plus more spurious findings on pos-amount-validation and the unknown cases).

## Non-determinism on the negative controls (runs 2/3/4)

| case | run 2 | run 3 | run 4 | ground truth |
|---|---|---|---|---|
| neg-clean-refactor | FAIL | PASS | FAIL | PASS |
| neg-doc-only | FAIL | FAIL | FAIL | PASS |
| neg-test-addition | PASS | FAIL | PASS | PASS |

Two of three clean no-op changes draw a false FAIL, and which one flips is unstable across runs. This is judge variance on the controls.

## Recurring miss

`verification.log:8:uncovered-regression` is missed on all three FAIL-expected cases (seeded-review, pos-amount-validation, pos-swallowed-upload) in every run so far. One consistent blind spot.

## Final per-case table

| case | control | expected | actual | match | scored | recall | precision | expF | detF |
|---|---|---|---|---|---|---|---|---|---|
| m6-issue001 | - | PASS | PASS | yes | false | 1 | 0 | 0 | 1 |
| m6-issue002 | - | PASS | PASS | yes | false | 1 | 1 | 0 | 0 |
| m6-issue006 | - | PASS | PASS | yes | false | 1 | 1 | 0 | 0 |
| m6-issue007 | - | PASS | PASS | yes | false | 1 | 1 | 0 | 0 |
| m6-issue008 | - | FAIL | FAIL | yes | true | 0 | 0 | 1 | 2 |
| neg-clean-refactor | negative | PASS | FAIL | NO | false | 1 | 0 | 0 | 2 |
| neg-doc-only | negative | PASS | FAIL | NO | false | 1 | 0 | 0 | 1 |
| neg-test-addition | negative | PASS | PASS | yes | false | 1 | 1 | 0 | 0 |
| pos-amount-validation | positive | FAIL | FAIL | yes | true | 1 | 0.6667 | 4 | 6 |
| pos-swallowed-upload | positive | FAIL | FAIL | yes | true | 0.6667 | 0.6667 | 3 | 3 |
| seeded-review | - | FAIL | FAIL | yes | true | 0.6667 | 1 | 6 | 4 |
| unknown-external-contract | unknown | UNKNOWN | UNKNOWN | yes | false | 1 | 0 | 0 | 3 |
| unknown-locked-clamp | unknown | UNKNOWN | UNKNOWN | yes | false | 1 | 0 | 0 | 3 |

