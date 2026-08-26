---
name: tdd
description: Enforce observable red, green, and refactor evidence for one bounded issue before implementation is reported complete.
---

# TDD

Use this skill only for one complete, human-accepted bounded issue. The issue is
the scope boundary; do not turn an implementation request into planning,
backlog generation, architecture work, or unrelated cleanup.

## Entry Gate

Before inspecting project code, verify that the supplied issue artifact contains:

- one issue ID and one observable outcome;
- explicit acceptance criteria, layers, modules, tests, constraints, and
  non-goals;
- known project commands for every applicable fast check;
- no unresolved human decision, unsafe HITL work, credential requirement,
  irreversible operation, or unknown command.

Reject or block the issue when any item is absent. `TYPE: hitl`, `STATUS:
blocked`, `COMMANDS: UNKNOWN`, unresolved `HITL`, or unsafe work is never
implementable by this agent. Do not infer missing details.

## Relevant Surface

Discover project-local instructions and the declared commands first. Inspect only
the modules, tests, migration files, and configuration needed by the issue. Treat
unrelated existing changes as read-only and preserve them. Do not add public
modules or cross boundaries not named by the issue; stop and report a boundary
conflict instead of expanding scope.

## Red, Green, Refactor

For behavior that can be tested:

1. **Red:** add or strengthen the smallest acceptance-focused test, run the
   declared focused test command, and record a genuine non-zero result caused by
   the missing behavior. A syntax error, missing dependency, or broken setup is
   not red evidence.
2. **Green:** make the smallest implementation that satisfies the acceptance
   criteria, rerun the same test, and record the zero exit result.
3. **Refactor:** inspect the diff and simplify names, duplication, or structure
   without changing behavior; rerun the affected test and fast checks, recording
   the final result. Refactor evidence may be “no safe refactor needed” only when
   the diff review and final checks are recorded.

For migrations, red must be a failing migration/application assertion or
rehearsal against a disposable database, green must show the migration and
affected behavior passing, and refactor must rerun the migration checks after
mechanical cleanup. Never run against production data.

If behavior is genuinely not executable-testable, state why, name the substitute
evidence, and obtain the issue's explicit human gate. Do not claim TDD completion
for unsafe or visual-taste-dependent work.

## Checks and Evidence

Run the project's declared fast checks sequentially, not invented commands. Stop
on the first blocking failure. Record each command exactly, cwd, command-scoped
environment and inherited environment provenance, start/end or duration, exit
code, and complete log or artifact path. `FAIL` blocks completion; `BLOCKED` and
`UNAVAILABLE` require owner and residual-risk records.

Return an implementation-result artifact, not a completion assertion, containing:

- issue ID and outcome;
- files changed and tests added;
- red, green, and refactor evidence;
- every check's command, cwd, environment, duration, exit code, result, and
  complete evidence path;
- preserved unrelated changes and module-boundary notes;
- unresolved risks, unavailable checks, and any follow-up issue.

Implementation, project checks, independent review, and human acceptance are
separate responsibilities. This skill never declares independent verification.
