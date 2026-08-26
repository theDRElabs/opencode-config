---
name: project-feedback
description: Define and run a project's deterministic format, lint, typecheck, test, build, migration, E2E, startup, and test-data checks. Use when implementing an issue, preparing a pre-merge result, or recording unavailable verification.
---

# Project Feedback

Use `HARNESS-PROJECT-FEEDBACK.md` as the global contract and project-local
instructions as the command source of truth.

## Workflow

1. Discover the repository's package manager, lockfile, project instructions,
   scripts, migration tooling, Playwright configuration, startup command, and
   deterministic test-data setup.
2. Classify each check as applicable or unavailable before running it. Never
   invent a command. An unknown command is `UNAVAILABLE`, not `PASS`.
3. Run fast checks for the changed surface. Add affected migrations, build,
   E2E, startup, or test-data checks when the issue requires them.
4. Run the full pre-merge sequence for the complete change.
5. Capture complete command output, exit codes, and artifact locations.
6. Stop completion on any `FAIL`, including typecheck, tests, lint, and build.
   Record `BLOCKED` or `UNAVAILABLE` with owner and residual risk.

## Pipeline Selection

- Eligible heavy web projects use `pipeline-init` and the reusable GitHub
  CI/Playwright/Vercel pipeline.
- Tiny or local-only projects do not receive deployment infrastructure.
- Android/Gradle projects use only their repo-local Java 17/Gradle workflow;
  never run `pipeline-init`.

## Result Shape

Return one row per applicable check containing `name`, `command`, `cwd`,
`exit_code`, `result`, and `evidence`. For unavailable checks also include
`reason`, `substitute`, `owner`, and `residual_risk`. A terse green summary is
not sufficient when full logs exist.
