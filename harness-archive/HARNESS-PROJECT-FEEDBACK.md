# Project Feedback Contract

Status: active
Owner: repository maintainers
Version: 1

This contract defines the executable evidence an agent must collect before an
issue or change can be marked complete. Project-local instructions may choose
different commands, but must expose the same check names and preserve the
blocking and unavailable-check rules below.

## Check Names

| Check | Purpose | Fast per-issue | Full pre-merge |
|---|---|---:|---:|
| format | Stable formatting and generated-file cleanliness | Changed files | Whole repository |
| lint | Static correctness and policy rules | Changed files or package | Whole repository |
| typecheck | Compile-time contracts without emit | Affected package | Whole repository |
| tests | Unit and integration behavior | Affected tests | Full suite |
| build | Production artifact compilation | When build-facing | Clean production build |
| migrations | Schema/data compatibility and rollback/rehearsal | Affected migration | Fresh database plus migration chain |
| e2e | Browser or system workflows | Affected spec/smoke | Required browser projects |
| startup | Application starts and reaches health/readiness | Affected service | Production-mode startup |
| test-data | Deterministic fixtures, seed/reset, no production data | Minimal fixture | Clean seeded dataset |

Every applicable check has one of these results: `PASS`, `FAIL`, `BLOCKED`, or
`UNAVAILABLE`. `FAIL` is blocking. `BLOCKED` is blocking unless a human gate is
explicitly recorded. `UNAVAILABLE` never becomes an implied pass: record the
reason, the exact substitute evidence, and the residual risk.

## Fast Checks

Run the smallest deterministic set covering the changed behavior, normally:
`format`, `lint`, `typecheck`, and affected `tests`. Add `migrations`, `build`,
`e2e`, `startup`, or `test-data` whenever the issue touches that surface.

Fast checks may use focused paths, but must use the project's real scripts and
must report every applicable check. A successful focused check does not replace
the full pre-merge contract.

## Full Pre-Merge Checks

Run from a clean checkout or equivalent clean working tree:

1. Install from the lockfile with the project's pinned toolchain.
2. Run format, lint, typecheck, tests, and build.
3. Run migrations against a disposable database, including the project's
   rehearsal/rollback check when defined.
4. Start the production artifact, wait for readiness, then run required E2E.
5. Reset and seed deterministic test data; retain reports and failure artifacts.

The exact command, exit code, duration, environment, and artifact paths belong
in the implementation result or validation evidence. Do not report only a
selected summary when complete logs are available.

## Web Pipeline Eligibility

An eligible heavy web project has a lockfile, reproducible Node scripts for
`typecheck`, `lint`, `test`, `build`, `start`, and `e2e`. The E2E script may be a
deterministic smoke check when browser behavior is not in scope, but it must be
declared because the reusable pipeline invokes it. It is intended for GitHub and/or
Vercel deployment. Run `pipeline-init <project-name>` once; the caller invokes
the reusable CI, Playwright E2E, and Vercel workflows from `theDRElabs/pipeline`.

The reusable CI checks are hard gates. Playwright sequencing is build, start,
wait-on, then E2E. Verify the production alias domain after deployment, not an
ephemeral deployment URL. A local-only or tiny experiment does not receive the
pipeline.

## Android Path

Android/Gradle projects never use `pipeline-init` and never receive Node,
Playwright, or Vercel configuration. Their repo-local workflow uses Java 17,
Gradle setup, and the established command:
`./gradlew assembleDebug testDebugUnitTest lint --stacktrace`.
Upload the debug APK as an Actions artifact. With no local JDK/SDK, CI is the
build evidence and the unavailable local check plus its residual risk must be
recorded.

## Evidence Record

For each check record: command, working directory, exit code, result, and log or
artifact path. For unavailable checks record: why it could not run, what was
substituted, who must resolve it, and residual risk. A failed typecheck, test,
lint, or build blocks completion even if later checks pass.
