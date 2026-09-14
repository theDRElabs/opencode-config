# Phase 7 Fresh-Context Review Validation

Date: 2026-08-25
Status: PASS - INDEPENDENTLY VERIFIED

## Rubric

| ID | Requirement | Evidence |
|---|---|---|
| A | A general read-only reviewer requires one bounded issue, observable acceptance criteria, complete diff, applicable standards/module boundaries, and complete verification evidence. | `skills/fresh-context-review/SKILL.md`; `agent/fresh-reviewer.md`; `commands/review-issue.md` |
| B | Review context is independent from the producer; it cannot edit, execute shell commands, invoke implementers, weaken tests, or claim human acceptance. | `agent/fresh-reviewer.md`; `config-contract.log` |
| C | Security, silent-failure, and test-analysis specialists are read-only and limited to their named scopes; the general reviewer owns the integrated verdict. | `agent/security-reviewer.md`; `agent/silent-failure-hunter.md`; `agent/pr-test-analyzer.md`; `skills/fresh-context-review/SKILL.md` |
| D | Results require verdict, blocking/non-blocking findings, required changes, acceptance coverage, verification assessment, and residual risks; findings are severity ordered with exact file/line evidence. | `skills/fresh-context-review/SKILL.md`; `agent/fresh-reviewer.md` |
| E | Seeded fixtures detect a behavioral acceptance gap, weak/misleading test, swallowed error, authorization failure, unrelated implementation change, and uncovered regression. | Complete fixture bundle under `fixtures/fresh-review/`; `/tmp/opencode/p7-validation/logs/seeded-review.log` |
| F | Validation is deterministic and sequential, with commands, cwd, environment provenance, duration, exit code, and complete logs recorded. | `fixtures/fresh-review/run-validation.sh`; `/tmp/opencode/p7-validation/logs/` |

## Complete Fixture Inputs

- `/root/.config/opencode/fixtures/fresh-review/issue.md`
- `/root/.config/opencode/fixtures/fresh-review/standards.md`
- `/root/.config/opencode/fixtures/fresh-review/diff.patch`
- `/root/.config/opencode/fixtures/fresh-review/src/profile.js`
- `/root/.config/opencode/fixtures/fresh-review/test/profile.test.js`
- `/root/.config/opencode/fixtures/fresh-review/src/unrelated.js`
- `/root/.config/opencode/fixtures/fresh-review/verification.log`
- `/root/.config/opencode/fixtures/fresh-review/expected-findings.json`
- `/root/.config/opencode/fixtures/fresh-review/assert-inputs.js`
- `/root/.config/opencode/fixtures/fresh-review/assert-review.js`
- `/root/.config/opencode/fixtures/fresh-review/assert-result.js`
- `/root/.config/opencode/fixtures/fresh-review/assert-config.js`
- `/root/.config/opencode/fixtures/fresh-review/run-validation.sh`

## Sequential Commands and Evidence

All validation commands ran one at a time. No concurrent OpenCode processes were started.

1. `bash -n /root/.config/opencode/fixtures/fresh-review/run-validation.sh` -> `0`.
2. `node /root/.config/opencode/fixtures/fresh-review/assert-inputs.js /root/.config/opencode/fixtures/fresh-review` -> `0`; complete artifact bundle confirmed.
3. `node /root/.config/opencode/fixtures/fresh-review/assert-review.js /root/.config/opencode/fixtures/fresh-review` -> `0`; six findings detected in severity order.
4. `bash /root/.config/opencode/fixtures/fresh-review/run-validation.sh` -> `0`; complete corrected runner passed.
5. `opencode debug config` -> `0`; reviewer, command, specialist permissions, and task allowlist resolved. Output was inspected but not retained because resolved provider credentials are present.
6. The runner's `config-contract` check -> `0`; read-only permissions, specialist allowlist, implementer denial, and command binding passed.

The runner records command, cwd, inherited environment provenance, duration, exit code,
and evidence path in each log. Complete generated logs are:

- `/tmp/opencode/p7-validation/logs/syntax.log`
- `/tmp/opencode/p7-validation/logs/seeded-review.log`
- `/tmp/opencode/p7-validation/logs/result-contract.log`
- `/tmp/opencode/p7-validation/logs/complete-inputs.log`
- `/tmp/opencode/p7-validation/logs/results.txt`
- `/tmp/opencode/p7-validation/logs/config-contract.log`

## Observed Fixture Results

The seeded review returned `FAIL` and detected:

- `F1` critical `src/profile.js:3`: authorization is absent.
- `F2` high `src/profile.js:6`: repository errors are swallowed and reported as success.
- `F3` high `test/profile.test.js:3`: `assert.ok(response)` is a weak non-behavioral assertion.
- `F4` high `src/profile.js:3`: the required display-name behavior is not implemented.
- `F5` medium `src/unrelated.js:1`: the diff contains an unrelated implementation change.
- `F6` medium `verification.log:8`: passing evidence admits regression paths were not covered.

## Independent Verification Handoff

The completion decision must be made by one fresh read-only verifier that receives only
this rubric, the artifact paths above, the fixture paths above, and the generated log paths
above. It must not modify files or run an OpenCode process.

Fresh verifier: `ses_fc5eab7bdffevVeaNXWnZZ8Oaj`.

Verifier result: `PASS`. The verifier independently inspected the complete rubric,
source artifacts, fixture inputs, generated logs, and review-result artifact; it found
no unresolved blocking findings and confirmed Phase 8 remains pending.

## Decisions and Residual Risks

- Decision: the integrated reviewer is a separate agent with a strict read-only permission
  boundary; specialists provide evidence only for their named scopes.
- Decision: complete artifacts are mandatory when available; selected summaries do not
  satisfy the entry gate.
- Residual risk: deterministic fixtures validate workflow contracts and seeded detection,
  not model recall across arbitrary repositories or human product QA.
- Residual risk: specialist prompts retain some legacy remediation prose, but permissions
  and the Phase 7 workflow prohibit edits, commands, and remediation; simplify later.

## Gate

Phase 7 completion gate passed. Phase 7 is `completed` in the roadmap. Phase 8 remains
`pending` and was not started.
