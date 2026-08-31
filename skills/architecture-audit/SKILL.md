---
name: architecture-audit
description: Audit one bounded project area for evidence-backed module-boundary and testability gaps, then propose safe incremental migration slices. Use only when architecture analysis is explicitly requested.
---

# Architecture Audit

Use this pull-based skill only for an explicit architecture audit. The audit is a
read-only recommendation, not architecture approval or refactoring authority.

## Ownership Boundary

Humans own architecture, public contracts, invariants, priorities, compatibility,
tradeoffs, and acceptance of every migration. Never edit the audited project,
perform a broad automatic refactor, invent requirements, or present a recommendation
as an accepted decision.

## Entry Gate and Bounds

Require a project root, audit goal, applicable architecture or project standards,
source and test scope, and available verification commands. Return `BLOCKED` when
these are missing. Before reading, state limits of at most 25 source/test files, 15
tool calls, and 8 findings. Exclude generated files, dependencies, build output,
secrets, and unrelated projects. Expand scope only with human approval.

## Evidence Method

Build a small evidence map before recommending changes:

1. Identify behavior-owning modules, callers, imports, public exports, external
   dependencies, tests, and available checks.
2. Trace concrete behavior and dependency direction across exact `path:line` sites.
3. Classify only demonstrated gaps. Absence of a category is a valid result.
4. Distinguish direct evidence from an inference and state confidence.

Inspect these signals without treating line count or import count alone as proof:

- `high coupling`: one change reason spans unrelated policy, orchestration, I/O, or
  presentation, or many callers depend on unstable internals;
- `shallow-module cluster`: several pass-through modules expose more coordination
  surface than coherent behavior; do not penalize thin framework adapters;
- `excessive public surface`: exports expose internals not needed by consumers or
  tests bypass the intended boundary;
- `repeated orchestration`: materially equivalent sequencing, validation, mapping,
  retries, or error translation appears in multiple callers;
- `heavy mocking`: tests replace many collaborators or internal details and still do
  not exercise observable behavior;
- `missing integration seam`: business or adapter behavior cannot be exercised with
  a controlled dependency except through a global, network, filesystem, database,
  clock, or full application;
- `untested logic`: important branches or behavior have no direct or integration
  evidence; never equate coverage percentage alone with test quality;
- `dependency-direction problem`: domain policy or contracts depend on framework,
  storage, UI, or vendor details, or the same contract is duplicated to avoid that
  dependency.

Every finding requires an ID, category, severity, exact evidence locations,
observable maintenance or testability impact, confidence, and a falsifier: what
evidence would disprove or materially weaken it. Do not report speculative smells.

## Deep-Module Recommendation

Recommend a deep module only when it groups coherent behavior behind a smaller,
stable interface. Define responsibility, proposed interface, hidden decisions,
dependency direction, callers, tests at the seam, benefits, costs, alternatives,
and human decisions required. Do not create wrappers that merely rename calls,
centralize unrelated behavior, or add an interface with only one speculative use.

## Incremental Migration Slices

Propose at most three ordered slices. Each slice must be independently reviewable
and reversible, preserve current observable behavior and public contracts unless a
human explicitly approves a change, name its bounded files, tests, exact available
checks, stop conditions, rollback, and the human decision gate. Prefer first slices
such as moving a dependency-neutral contract, adding a characterization test, or
introducing one integration seam. Never combine a repository-wide rename, broad
module split, framework replacement, schema migration, and behavior change.

## Result Contract

Return exactly these sections:

1. `Verdict`: `ACTIONABLE`, `NO MATERIAL GAP`, or `BLOCKED`, with one reason.
2. `Scope and Evidence Map`: root, standards, bounded files read, checks available,
   behavior owners, callers, dependencies, and tests.
3. `Findings`: severity ordered; each includes ID, category, `path:line` evidence,
   impact, confidence, and falsifier. State `None` when justified.
4. `Signal Coverage`: all eight required signal categories marked `found`, `not
   found`, or `insufficient evidence`, with evidence.
5. `Deep-Module Recommendation`: the complete recommendation shape above, or `None`.
6. `Incremental Migration Slices`: at most three bounded slices with acceptance,
   files, tests, checks, stop/rollback conditions, and human gates.
7. `Human Decisions and Tradeoffs`: unresolved architecture, contract, priority,
   compatibility, and cost decisions; never decide these for the human.
8. `Residual Risks`: unavailable checks, unread scope, inference limits, and why the
   audit is not implementation, verification of a migration, or human acceptance.

The audit may recommend a bounded issue for later alignment and implementation. It
must not implement that issue or claim that proposed architecture is correct.
