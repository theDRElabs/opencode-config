# Results Contract

Single source of truth for what a fixture case result means. Every suite emits
one JSON line per case to `case-results.jsonl` through `fixtures/_lib/run-case.sh`.

## Record shape

```json
{"suite":"fresh-review","case":"seeded-review","expected":0.9,"actual":1.0,"score":1.0,"threshold":0.9,"status":"pass","duration_s":1,"evidence":"/tmp/opencode/p7-validation/logs/seeded-review.log","known_fail":false,"timestamp":"2026-09-16T01:00:00Z"}
```

## Field semantics

| Field | Meaning |
|-------|---------|
| `expected` | Binary case: the required exit code. Scored case: the required minimum score (the threshold). |
| `actual` | Binary case: the observed exit code. Scored case: the observed score. |
| `score` | `0.0`–`1.0`. Binary cases emit only `1.0` or `0.0`. Scored cases emit a continuum. |
| `threshold` | Minimum `score` that counts as a pass. `1.0` for every binary case. |
| `status` | `pass`, `fail`, or `known_fail`. |
| `known_fail` | `true` only when a declared known-environmental case failed. Never used to hide a real failure. |

## Score semantics

- `0.0` = total failure.
- `1.0` = full success.
- Between the two = partial credit, used only where a genuine continuum exists.

A case passes when `score >= threshold`. A suite passes when every case passes
and `finish_suite` returns zero.

## Which suites are scored, and why

| Suite | Scoring | Reason |
|-------|---------|--------|
| `fresh-review` | scored, threshold `0.9` | The seeded-review grader measures recall against `expected-findings.json`. A reviewer that finds 5 of 6 real issues is materially better than one that finds none, and binary scoring throws that signal away. `0.9` tolerates one miss out of six. |
| `architecture-audit` | binary | Acceptance is contract-shaped: the audit either contains the required sections and detects the seeded gaps, or it does not. |
| `issue-sandbox` | binary | Isolation policy is yes/no. A namespace call or network escape is either present or absent. |
| `manual-qa` | binary | Each browser assertion is a discrete pass/fail check. |
| `parallel-afk-runner` | binary | Static policy assertions and scenario outcomes are yes/no. |
| `project-feedback` | binary | Each case injects exactly one defect (type, test, lint, or build) and asserts the check catches it. There is no meaningful partial state: a checker that catches the type error but not the lint error is a different case, not half a case. Per-check output would not change this — the unit of the case is one injected defect. |
| `sequential-afk-runner` | binary | Syntax and scenario outcomes are yes/no. |
| `tdd-bounded` | binary | Contract acceptance is binary: each red/green/refactor script either produces the required exit code or it does not. |

## Known failures

Known-environmental failures are declared per suite through `KNOWN_FAIL_CASES`.
A known-fail case records `status: "known_fail"` and `known_fail: true`, and does
not fail the suite. The only declared known-fail is `manual-qa/browser` (headless
Chromium screenshot timeout on a machine without GPU/font rendering). If it
regresses, it degrades to a single recorded known-fail case and the rest of the
suite still reports.

## Adding a scored case

Use `run_scored_case <name> <threshold> <grader...>`. The grader must write
`{"score": <0..1>, ...}` to the path in `$SCORE_FILE` and exit zero when it ran.
A missing or unparseable score file scores `0.0`.

Do not score a case where the outcome is genuinely binary — that hides a real
failure behind an average. Document any new scored suite in the table above.