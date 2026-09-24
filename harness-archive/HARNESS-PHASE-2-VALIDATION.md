# Phase 2 Alignment Workflow Validation

Date: 2026-08-24

This is a fixture rubric for independently checking the `grill-me` skill and
`grill-me` command. A verifier should run each fixture in a fresh session and
inspect behavior, not infer success from the prompt text. The command uses the
dedicated `alignment` agent, whose config denies project read, edit, search,
shell, task, and external-directory tools.

## Fixtures

### Small feature

Prompt: "Add a bookmark button to articles."

Expected behavior: ask who can bookmark, what the primary success state is, and
whether bookmarks persist before producing any plan or edit. Cover empty,
duplicate, unauthenticated, and failure behavior as applicable.

### Ambiguous data change

Prompt: "Rename customers to accounts in the database."

Expected behavior: stop on source of truth, migration/backfill, compatibility,
rollback, ownership, and retention decisions. Mark public-contract or destructive
choices `HITL`; do not propose a migration implementation.

### API integration

Prompt: "Connect the app to a shipping-rate API."

Expected behavior: ask for provider, data boundary, credentials, timeout/retry,
idempotency, rate limits, failure ownership, and test environment. Offer a bounded
research branch when provider behavior is unknown.

### Prototype branch

Prompt: "I want to prototype two interaction patterns for a bulk editor, but I
do not know which one should ship."

Expected behavior: define a bounded prototype hypothesis, allowed scope, budget,
success signal, cleanup/disposition, and decision it unblocks. Keep the result
`RESEARCH` or `UNKNOWN` until the user accepts it; do not implement production
behavior.

### Frontend workflow

Prompt: "Build an admin approval queue."

Expected behavior: ask about roles, primary review flow, loading/empty/error and
concurrency behavior, destructive actions, audit needs, responsive requirements,
and acceptance checks. Preserve visual and permission decisions as human-owned.

## Common Failure Conditions

The fixture fails if the workflow:

- asks multiple decision questions in one turn;
- silently invents requirements or proceeds to a plan;
- edits or inspects project code during alignment;
- omits material security, data, failure, testing, or out-of-scope decisions;
- treats unresolved irreversible or preference-sensitive choices as settled; or
- produces a PRD, issue list, or implementation without confirmed alignment.
- claims the command is read-only without matching agent permission evidence.

## Completion Evidence

Record the session transcript or concise observed results, the verifier identity,
date, and any follow-up issue. Four original fixtures plus the prototype fixture
must have observed results before the Phase 2 gate can pass. This artifact is a
rubric, not proof that fixtures have passed.

## 2026-08-24 Validation Attempt

- Config evidence: `opencode debug config` resolved `grill-me` to the dedicated
  `alignment` agent with `read`, `edit`, `glob`, `grep`, `bash`, `task`, and
  `external_directory` denied.
- Behavioral evidence: five noninteractive `opencode run --command grill-me`
  attempts reached the `alignment` agent but exceeded the 120-second command
  timeout while waiting for the interactive next-turn exchange. No transcript
  proving the one-question behavior was captured.
- Status: `BLOCKED`; do not mark the Phase 2 completion gate passed until fresh
  interactive fixture transcripts or an equivalent deterministic harness test
  are recorded.

## 2026-08-24 Fresh Interactive Validation

Verifier/operator: OpenCode session owner, using fresh `opencode run --command
grill-me` sessions with the restricted `alignment` agent. The sessions were run
sequentially on Android/Termux after a four-process concurrent attempt caused
Termux to force-close. The concurrent attempt is not evidence. Session IDs below
are retained so the raw event records can be independently inspected with the
OpenCode session tools.

### Small Feature: Bookmark Button

- Session: `ses_fceb54c81ffedNP5XBu33k8mJD`
- Observed first turn: recommendation for authenticated personal bookmarks,
  followed by exactly one question: signed-in users only or anonymous users.
- Observed continuation: one question per turn covered primary toggle/list
  workflow, persistence, optimistic rollback and retry, pending/concurrent
  clicks, unavailable articles, duplicate/idempotent writes, ownership,
  account-deletion cleanup, empty state, pagination, signed-out behavior,
  non-goals, automated tests, and desktop/mobile QA.
- Stop result: alignment record only, with `HITL`/`UNKNOWN` items and a request
  for confirmation. No PRD, issue list, plan, or implementation was produced.
- Tool evidence: the alignment agent loaded only the `grill-me` skill and did
  not invoke project read, search, shell, edit, or task tools.
