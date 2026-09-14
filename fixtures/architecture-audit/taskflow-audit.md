# Taskflow Architecture Audit

## Verdict
ACTIONABLE: Taskflow has evidence-backed dependency-direction and testability gaps
that can be improved without changing current behavior or public HTTP contracts.

## Scope and Evidence Map

- Root: `/home/DRE/projects/taskflow`.
- Goal: identify module-boundary and testability gaps for Phase 9.
- Standards: current source/tests and Phase 9 human-ownership and incremental-change rules.
- Bounded files read: `package.json`, `vitest.config.ts`, `src/lib/db.ts`,
  `src/lib/db.test.ts`, `src/lib/schemas.ts`, three API routes, `src/app/page.tsx`,
  and `e2e/smoke.spec.ts`.
- Available checks: `npm run lint`, `npm run typecheck`, `npm test`,
  `npm run build`, and `npm run e2e` (the audit does not execute them).
- Behavior owners: SQLite persistence in `src/lib/db.ts`; HTTP translation in API
  routes; client orchestration and rendering in `src/app/page.tsx`.

## Findings

- `T1` high, high coupling: `src/lib/db.ts:3`, `src/lib/db.ts:13`, and
  `src/lib/db.ts:53` put domain shape, deployment policy, global connection lifecycle,
  schema initialization, mapping, and CRUD in one public infrastructure module.
  Impact: contract, deployment, and test-isolation changes converge on one module.
  Confidence: high. Falsifier: maintained boundaries showing these policies must
  change together as one invariant would weaken the finding.
- `T2` high, missing integration seam: `src/app/api/tasks/route.ts:2` directly binds
  route behavior to concrete global SQLite functions, while `src/lib/db.test.ts:13`
  resets state through the raw connection. Impact: route error/validation behavior
  cannot be integration-tested with a controlled task store. Confidence: high.
  Falsifier: a supported injection or isolated route harness elsewhere would disprove it.
- `T3` medium, dependency-direction problem: the canonical task type lives in
  persistence at `src/lib/db.ts:3`, while the client duplicates it at
  `src/app/page.tsx:5`. Impact: consumers either depend on SQLite infrastructure or
  drift. Confidence: high. Falsifier: generated contract equivalence checks would
  reduce drift risk but not reverse ownership.
- `T4` medium, excessive public surface: `src/lib/db.ts:13` exports deployment policy
  and `src/lib/db.ts:53` exports the raw database primarily consumed by test cleanup
  at `src/lib/db.test.ts:13`. Impact: consumers can bypass the behavior boundary and
  couple to storage details. Confidence: high. Falsifier: documented external
  consumers requiring these as stable contracts would require preserving them.
- `T5` medium, repeated orchestration: ID parsing repeats at
  `src/app/api/tasks/[id]/route.ts:13`, `src/app/api/tasks/[id]/route.ts:26`, and
  `src/app/api/tasks/[id]/route.ts:52`; its error response mapping repeats at
  `src/app/api/tasks/[id]/route.ts:15`, `src/app/api/tasks/[id]/route.ts:28`, and
  `src/app/api/tasks/[id]/route.ts:54`; task loading also appears at
  `src/app/page.tsx:39` and `src/app/page.tsx:52`. Impact: error semantics and loading
  behavior can diverge. Confidence: high. Falsifier: materially different required
  semantics at each location would justify separate orchestration.
- `T6` medium, untested logic: `vitest.config.ts:7` discovers source unit tests, but
  there are no route or component tests for the branches cited in T2/T5. Impact:
  malformed JSON, invalid IDs, status cycling, and fetch failures rely on full-app or
  unrecorded manual behavior. Confidence: medium. Falsifier: external integration
  suites covering those exact branches would weaken this finding.

## Signal Coverage

- high coupling: found, T1.
- shallow-module cluster: not found; the schema and framework route adapters have
  coherent roles, and thin framework adapters are not automatically shallow modules.
- excessive public surface: found, T4.
- repeated orchestration: found, T5.
- heavy mocking: not found; `src/lib/db.test.ts:20` uses real SQLite behavior.
- missing integration seam: found, T2.
- untested logic: found, T6.
- dependency-direction problem: found, T3.

## Deep-Module Recommendation

Create a dependency-neutral task contract and, in a later independently approved
slice, a task-store behavior boundary. The small contract surface is `Task`,
`TaskStatus`, `TaskPriority`, `CreateTaskInput`, and `UpdateTaskInput`. Persistence
hides connection selection, DDL, row mapping, and SQL behind task behavior; routes
retain HTTP parsing and response mapping. Contract tests cover values and store
integration tests cover CRUD. Benefits are one contract owner and controlled tests;
costs are an additional boundary and migration work. An alternative is retaining the
concrete module while adding a test-only database factory. The human decides whether
the store interface earns its cost and whether current exports are public contracts.

## Incremental Migration Slices

### Slice 1: Dependency-Neutral Contract

- Acceptance: move task/status/priority/input types to one dependency-neutral module;
  imports compile; SQL, HTTP response shapes, and UI behavior remain unchanged.
- Bounded files: one new contract module plus `src/lib/db.ts`, `src/lib/schemas.ts`,
  and `src/app/page.tsx` imports/types.
- Tests/checks: existing schema/database tests, `npm run typecheck`, `npm test`,
  `npm run lint`, then `npm run build`.
- Stop/rollback: stop on any runtime contract or generated-client requirement; revert
  imports and the new module if checks fail.
- Human gate: approve the contract's owner, names, and whether it is public.

### Slice 2: Characterize Route Failures

- Acceptance: tests demonstrate invalid JSON, invalid ID, missing task, and validation
  responses without changing handlers.
- Bounded files: route tests and only the smallest test fixture/reset seam required.
- Tests/checks: targeted Vitest, then typecheck, lint, test, and build.
- Stop/rollback: do not introduce a general repository abstraction solely to make one
  assertion pass; remove the fixture seam if it exposes production internals.
- Human gate: approve intended HTTP error contracts before freezing them in tests.

### Slice 3: Controlled Task Store Seam

- Acceptance: route behavior can use an injected store in tests while production uses
  SQLite; existing responses and CRUD behavior remain unchanged; raw DB exports are
  removed only if no accepted consumer needs them.
- Bounded files: task store boundary, SQLite implementation, task routes, and tests.
- Tests/checks: targeted route/store tests and all declared checks including E2E with
  its required server.
- Stop/rollback: stop if the seam becomes pass-through boilerplate or changes public
  behavior; retain direct concrete calls as rollback.
- Human gate: approve interface shape, compatibility, and export removal.

## Human Decisions and Tradeoffs

The human owns contract/module names, whether `getDb` or `isVercel` are supported
public APIs, desired HTTP error contracts, whether an interface is worth its cost,
slice priority, and acceptance of all tradeoffs. This audit never modifies Taskflow.

## Residual Risks

Checks were identified but not run because this is a read-only audit. The bounded
scope did not inspect generated output, dependency code, deployment configuration,
or every E2E artifact. Exact-line evidence can become stale after edits. The proposal
is not an implementation, migration verification, broad refactor authorization, or
human architecture acceptance.
