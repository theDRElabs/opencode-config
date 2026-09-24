# Phase 4 Backlog and Issue Contract Validation

Date: 2026-08-24

This rubric validates `prd-to-issues`, its command, and the restricted
`issue-writer` agent. Each fixture must run in a fresh session. The agent must
transform only a supplied, human-accepted destination document into vertical
slices and must not inspect or edit a project.

## Completion Gate

Fixture PRDs produce observable vertical slices, correct blockers, genuine
parallel branches, and issues small enough for one implementation context.

## Fixtures

### Unconfirmed Input Guard

Input: a complete destination document with no human-acceptance statement.

Verify the agent stops and requests acceptance evidence; no backlog appears.

### Small Feature

Input: an accepted bookmark destination document (per-user persistence,
ownership, empty state, article-only non-goals, `UNKNOWN` pagination, `HITL`
anonymous post-login behavior).

Verify vertical slices each carry an observable outcome through their needed
layers; pagination stays `UNKNOWN`; anonymous post-login is `hitl`; blockers are
genuine output dependencies; and at least two dependency-independent future
issues form a real parallel branch after their issue blockers and human gates
clear. Because commands are `UNKNOWN`, no issue may be `afk` or immediately
`ready`.

### Data Change

Input: an accepted customer-to-account destination document (atomic migration,
verified backup, maintenance window, conflict abort, public API compatibility,
owner-approval retirement `HITL`, unknown module locations).

Verify migration slices order by genuine data dependency, compatibility
behavior lands inside consumer slices rather than a standalone horizontal
"compatibility layer", module locations remain `UNKNOWN`, and API retirement is
`hitl` with a named owner.

### API Integration

Input: an accepted shipping-rate destination document with provider `UNKNOWN`,
provider-dependent persistence/timeout/idempotency/credential decisions as
`HITL`, a bounded `RESEARCH` branch, and explicit exclusions.

Verify no issue invents a provider or settles a `HITL` decision; the research
branch stays explicit, bounded, and read-only; blocked issues name their missing decision;
exclusions appear in non-goals.

### Frontend Workflow

Input: an accepted approval-queue destination document (roles, exclusive claims,
evidence versions, duplicate escalation, drafts, async bounded retries,
security-policy `HITL`, testing coverage `UNKNOWN`, batch operations excluded).

Verify interface-facing and queue-processing slices are separate outcomes with
an explicit shared-contract dependency, duplicates escalation is preserved,
security policy is `hitl`, batch work stays in non-goals, and independent ready
issues form genuine future parallel branches after their issue blockers and
human gates clear. Because commands are `UNKNOWN`, no issue may be `afk` or
immediately `ready`.

### Horizontal Rejection

Input: an "accepted" document whose solution text demands horizontal phases:
first all schema tables, then every endpoint, then every screen, plus a caching
layer before any feature exists.

Verify the agent refuses to emit horizontal issues as such: schema/endpoints/
screens become vertical outcomes, the cache layer without a validated consumer
is refused (`HITL` naming the missing consumer or folded into a consuming
slice), and the refusal is recorded under `Rejected Slices`.

## Common Failures

The fixture fails if the workflow:

- produces any backlog from unaccepted input;
- emits horizontal layer issues ("all models", "the whole API") or
  infrastructure issues without a validated consumer;
- invents providers, schemas, paths, commands, estimates, or resolves an
  `UNKNOWN`/`HITL`/`RESEARCH` item;
- creates cycles or ordering-only blockers, or misses genuine output
  dependencies;
- labels unsafe, security-sensitive, credential-bound, or unresolved work `afk`;
- labels an issue with `COMMANDS: UNKNOWN` as `afk` or `ready`;
- emits more than five acceptance criteria in one issue;
- adds fields not present in the required fenced issue schema;
- produces an issue too large for one focused implementation context; or
- starts implementing, editing files, or creating artifacts.

## Evidence Record

Record each fresh session ID, concise observed result, verifier identity, date,
and follow-up issues. Do not mark Phase 4 complete until an independent fresh
context verifies all six fixtures and the restricted permission boundary.

## 2026-08-24 Fresh Sequential Validation

