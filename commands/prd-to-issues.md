---
description: Convert an accepted destination document into bounded vertical-slice issues without inspecting or editing project code.
agent: issue-writer
---

Use the `prd-to-issues` skill for this request.

The input must contain a destination document plus explicit confirmation that a
human accepted it. If acceptance is not explicit, stop and ask for it. Convert
only that document into vertical-slice issues using the required issue schema.
Every issue must deliver one observable user outcome across all needed layers.
Reject horizontal layer plans and infrastructure without a validated consumer,
and record them under `Rejected Slices`. Preserve every `UNKNOWN`, `HITL`,
`RESEARCH`, negative decision, non-goal, migration constraint, module-boundary
unknown, and test expectation. Mark unsafe or unresolved work as `hitl` with its
human decision. Each fenced issue block must contain exactly the schema fields
from the skill; put human decisions in `CONSTRAINTS` and the backlog-level
`HITL Queue`, not in extra issue fields. Use `blocked` for an unresolved human
gate even when `BLOCKERS: none` because human gates are not issue dependencies.
If verification commands are `UNKNOWN`, emit `TYPE: hitl` and `STATUS: blocked`.
Limit every issue to at most five acceptance criteria.
Keep any bounded `RESEARCH` branch explicit with its time box, read-only scope,
prohibited credentials/code, and human decision output; do not reduce it to an
untracked constraint.

Do not inspect or edit project files. Do not create backlog files, code, plans,
estimates, schedules, or implementations. Return the backlog, dependency map,
parallel branches, HITL queue, rejected slices, and handoff in the response.

Input:
$ARGUMENTS
