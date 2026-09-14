# Phase 10 Source Change Set

All Phase 10 changes live under `/root/.config/opencode/`. No other files were modified for
Phase 10. The roadmap status table is updated only after the gate passes.

## Harness Components

- `skills/sequential-afk-runner/SKILL.md`
- `commands/run-afk.md`
- `agent/sequential-afk-runner.md`

## Validation and Runner Artifacts

- `fixtures/sequential-afk-runner/runner.mjs`
- `fixtures/sequential-afk-runner/adapter.mjs`
- `fixtures/sequential-afk-runner/test-runner.mjs`
- `fixtures/sequential-afk-runner/run-validation.sh`
- `HARNESS-PHASE-10-VALIDATION.md`
- `HARNESS-PHASE-10-DIFF.md`

## Generated Evidence

- `/tmp/opencode/p10-validation/logs/results.txt`
- `/tmp/opencode/p10-validation/logs/syntax-runner.log`
- `/tmp/opencode/p10-validation/logs/syntax-adapter.log`
- `/tmp/opencode/p10-validation/logs/syntax-shell.log`
- `/tmp/opencode/p10-validation/logs/scenarios.log`

## Context Documents (read-only references)

- `HARNESS-ROADMAP.md` Phase 10 section
- `skills/prd-to-issues/SKILL.md` issue schema
- `skills/tdd/SKILL.md` implementation-result contract
- `skills/fresh-context-review/SKILL.md` review contract
- `agent/bounded-implementer.md`
- `agent/fresh-reviewer.md`
