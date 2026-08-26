# Phase 5 Project Feedback Contract Validation

Date: 2026-08-25
Status: COMPLETED - INDEPENDENT VERIFICATION PASSED

## Rubric

The Phase 5 gate passes only if all items below are directly supported by the
complete fixture inputs, generated logs, and source artifacts.

| ID | Requirement | Evidence |
|---|---|---|
| A | The convention names format, lint, typecheck, tests, build, migrations, E2E, startup, and test-data. | `HARNESS-PROJECT-FEEDBACK.md` lines 12-29 |
| B | Fast per-issue and full pre-merge checks are distinct, sequential, and require exact command/exit/log evidence. | convention lines 31-54; skill and command |
| C | Unavailable checks require reason, substitute, owner, and residual risk. | convention lines 26-29, 79-84; fixture `PROJECT-FEEDBACK.md` |
| D | Eligible heavy web projects are accepted for the global CI/Playwright/Vercel path; tiny/ineligible projects are not injected, and deploy is restricted to pushes to `main`. | convention lines 56-67; `eligible-web.log`, `ineligible-tiny.log`; caller template |
| E | Android projects use the separate Gradle path and are rejected by `pipeline-init` without Node/Vercel files. | convention lines 69-77; `android-rejected.log`, `android-isolation.log`; `data-check/.github/workflows/ci.yml` |
| F | Valid projects pass and injected type, test, lint, and build failures each return non-zero and stop the chained full check. | complete logs under `/tmp/opencode/p5-validation/logs/` |
| G | Reusable web CI has no soft-fail behavior for typecheck, lint, or tests, and its YAML parses. | `pipeline/.github/workflows/ci.yml`; `pipeline-static.log`; YAML parser exit 0 |

## Fixture Inputs

Authoritative fixture source is `/root/.config/opencode/fixtures/project-feedback/`.
The valid Node fixture declares `format`, `lint`, `typecheck`, `test`, `build`,
and `start`, with a lockfile. Its project feedback file explicitly marks
migrations, E2E, startup, and test-data unavailable for that fixture and records
substitutes and residual risks. The Android fixture contains Gradle markers only.

## Exact Sequential Commands

All commands ran in one process at a time on 2026-08-25:

1. `bash -n /root/projects/pipeline/pipeline-init.sh` -> `0`.
2. `bash -n /root/.config/opencode/fixtures/project-feedback/run-validation.sh` -> `0`.
3. `bash /root/.config/opencode/fixtures/project-feedback/run-validation.sh` -> `0`.
4. `node -e 'const fs=require("fs"); const YAML=require("/root/.config/opencode/node_modules/yaml"); YAML.parse(fs.readFileSync(process.argv[1],"utf8")); console.log("yaml valid")' /root/projects/pipeline/.github/workflows/ci.yml` -> `0`.
5. `opencode debug config` -> `0`; the command and `project-check` resolve in the generated configuration. Secret values printed by this diagnostic are not copied into evidence.

The fixture runner's complete result log is
`/tmp/opencode/p5-validation/logs/results.txt`. Its complete individual command
logs are `valid-full.log`, `type-fail.log`, `test-fail.log`, `lint-fail.log`,
`build-fail.log`, `eligible-web.log`, `ineligible-tiny.log`,
`android-rejected.log`, `android-isolation.log`, and `pipeline-static.log` in
that directory. No operator-selected excerpt is used as the result record.

## Observed Results

- `valid-full`: exit `0`; format, lint, typecheck, test, and build all passed.
- `type-fail`: exit `1`; syntax/typecheck error stopped before tests and build.
- `test-fail`: exit `1`; assertion failure stopped before build.
- `lint-fail`: exit `1`; lint policy failure stopped before typecheck.
- `build-fail`: exit `1`; injected build failure occurred after earlier checks passed.
- `eligible-web`: exit `0`; check-only eligibility accepted the lockfile and required scripts.
- `ineligible-tiny`: exit `3`; no package manifest, and no files were injected.
- `android-rejected`: exit `2`; Gradle marker rejected Node/Vercel pipeline.
- Android isolation: no `package.json` or `.github/workflows/pipeline.yml` created.
- Pipeline static gate: no `continue-on-error`; typecheck, lint, test, and build are hard gates.
- The caller template deploy job is limited to `push` events on `refs/heads/main`; pull requests cannot invoke production deploy.

## Residual Risks

- The fixture proves the contract and local pipeline source, not a live GitHub
  Actions run or Vercel deployment; credentials and remote side effects are out
  of scope for this validation.
- Android build execution is unavailable locally because this device has no JDK
  or Android SDK. The repo-local workflow and CI command are the substitute;
  remote CI remains the authoritative build evidence.
- Real projects must still declare accurate migrations, startup, E2E, and test-data
  commands in project-local instructions; the convention does not infer them.
- The fixture runner records command, working directory, environment marker,
  duration, exit code, and evidence path for each generated log; it does not
  perform a live GitHub Actions or Vercel run.

## Gate

Two completed fresh independent verifier attempts returned `FAIL` and drove
repairs. Verifier `ses_fc93486baffexBqWuckm01yGQw` found incomplete web
eligibility, production deploy on pull requests, and incomplete evidence shape.
Verifier `ses_fc71adeecffeAWenSTlOviDRkC` confirmed the functional repairs but
found two static logs bypassing metadata capture and one inaccurate environment
record. Those evidence defects were repaired and fixtures rerun, but the
two-attempt retry budget is exhausted.

### Final Independent Verification

- Date: 2026-08-25.
- Verifier: fresh independent read-only verifier; session ID unavailable.
- Model: `gpt-5.6-sol` (`agentrouter-openai/gpt-5.6-sol`).
- Scope: complete source artifacts and complete generated logs in the working
  tree; no fixture rerun, file mutation, or new OpenCode process.
- Commands: shell syntax validation exited `0`; YAML parsing exited `0` and
  printed `yaml valid`.
- Result: rubric items A-G all passed with direct source and log evidence.
- Verdict: Phase 5 passes its completion gate.
