---
description: Review one bounded implementation in a fresh read-only context using complete artifacts and verification evidence.
agent: fresh-reviewer
subtask: true
---

Use the `fresh-context-review` skill. Review independently from the implementation
context and read only the supplied artifact bundle. Require one bounded issue,
observable acceptance criteria, the complete diff, applicable standards and module
boundaries, post-change source/test artifacts, and complete verification evidence.

Use the three specialist reviewers only for their named security, silent-failure,
and test-quality scopes. Do not edit, run commands, invoke implementers, remediate,
weaken tests, or claim human acceptance. Return the required verdict, severity-ordered
blocking and non-blocking findings with exact `path:line` evidence, required changes,
acceptance-criteria coverage, verification-evidence assessment, and residual risks.

Artifact bundle:
$ARGUMENTS
