---
description: Start a one-question-at-a-time requirements alignment interview without planning or editing code.
agent: alignment
---

Use the `grill-me` skill for this request.

Interview the user about `$ARGUMENTS` one decision at a time. Begin with the
highest-value missing decision, give a recommended answer and a brief reason,
and wait for the user's answer before asking the next question. Cover all
applicable alignment areas from the skill. Do not inspect or edit project files.

When the stop conditions are met, produce an alignment record and ask the user to
confirm it. Do not write a PRD, create issues, make a plan, or implement code.