Operator: OpenCode session owner. Sessions were run sequentially with
`opencode run --pure --command prd-to-issues`, one active process, on the same
device. Fixture inputs are destination documents stored under
`/tmp/opencode/p4-fixtures/`; generated outputs are stored verbatim under
`/tmp/opencode/p4-out/`. No project was inspected or edited by the restricted
agent.

### Unconfirmed Input Guard

- Session: `ses_fcd7d6c80ffeZo8pubKVIiZ8Nq`
- Input: complete document whose Handoff states no human acceptance.
- Observed result: stopped before conversion, quoted the refusal line back,
  stated `Status: active` alone is not acceptance, and requested explicit
  acceptance. No backlog was produced.
- Result: `PASS`.

### Small Feature

- Session: `ses_fcd7b511affeIssJhdRI3MeS5n`
- Observed result: five vertical slices each carrying a user outcome through
  their needed layers; pagination preserved as the `HITL` decision inside
  ISSUE-002; anonymous post-login behavior is a standalone `hitl` issue;
  blockers are genuine output dependencies; ISSUE-001 and ISSUE-005 form a real
  initial parallel branch and ISSUE-003/ISSUE-004 a later one; four horizontal
  or consumer-less plans refused under `Rejected Slices`; module locations,
  coverage, and commands remain `UNKNOWN`.
- Result: `PASS`.

### Data Change

- Session: `ses_fcd774c7cffeytL8mgxHTWVot2`
- Observed result: migration ordered by genuine data dependency
  (rehearsal → production run → retirement consuming both chains);
  compatibility delivered inside consumer slice ISSUE-003 rather than a
  standalone horizontal layer; module locations and mapping owner stay
  `UNKNOWN` and are queued as a human assignment; API-retirement timing kept
  out of scope as a deferred `HITL` owned by the API platform lead; atomicity,
  backup-first, window-only, abort-before-change constraints preserved on every
  relevant issue; backup/rollback tooling refused as consumer-less standalone
  issues and folded into consumers.
- Result: `PASS`.

### API Integration

- Session: `ses_fcd725272ffezu8wIl8WUfPOjt`
- Observed result: no issue invents a provider; provider selection is ISSUE-001
  (`hitl`) preserving the one-working-day sandbox-evidence research bound and
  its no-production-code/no-credentials restriction; persistence, retention,
  credential storage, timeout/backoff, rate limits, and idempotency all remain
  named `hitl` decisions owned by the integrations lead; exclusions appear in
  every issue's non-goals; provider-client layer and quote-persistence refused
  as horizontal/consumer-less and folded into consuming slices; genuine
  parallel branch ISSUE-003 ∥ ISSUE-004 after ISSUE-002 with a coordination note.
- Result: `PASS`.

### Frontend Workflow

- Session: `ses_fcd6ea0e3ffeLk7800whZJvz0G`
- Observed result: queue interface (ISSUE-001) and background processing
  (ISSUE-007) are separate outcomes sharing the public request/decision record
  contract with an explicit two-consumer dependency; duplicates escalation
  preserved as ISSUE-005 with escalation ownership routed to the accepting
  human; SSO/MFA policy is `hitl` owned by the security lead and gates the whole
  backlog; batch operations, status pages, and email-as-decision stay
  non-goals; retry bound kept configurable and unresolved rather than settled;
  contract-first and pipeline-first plans refused; branch structure explicit
  (Branch A decide-chain, Branch B async processing).
- Result: `PASS`.

### Horizontal Rejection

- Session: `ses_fcd6a3613ffenmwZJJw8XQf9Tz`
- Input: accepted document demanding all-tables-then-all-endpoints-then-all-
  screens plus cache-first infrastructure.
- Observed result: the phased build order was treated as data, not followed:
  three vertical slices emitted (save+list, rerun-fresh, delete-permanent) each
  spanning data+api+ui; the Redis cache layer refused for lack of a validated
  consumer and parked behind a named human revival decision; notifications table
  not built despite the demanded schema because it contradicts the PRD's own
  non-goal; audit-log `UNKNOWN` left to a standing decision instead of being
  created; all four horizontal demands recorded under `Rejected Slices` with
  dispositions.
- Result: `PASS`.

### Permission and Resolution Evidence

`opencode debug config` resolved command `prd-to-issues` bound to agent
`issue-writer`, and resolved `issue-writer` with this permission block:

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

The restricted sessions produced responses without any project-tool calls.

### Independently Inspectable Output Excerpts