- Result: `PASS` for the fixture rubric.

### Ambiguous Data Change

- Clean session: `ses_fce65b9caffeIxwBBgxQCKLU1q`, run with `--pure`.
- Observed first turn: recommendation for a terminology-only rename and one
  question about whether account has different meaning or behavior.
- Observed continuation: one question per turn surfaced database identifier
  scope, public-API compatibility, retirement ownership, maintenance window,
  rollback/backup, conflict handling, authorization/audit, and disposable,
  staging, production-like rehearsal, and production smoke checks.
- Stop result: migration-specific alignment record only, with public API
  retirement marked `HITL`; explicitly no migration plan or implementation.
- Tool evidence: only the skill tool appeared in the JSON event output; no
  project inspection or editing tools were invoked.
- Result: `PASS` for the fixture rubric.
- Note: an earlier non-pure session produced a contaminated sentence from a
  prior fixture and was discarded. It is not validation evidence.

### API Integration

- Session: `ses_fce92efa7ffeNPtznrkNtLYcPg`
- Observed first turn: recommendation defining checkout customer and accurate
  pre-order rates, followed by exactly one user/outcome question.
- Observed continuation: one question per turn covered provider selection,
  domestic-US boundary, cart/package prerequisites, timeout/retry, rate
  invalidation and revalidation, persistence/source of truth, credentials and
  ownership, idempotency, authorization, rate limits, audit, failure behavior,
  tests, sandbox testing, and non-goals.
- Stop result: alignment record only with a bounded `RESEARCH` provider branch,
  explicit `HITL` provider-dependent decisions, and no PRD, issue list, plan, or
  implementation.
- Tool evidence: the session output shows the skill load and no project
  inspection/editing/search/shell/task tool use.
- Result: `PASS` for the fixture rubric.

### Prototype Branch

- Session: `ses_fce829e4fffeVCMn0jfT5bi56J`
- Observed first turn: recommendation to optimize for low-error bulk editing,
  followed by exactly one user/outcome question.
- Observed continuation: one question per turn defined the 100-record,
  one-field workflow, no-partial-update boundary, concurrent invalidation,
  disposable data, two patterns, zero-error success signal, participant
  controls, counterbalancing, and explicit production non-goals.
- Stop result: bounded alignment record with a `RESEARCH` prototype branch,
  evidence/disposition, and human acceptance still required. No production
  implementation, PRD, issue list, or plan was produced.
- Tool evidence: only the skill tool appeared before the interview output; no
  project inspection or editing tools were invoked.
- Result: `PASS` for the fixture rubric.

### Frontend Workflow

- Session: `ses_fce770122ffeFywkxyDXXRaWvw`
- Observed first turn: recommendation for operations-admin review and one
  user/success question.
- Observed continuation: one question per turn covered assignment workflow,
  vendor-onboarding boundary, approval authority, roles, evidence checklist,
  exclusive 30-minute claim and renewal, versioned snapshots, retention,
  security and audit, durable async integration, escalation ownership,
  duplicates, interruption/draft recovery, and explicit non-goals.
- Stop result: alignment record only; unresolved testing and manual-QA details
  remained `UNKNOWN`, and security/retention/override choices remained `HITL`.
  No PRD, issue list, plan, or implementation was produced.
- Tool evidence: the session loaded the skill and invoked no project
  inspection/editing/search/shell/task tools.
- Result: `PASS` for the fixture rubric.

### Gate Result

- Five fresh interactive fixture sessions have observed behavioral results.
- All five demonstrate one decision question per turn and a recommendation before
  the question.
- All five preserve unresolved `HITL`, `UNKNOWN`, or `RESEARCH` branches where
  appropriate and stop at alignment rather than producing downstream artifacts.
- No session performed project inspection or editing; the restricted agent
  configuration remains the permission boundary.
- Phase 2 gate status: `PASSED` after fresh-context independent verification.

## 2026-08-24 Independent Verification

- Verifier: fresh-context `general` verifier; no file modifications.
- Result: `PASS`; no rubric findings and no required changes.
- Evidence checked: all five fixture records, one-question/recommendation
  observations, restricted-tool evidence, decision-area coverage, preserved
  `HITL`/`UNKNOWN`/`RESEARCH` branches, downstream-artifact stop conditions, and
  honest handling of the Android/Termux interruption and discarded contaminated
  attempt.
- Residual risk: this artifact contains concise operator-recorded observations
  rather than full transcripts. Raw session event records remain separately
  inspectable by their recorded session IDs.
