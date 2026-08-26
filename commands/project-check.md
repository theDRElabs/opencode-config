---
description: Run and record deterministic project feedback checks without hiding failures.
agent: build
---

Use the `project-feedback` skill and `/root/.config/opencode/HARNESS-PROJECT-FEEDBACK.md`.
Inspect project-local instructions and scripts first. Run the requested mode
(`fast` or `full`) sequentially, choosing only declared commands. Report every
check with its exact command, cwd, exit code, result, and complete log/artifact
path. Record unavailable checks and residual risk. Any typecheck, test, lint,
or build failure is blocking; do not declare completion.

Request:
$ARGUMENTS
