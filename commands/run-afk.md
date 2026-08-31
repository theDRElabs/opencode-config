---
description: Run a bounded, resumable sequence of dependency-ready AFK issues through sandboxed implementation, checks, and fresh review.
agent: sequential-afk-runner
---

Use the `sequential-afk-runner` skill. Require a human-accepted backlog directory,
run directory, a project repository, and explicit implement, check, and
fresh-review adapter commands. Run the executable with a bounded iteration count
and no more than two retries. Default to dry run unless the user explicitly
authorizes execution.

Wrap adapter invocations in the Phase 11 issue sandbox so each attempt runs in
its own worktree and branch with a constructed environment, allowlist shell and
git policy, protected production refs, denied network, and captured evidence.

Do not select HITL or blocked work, infer missing commands or decisions, weaken
failed gates, merge, push, deploy, or claim human acceptance. Report the exact stop
reason and evidence paths.

Arguments:
$ARGUMENTS
