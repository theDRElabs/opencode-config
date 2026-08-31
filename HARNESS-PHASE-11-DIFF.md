# Phase 11 Complete Change Set

Every path changed or created for Phase 11 (Sandboxing and Worktrees). The
verifier must read all of them.

## New files

- `/root/.config/opencode/fixtures/issue-sandbox/sandbox.mjs` — issue sandbox:
  per-issue worktree and `sandbox/<issue-id>` branch, constructed whitelist
  environment, policy manifest, adapter execution, evidence capture
  (adapter log, diffs, git log, status, artifacts, deny count, failure record),
  dry run, and protected-ref before/after verification. No merge, push, or
  deploy code path exists.
- `/root/.config/opencode/fixtures/issue-sandbox/guard-preload.cjs` — in-process
  guard loaded via `NODE_OPTIONS --require`: filesystem scope with realpath
  symlink-escape denial, protected git ref write denial, host path denial,
  binary and git-subcommand allowlist, shell execution denial, network
  (net/dns/tls/http/https) denial, and deny-log recording.
- `/root/.config/opencode/fixtures/issue-sandbox/test-sandbox.mjs` — adversarial
  deterministic fixtures: happy path with exact environment whitelist, hostile
  secrets, hostile paths (incl. symlink escape), hostile destructive commands
  (incl. `node -e` child escape), hostile production-branch mutation, hostile
  push/network, dry run, failure capture, and Phase 10 runner integration
  (success and fail-closed exhaustion).
- `/root/.config/opencode/fixtures/issue-sandbox/integration-adapter.mjs` —
  wraps the Phase 10 fixture adapter stages in the issue sandbox for runner
  integration.
- `/root/.config/opencode/fixtures/issue-sandbox/run-validation.sh` — sequential
  validation: syntax checks, namespace-free static check, CLI dry run, policy
  manifest assertions, and the full scenario suite.
- `/root/.config/opencode/HARNESS-PHASE-11-VALIDATION.md` — this phase's
  validation artifact.

## Modified files

- `/root/.config/opencode/agent/sequential-afk-runner.md` — orchestrator
  permissions hard-denied: `edit`, `read`, `glob`, `grep`, `task`,
  `external_directory` are denied; `bash` remains allowed solely to invoke the
  configured runner executable. Resolves the deferred Phase 10 verifier
  follow-up (instruction-level-only boundary).
- `/root/.config/opencode/skills/sequential-afk-runner/SKILL.md` — added the
  Issue Sandbox Isolation section.
- `/root/.config/opencode/commands/run-afk.md` — requires sandboxed adapter
  invocation and preserves the dry-run default and human gates.
- `/root/.config/opencode/HARNESS-ROADMAP.md` — Phase 11 implementation record,
  incident record, and tracker status.
- `/root/.config/opencode/memory.md` — 2026-08-29 proot ptrace breakage
  incident lesson (environment constraint that defines the sandbox design).

## Evidence directories (generated)

- `/tmp/opencode/p11-validation/logs/` — validation logs and results.
- `/tmp/opencode/p11-validation/<fixture>/` — per-fixture repos, host sentinels,
  run directories with attempt evidence, policies, deny logs, and violation
  reports.

## Unchanged (regression-verified)

- `/root/.config/opencode/fixtures/sequential-afk-runner/` — the Phase 10
  runner, adapter, and validation re-run at exit `0` unchanged.