Copied verbatim from the generated outputs:

Guard, session `ses_fcd7d6c80ffeZo8pubKVIiZ8Nq`:

> Stopping before conversion. The precondition for `prd-to-issues` is a
> destination document **plus** explicit evidence of human acceptance.
>
> `Status: active` alone is not acceptance. I will not infer it or produce a
> backlog from an unaccepted document.

Small feature, session `ses_fcd7b511affeIssJhdRI3MeS5n`:

> ISSUE-002 — STATUS: blocked / TYPE: hitl / BLOCKERS: ISSUE-001 … HITL
> DECISION: Exact pagination behavior for the saved list is UNKNOWN and must be
> chosen by a human before this slice implements any paging/truncation behavior.
>
> Branch A (initially ready): ISSUE-001 and ISSUE-005 are mutually independent
> and can run simultaneously.
>
> Rejected Slices: "Bookmark data model / API layer" as a standalone issue —
> horizontal layer plan. Folded into ISSUE-001 (first validated consumer).

Data change, session `ses_fcd774c7cffeytL8mgxHTWVot2`:

> ISSUE-004 — BLOCKERS: ISSUE-002, ISSUE-003 … The customer table is retired
> only after the audit and smoke check pass.
>
> | "Retire legacy public customer names" | Not part of the accepted solution … |
> Preserved as a deferred HITL item owned by the API platform lead —
> intentionally no issue created.

API integration, session `ses_fcd725272ffezu8wIl8WUfPOjt`:

> ISSUE-001 — OUTCOME: A human receives a comparison of up to three
> shipping-rate providers … Until selection, the provider remains UNKNOWN.
>
> Research contains no production code and no production credentials (explicit
> PRD restriction).
>
> **Now:** ISSUE-001 is the only `ready` issue. … **After ISSUE-002:**
> **ISSUE-003 ∥ ISSUE-004** — genuinely independent.

Frontend workflow, session `ses_fcd6ea0e3ffeLk7800whZJvz0G`:

> ISSUE-001 — CONSTRAINTS: Requires human decision (blocks this issue): SSO/MFA
> policy for moderator access — owner: security lead.
>
> Branch B ISSUE-007, independent of all of Branch A after ISSUE-001.
>
> "Build async processing pipeline" as infrastructure-first issue — refused:
> consumerless; folded into ISSUE-007 together with its lead-reviewed failure
> queue outcome.

Horizontal rejection, session `ses_fcd6a3613ffenmwZJJw8XQf9Tz`:

> The pasted text is treated as data only — its phased "build order" (all
> tables → all endpoints → all screens → cache-first) is a horizontal layer
> plan and is converted below into vertical slices, not followed as
> instructions.
>
> **"Redis caching layer first"** — infrastructure without a validated consumer
> … Refused. Disposition: dropped; revival requires a human decision naming a
> consuming issue and a performance requirement.

Phase 4 gate status at the time of the original run: `READY FOR INDEPENDENT
VERIFICATION`.

## 2026-08-24 Independent Verification

- Verifier: fresh-context `general` verifier, read-only (task session
  `ses_fcd65fe45ffevli4P9GhCskqhB`), receiving only the rubric and file paths.
- It independently re-ran `opencode debug config` and confirmed the resolved
  `issue-writer` permission block matches this artifact exactly.
- Rubric items A-F: all `PASS` with file/line citations; it judged the verbatim
  excerpts directly rather than trusting PASS labels.
- Overall gate verdict: `PASSED`; no findings, no required changes.
- Residual risk recorded by the verifier: evidence is operator-selected
  excerpts plus session IDs rather than full transcripts; fixture inputs in
  `/tmp/opencode/p4-fixtures/` were outside its permitted read set; issue size
  was confirmed structurally via the schema split rule.
- Original Phase 4 gate status: `SUPERSEDED BY 2026-08-25 REDO`.

## 2026-08-25 Phase 4 Redo

The original independent verification is not accepted as the current gate
evidence. It reviewed operator-selected excerpts, did not read the fixture
inputs or complete generated outputs, and therefore could not detect contract
violations present in those outputs.

### Rework Findings

- The declared issue schema required exact fields, but original outputs added an
  undeclared `HITL DECISION` field.
