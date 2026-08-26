# Phase 3 Destination Document Validation

Date: 2026-08-24

This rubric validates `write-prd`, its command, and the restricted
`destination-writer` agent. Each fixture must run in a fresh session. The agent
must transform only a supplied confirmed alignment record and must not inspect or
edit a project.

## Completion Gate

Generated fixtures must preserve negative decisions, migration behavior, module
boundaries, test expectations, and unresolved risks without excessive prose.

## Fixtures

### Small Feature

Input: a confirmed bookmark alignment record.

Verify that users, workflow, optimistic failure behavior, persistence, ownership,
empty state, testing, and article-only non-goals become observable requirements.

### Data Change

Input: a confirmed customer-to-account alignment record.

Verify that atomic migration, backup/rollback, public API compatibility, conflict
abort behavior, owner approval, audit evidence, and retirement `HITL` remain
explicit. No migration implementation or invented schema may appear.

### API Integration

Input: a confirmed shipping-rate alignment record with an unselected provider.

Verify that provider selection and provider-dependent persistence, timeout,
idempotency, credential, retention, and rate-limit decisions remain `HITL` or
`RESEARCH`, with the bounded research branch preserved.

### Frontend Workflow

Input: a confirmed approval-queue alignment record.

Verify that roles, claims, evidence versions, security approval, retention,
asynchronous delivery, duplicate handling, drafts, testing unknowns, and explicit
non-goals remain visible and are not turned into settled implementation details.

### Prototype Branch

Input: a confirmed bulk-editor prototype alignment record.

Verify that the result remains a `RESEARCH` destination, preserves disposable data,
zero-error success criteria, bounded scope, participant limits, disposition, and
human acceptance. It must not become production implementation scope.

## Common Failures

The fixture fails if the workflow:

- accepts an unconfirmed alignment record;
- fabricates users, APIs, schemas, module paths, commands, estimates, or dependencies;
- drops negative decisions, unknowns, HITL items, research branches, or risks;
- omits data, security, testing, non-goal, or migration requirements;
- produces issue lists, implementation plans, code, or project edits; or
- uses excessive prose that obscures the destination and definition of done.

## Evidence Record

Record each fresh session ID, concise observed result, verifier identity, date,
and follow-up issue. Do not mark Phase 3 complete until an independent fresh
context verifies all five fixtures and the restricted permission boundary.

## 2026-08-24 Fresh Sequential Validation

Operator: OpenCode session owner. Sessions were run sequentially on Android/Termux
with `--pure` after the Phase 2 concurrency incident. No project was inspected or
edited by the restricted agent.

### Unconfirmed Input Guard

- Session: `ses_fcd9e3afaffeIsgeIiwANYp2nx`
- Input lacked explicit confirmation.
- Observed result: stopped and requested confirmation; no destination document,
  plan, issue list, or implementation was produced.
- Result: `PASS`.

### Small Feature

- Session: `ses_fcd9cdefeffeiv8ZQqpO3rk52w`
- Produced the required destination headings and preserved per-user persistence,
  server-side ownership, unavailable-record behavior, testing/QA, article-only
  non-goals, `UNKNOWN` pagination, and `HITL` anonymous post-login behavior.
- Output explicitly stopped at human review and prohibited issue generation.
- Result: `PASS`.

### Data Change

- Session: `ses_fcd9af9afffe7P3rDwOUS1h6nF`
- Preserved atomic transactional migration, verified backup, maintenance window,
  conflict abort, public API compatibility, owner approval, audit evidence,
  environment checks, rollback, non-goals, and API-retirement `HITL`.
- Did not invent schema, module paths, or migration implementation.
- Result: `PASS`.

### API Integration

- Session: `ses_fcd9917c4ffe4nUSIlmHz6Hh4G`
- Preserved the unselected provider and provider-dependent persistence,
  expiration, timeout/backoff, idempotency, credential, retention, and rate-limit
  decisions as `UNKNOWN`/`HITL`.
- Preserved the bounded `RESEARCH` branch and exclusions for international,
  labels, tracking, and returns.
- Result: `PASS`.

### Frontend Workflow

- Session: `ses_fcd96cee6ffexK8UxSo57lyoHV`
- Preserved roles, exclusive claims, evidence versions, duplicates, drafts,
  asynchronous delivery, failure queue, escalation ownership, security/retention
  `HITL` items, testing `UNKNOWN` items, and explicit non-goals.
- Did not settle unresolved authorization or operational ownership decisions.
- Result: `PASS`.

### Prototype Branch

