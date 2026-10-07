---
name: graph-memory
description: >
  Maintain and query the persistent knowledge graph at /workspaces/graph-memory/
  (Extract -> Resolve -> Assemble -> Query, with provenance, temporal
  validity, confidence, and contradiction detection). Use when a durable fact
  emerges (constraint, lesson, decision, relationship between tools/repos/orgs),
  when recording session learnings for future sessions, or when answering
  questions that need multi-hop connections across projects ("what does X
  depend on", "what did we decide about Y"). Also use before starting work
  related to previously recorded topics.
---

# Graph Memory

Store: `/workspaces/graph-memory/` — JSONL triple store with provenance and
temporal validity. Schema/contracts: `README.md` there. MCP tools:
`graph_query`, `graph_search`, `graph_add_episode`, `graph_invalidate`,
`graph_stats` (wired via `~/.config/opencode/opencode.jsonc`).

## Operating loop

### 1. Capture (LLM stage — you)
When a durable fact emerges, either:
- call `graph_add_episode` with a well-formed episode (preferred), or
- draft it via `node scripts/capture.mjs <file>` and ask the user to approve
  the candidate (moves from `episodes/candidates/` into `episodes/`).

Episode rules:
- Entities central to the content only; one-line grounded description each.
- Relations connect two declared entities; predicates are short verb phrases.
- `source` + `date` mandatory — no receipt, no entry. `schema_version: "1"`.
- Unverified/hearsay stays out until verified.

### 2. Resolve (LLM stage — you)
Before assembling, reconcile names against `resolve.json` clusters:
- Same real-world thing, different surface form -> add alias to the existing
  cluster. Use stored descriptions for disambiguation context.
- Genuinely distinct -> do nothing.
- Watch `errors.log` after assemble for DANGLING-REF and OVER-MERGE-RISK.

### 3. Assemble (deterministic)
```bash
node /workspaces/graph-memory/scripts/graph-assemble.mjs
```
Rebuilds nodes/edges from scratch every run (no stale merges). Read the
summary line — it reports episodes, nodes, edges, self-loops dropped, dangling
refs, invalidations, contradictions, superseded-by issues. A nonzero exit or
new entries in `errors.log` means fix before trusting output.

Safety rails in place: malformed episodes are rejected (never crash), output
writes are atomic, a lockfile prevents concurrent assembles, errors.log is
rewritten per run, and contradictions between currently-active facts are
flagged. Every node/edge gets a `confidence` score (0.5 base, +0.2 for 2+
supporting episodes, +0.2 for explicit valid_at).

### 4. Invalidate contradicted facts (manual overlay)
Contradiction -> `graph_invalidate` tool, or append to
`invalidations.json` keyed `"subject|predicate|object"` with `invalid_at`
and optional `superseded_by`, then rerun assemble. Never delete edges.
`SUPERSEDED-BY-MISSING` and `SUPERSEDED-BY-CYCLE` are validated.

### 5. Query / search
```bash
node /workspaces/graph-memory/scripts/graph-query.mjs "<seed or alias>" --hops=2 [--all] [--as-of=YYYY-MM-DD]
node /workspaces/graph-memory/scripts/graph-search.mjs "<text>" --top=10
```
Or via MCP: `graph_query` / `graph_search`. `--as-of` filters to facts true
on that date; `--all` includes invalidated/future facts (marked `[inactive]`).

### 6. Health checks
- `graph_stats` for counts + errors.log status
- `errors.log` for anything logged this run
- Approval digest: pending candidates in `episodes/candidates/` are printed
  after every assemble and emailed when `GRAPH_RESEND_API_KEY` +
  `GRAPH_EMAIL_TO` are set.

## Quality habits (the compounding part)
- Log every resolution mistake/false merge you catch to `errors.log` with
  what fixed it — this log outvalues any single project.
- Occasionally red-team the store: plant a bad triple, confirm a guard
  catches it, log the result.
- Candidates awaiting approval are drafts — nothing in `episodes/candidates/`
  is live until the user approves it.

## When NOT to use
- Ephemeral session details (scratch values, file paths being refactored
  right now). If it won't matter next week, it doesn't belong in episodes.
- Anything already captured verbatim by a repo's own docs — link it via an
  episode instead of duplicating content.