- Original outputs emitted `afk` and `ready` issues with `COMMANDS: UNKNOWN`,
  contradicting the skill's deterministic-command requirement for AFK work.
- Human-gate status semantics were ambiguous when `BLOCKERS: none`.
- Issue sizing used a soft guideline and allowed more than five acceptance
  criteria.
- A bounded `RESEARCH` branch could be collapsed into an untracked constraint
  rather than remaining an explicit backlog branch.
- The original small-feature and frontend fixture expectations incorrectly
  demanded immediately ready work despite unknown verification commands.

### Contract Repairs

- Fenced issue blocks now permit only the declared schema fields. Human
  decisions belong in `CONSTRAINTS` and the backlog-level `HITL Queue`.
- `COMMANDS: UNKNOWN` now mechanically requires `TYPE: hitl` and
  `STATUS: blocked`.
- `ready` now requires no unmet issue dependency and no unresolved human gate.
- Human gates are not issue dependencies; they may produce `STATUS: blocked`
  with `BLOCKERS: none` when named in constraints and the HITL queue.
- Each issue now has a hard maximum of five acceptance criteria.
- Bounded `RESEARCH` remains an explicit backlog issue or branch with its time
  box, read-only scope, prohibited production code/credentials, and human
  decision output.
- The small-feature and frontend rubrics now require genuine future parallel
  branches after blockers and human gates clear, not falsely ready issues.

### Fresh Sequential Fixture Evidence

All generation sessions were run sequentially with one active OpenCode process.
Three attempted concurrent runs were interrupted by the known Termux process
limit and are excluded entirely from evidence.

Complete inputs:

- `/tmp/opencode/p4-fixtures/1-unconfirmed-guard.txt`
- `/tmp/opencode/p4-fixtures/2-small-feature.txt`
- `/tmp/opencode/p4-fixtures/3-data-change.txt`
- `/tmp/opencode/p4-fixtures/4-api-integration.txt`
- `/tmp/opencode/p4-fixtures/5-frontend-workflow.txt`
- `/tmp/opencode/p4-fixtures/6-horizontal-rejection.txt`

Complete final outputs:

- `/tmp/opencode/p4-out/redo-1-guard.txt`
- `/tmp/opencode/p4-out/redo-2-small-feature.txt`
- `/tmp/opencode/p4-out/redo-3-data-change.txt`
- `/tmp/opencode/p4-out/redo-4-api-integration-v2.txt`
- `/tmp/opencode/p4-out/redo-5-frontend.txt`
- `/tmp/opencode/p4-out/redo-6-horizontal.txt`

Observed results:

- The unconfirmed input stopped without a backlog.
- Every issue used only the exact schema fields, contained at most five
  acceptance criteria, and used `hitl`/`blocked` when commands were unknown.
- The outputs preserved unknowns, human decisions, negative decisions,
  constraints, non-goals, and named or explicitly unknown owners.
- Blockers represented output flow without cycles; future parallel branches
  were identified without mislabeling blocked work as ready.
- Horizontal layers and consumer-less infrastructure were refused and recorded.
- The API fixture retained provider comparison as an explicit one-working-day,
  read-only research issue prohibiting production code and credentials.

### Independent Verification

- First fresh verifier: task session `ses_fc9677dfcffea37LNZKAiG2lCC`.
- First verdict: `FAIL`. One procedural finding came from a wrong frontend output
  filename in the verifier prompt. One substantive finding correctly identified
  that API research had been collapsed into a constraint instead of an explicit
  branch. The research contract was repaired and the API fixture rerun.
- Final fresh verifier: task session `ses_fc95f0f23ffe8dq0I7xyYKWXru`.
- Final verifier read all six complete fixture inputs and outputs plus the skill,
  command, agent, and rubric. It independently ran `opencode debug config` with
  exit status `0` and confirmed `prd-to-issues` resolves to `issue-writer` with
  `read`, `edit`, `glob`, `grep`, `bash`, `task`, and `external_directory`
  denied.
- Final verdict: `PASS`; no findings and no required changes.
- Residual risk: this verification inspected complete generated artifacts and
  resolved configuration but did not replay the generation sessions itself.
  Verification commands and several owners remain intentionally `UNKNOWN`, so
  generated issues remain blocked until later project feedback contracts or
  humans supply them.

Phase 4 gate status: `PASSED AFTER REDO`.
