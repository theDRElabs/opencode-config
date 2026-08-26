---
description: Implement one accepted bounded issue using TDD and sequential project feedback.
agent: bounded-implementer
---

Use the `tdd` skill. The request must contain one complete bounded issue artifact
using the accepted issue contract, including acceptance criteria, module
boundaries, tests, known commands, constraints, and non-goals.

Reject before project inspection if the issue is missing required fields, is
`hitl` or `blocked`, has `COMMANDS: UNKNOWN`, contains unresolved human
decisions, requires unsafe/irreversible/credential-bound work, or would cross an
undeclared module boundary. Do not invent commands or requirements.

Implement only this issue. Inspect only the relevant project surface, preserve
unrelated changes, and keep implementation, verification, independent review,
and human acceptance separate. For testable behavior, record genuine red,
green, and refactor evidence. Run the declared fast checks sequentially and stop
on a blocking failure. Return a complete implementation-result artifact with
exact command, cwd, environment provenance, duration, exit code, result, and
complete log/artifact path for every check. Do not declare independent
verification.

Issue artifact:
$ARGUMENTS
