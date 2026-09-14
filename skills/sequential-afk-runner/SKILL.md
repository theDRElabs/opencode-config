---
name: sequential-afk-runner
description: Run one dependency-ready AFK issue at a time through fresh implementation, deterministic checks, and fresh independent review with bounded retries and resumable evidence.
---

# Sequential AFK Runner

Use this skill only with a human-accepted backlog whose issues follow the
`prd-to-issues` schema and whose project feedback commands are known.

## Ownership Boundary

- Humans retain ownership of requirements, architecture and public contracts,
  security-sensitive or irreversible decisions, product judgment, merge, deploy,
  and final acceptance.
- Never select `TYPE: hitl`, resolve an unknown, weaken a check, approve a review
  finding, merge, push, deploy, or start Phase 11 isolation work.
- A runner `done` status means only that implementation, declared deterministic
  checks, and fresh independent review passed. It is not human acceptance.

## Selection

Read every `ISSUE-*.md` in the backlog. A candidate is ready only when it has
`STATUS: ready`, `TYPE: afk`, known `COMMANDS`, no unresolved human decision, and
every issue in `BLOCKERS` is `done`. Select the lowest issue ID. Process exactly
one issue at a time and stop when the iteration limit is reached.

## Stage Contract

1. Create a new attempt directory containing a copied issue and an input manifest.
2. Start the configured implementer adapter as a separate process in that attempt
   directory. The adapter must create a fresh implementation context and return a
   complete implementation-result artifact.
3. Run the configured deterministic-check adapter sequentially. A nonzero exit or
   any non-passing check blocks completion.
4. Start the configured reviewer adapter as a separate process with only the issue,
   implementation result, complete diff/source evidence, standards, and complete
   check evidence. The reviewer must use a fresh read-only context.
5. Mark the issue `done` only when implementation exits zero, all checks pass, and
   the independent review artifact says `VERDICT: PASS` with no blocking findings.

The runner orchestrates adapters; it does not impersonate implementation or review.

## Retries and Stops

- `--max-retries` must be between zero and two. Retries are per issue, so an issue
  receives at most three total attempts.
- Check failures and review findings are supplied to the next fresh implementation
  attempt. Each blocking review creates a durable follow-up issue before retrying.
- Exit `75` from an adapter means interruption. Preserve state and stop immediately;
  `--resume` continues the exact unfinished stage without consuming another attempt.
- Stop explicitly for dry run, iteration limit, no ready AFK issue, only blocked or
  HITL work, malformed input, exhausted retries, interruption, or failed persistence.
- Never skip a failed gate to make progress. Visible event logs and stage artifacts
  are mandatory for every decision.

## State and Evidence

Use an exclusive run lock. Persist state atomically after every transition. Keep
`events.jsonl`, one directory per issue attempt, adapter logs, results, review
artifacts, and generated follow-up issues. `--dry-run` may inspect and log selection
but must not alter backlog status, run state, or invoke adapters.

## Issue Sandbox Isolation

When adapter commands are sandboxable, wrap every implement, check, and review
invocation in the Phase 11 issue sandbox. Two sandbox backends are available:

- **Process-level** (`fixtures/issue-sandbox/sandbox.mjs`): one git worktree
  and `sandbox/<issue-id>` branch per issue, a constructed whitelist environment
  (host secrets are never present), allowlist shell and git subcommand policy,
  protected refs (`main`, `production`) that cannot be mutated, denied network
  access, denied host and unrelated paths, and captured logs, diffs, commits,
  artifacts, and failure records per attempt. Isolation is process-level and
  policy-enforced inside the adapter via the guard preload (kernel namespaces
  are not used by design).

- **Docker** (`fixtures/issue-sandbox/sandbox-docker.mjs`): same interface as
  process-level, but executes the adapter inside a Docker container
  (`node:24-slim`) with kernel-level isolation: read-only root filesystem,
  resource limits (512MB RAM, 1 CPU, 256 PIDs), non-root user, network
  disabled by default. The guard preload runs inside the container as
  defense-in-depth. Use `--network` flag to enable network for `npm install`.

The sandbox has no merge, push, or deploy code path:
those remain human-owned approval gates.

To use Docker sandbox, invoke `sandbox-docker.mjs` instead of `sandbox.mjs`:
```bash
node fixtures/issue-sandbox/sandbox-docker.mjs \
  --repo /path/to/repo --run-dir /path/to/run \
  --issue ISSUE-001 --attempt 1 -- node adapter.mjs
```
