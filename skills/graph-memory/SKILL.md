---
name: graph-memory
description: >
  Maintain and query the persistent knowledge graph at ~/.config/opencode/graph/
  (Extract -> Resolve -> Assemble -> Query with provenance and temporal
  validity). Use when a durable fact emerges (constraint, lesson, decision,
  relationship between tools/repos/orgs), when recording session learnings for
  future sessions, or when answering questions that need multi-hop connections
  across projects ("which lesson blocks which deploy path", "what does X
  depend on"). Also use before starting work related to previously recorded
  topics.
---

# Graph Memory

Store: `~/.config/opencode/graph/` — private GitHub repo, zero-dependency
JSONL triple store. Schema/contracts/guards: read `README.md` there first if
unsure about file formats.

## Operating loop

### 1. Extract (LLM stage — you)
When a durable fact emerges from any source (session outcome, doc, article),
write an episode JSON to `episodes/<date>-<slug>.json`. Contract in README.
Rules:
- Entities central to the content only; one-line grounded description each.
- Relations connect two declared entities; predicates are short verb phrases.
- Include `source` + `date`; provenance is mandatory — no receipt, no entry.
- Unverified/hearsay facts stay out until verified.

### 2. Resolve (LLM stage — you)
Before assembling, reconcile new names against `resolve.json` clusters:
- Same real-world thing, different surface form -> add alias to the existing
  cluster. Require contextual evidence, not string similarity; use the stored
  descriptions as disambiguation context.
- Genuinely distinct -> do nothing (self-cluster is automatic).
- Watch errors.log after assemble for DANGLING-REF (silent-loss guard) and
  OVER-MERGE-RISK (>4 aliases).

### 3. Assemble (deterministic)
```bash
node ~/.config/opencode/graph/scripts/graph-assemble.mjs
```
Rebuilds nodes/edges projections idempotently. Read its summary line; fix any
new guards it reports.

### 4. Invalidate contradicted facts (manual overlay)
New information that contradicts an existing edge -> append to
`invalidations.json` keyed `"subject|predicate|object"` with `invalid_at`,
optionally `superseded_by`, then rerun assemble. Never delete edges.

### 5. Query (deterministic)
```bash
node ~/.config/opencode/graph/scripts/graph-query.mjs "<seed or alias>" --hops=2 [--all]
```
Paste the `(s) --[p]--> (t)` lines into context and answer citing specific
edges. Use `--all` for historical "what did we believe then" questions.

## Quality habits (the compounding part)
- Log every resolution mistake/false merge you catch to `errors.log` with what
  fixed it — this log outvalues any single project.
- Revisit week-old resolution errors once more of the system exists around
  them; patterns surface late.
- Occasionally red-team your own store: plant a bad triple, confirm a guard
  catches it, log the result.

## When NOT to use
- Ephemeral session details (file paths being refactored right now, scratch
  values). If it won't matter next week, it doesn't belong in episodes.
- Anything already captured verbatim by a repo's own docs — link it via an
  episode instead of duplicating content.