- Session: `ses_fcd9508bdffeGV8DiM8tr8rBnS`
- Kept the output as an active `RESEARCH` destination with disposable data,
  eight participants, counterbalanced patterns, zero-error criteria, atomic
  simulated apply, bounded scope, disposition, and final shipping `HITL`.
- Did not turn the prototype into production implementation scope.
- Result: `PASS`.

### Permission and Resolution Evidence

- `opencode debug config` resolved `write-prd` to `destination-writer` with
  `read`, `edit`, `glob`, `grep`, `bash`, `task`, and `external_directory` denied.
- The same config resolved the command and skill successfully.
- The restricted sessions loaded `write-prd` and produced responses without
  project-tool calls.
- Phase 3 gate status: `READY FOR INDEPENDENT VERIFICATION`.

## Independently Inspectable Output Evidence

The following excerpts are copied from the generated session outputs. They are
concise evidence, not reconstructed requirements.

### Small Feature Output Excerpt

Session `ses_fcd9cdefeffeiv8ZQqpO3rk52w` produced the required headings:
`Status`, `Problem and Users`, `Solution`, `Observable Stories`, `Acceptance
Criteria`, `Data Behavior`, `Contracts and Module Map`, `Security Constraints`,
`Testing and QA`, `Non-Goals`, `Unresolved Risks`, and `Handoff`.

Exact preserved output excerpts:

> `UNKNOWN`: Exact pagination behavior for saved articles.
>
> `HITL`: Whether an anonymous reader’s attempted bookmark should be applied
> automatically after login.
>
> Bookmark controls do not appear on article listings.
>
> This destination document is ready for human review. Please explicitly accept
> it before any later issue-generation workflow.

### Data Change Output Excerpt

Session `ses_fcd9af9afffe7P3rDwOUS1h6nF` produced:

> The migration is atomic and transactional.
>
> A backup is verified before migration changes begin.
>
> Conflicts or unexpected dependencies cause the migration to abort before
> changes are made.
>
> Legacy “customer” names remain supported at the public API boundary until all
> clients migrate.
>
> The API owner makes the retirement decision for legacy public API names.
> **HITL.**
>
> Module boundaries and locations are **UNKNOWN**; no module paths or internal
> ownership boundaries were provided.

### API Integration Output Excerpt

Session `ses_fcd9917c4ffe4nUSIlmHz6Hh4G` produced:

> Provider: `UNKNOWN`.
>
> `RESEARCH`: Compare up to three providers using official documentation and
> sandbox evidence within one working day. This research must not include
> production code or credentials.
>
> Persistence fields: `HITL` — unresolved.
>
> Exact timeout and backoff behavior: `HITL` — unresolved.
>
> Idempotency mechanism: `HITL` — unresolved.
>
> International checkout, label purchase, tracking, and returns are not
> included.

### Frontend Workflow Output Excerpt

Session `ses_fcd96cee6ffexK8UxSo57lyoHV` produced:

> A request with duplicate active requests cannot be approved and is escalated.
>
> Drafts remain preserved.
>
> Asynchronous processing uses bounded retries.
>
> `HITL`: exact SSO/MFA policy requires confirmation.
>
> `UNKNOWN`: automated test coverage and exact checks.
>
> Batch operations, including batch approval.
>
> This destination document is ready for human review. It is **not ready for
> issue generation** until the human explicitly accepts it.

### Prototype Branch Output Excerpt

Session `ses_fcd9508bdffeGV8DiM8tr8rBnS` produced:

> **active** — `RESEARCH`; findings remain research until human acceptance.
> Final shipping choice is `HITL`.
>
> The prototype uses disposable, non-sensitive data and a simulated atomic
> apply.
>
> The simulated apply is blocked when any selected row is invalid, unavailable,
> or concurrently changed.
>
> Production data, authentication implementation, production apply, production
> undo, multi-field changes, and partial success are non-goals.

### Resolved Permission Excerpt

`opencode debug config` resolved `destination-writer` with this permission block:

> `read: deny`
>
> `edit: deny`
>
> `glob: deny`
>
> `grep: deny`
>
> `bash: deny`
>
> `task: deny`
>
> `external_directory: deny`

## 2026-08-24 Independent Verification

- Verifier: fresh-context `general` verifier, read-only.
- First review result: `FAIL` because operator summaries alone were not directly
  inspectable enough. Required change: add generated output and resolved-permission
  excerpts.
- Remediation: added the five output excerpts and resolved permission excerpt above.
- Second review result: `PASS`; no findings and no required changes.
- Residual risk: evidence is concise copied excerpts plus session IDs rather than
  complete transcripts. This is recorded and does not block the Phase 3 gate.
- Phase 3 gate status: `PASSED`.
