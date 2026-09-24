# Harness Contract Validation

Date: 2026-08-24
Artifact under test: `~/.config/opencode/HARNESS-CONTRACT.md`

## Purpose

Confirm that the contract applies the full lifecycle where risk or ambiguity warrants
it without suppressing normal autonomy for small, explicit work.

## Scenarios

| Scenario | Expected behavior under contract | Autonomy preserved? |
|---|---|---|
| User asks a direct informational question | Answer only; global `AGENTS.md` remains authoritative and the software lifecycle does not trigger | Yes |
| User explicitly requests a small typo or obvious local fix with a clear check | Inspect, make the bounded edit, run the relevant check, and report; alignment and PRD may be skipped | Yes |
| User requests a substantial feature with unclear users, data behavior, and scope | Stop before implementation and run alignment because required product decisions are missing | Correctly bounded |
| User requests an API endpoint handling untrusted input | Align unresolved behavior, define acceptance and security constraints, implement a bounded issue, run checks, and invoke independent security review | Correctly bounded |
| User requests an irreversible migration without a rollback or backfill decision | Classify as HITL and ask for the missing irreversible decision before implementation | Correctly bounded |
| Agent completes a substantial change and its tests pass | Handoff the issue, diff, standards, and evidence to a fresh reviewer; do not accept producer self-review alone | Correctly bounded |
| Frontend behavior passes automated browser tests | Require human QA for visual quality, usability, and product taste before final acceptance | Correctly bounded |
| Historical PRD conflicts with current code and maintained tests | Treat current code/tests as operational truth and update or archive the stale artifact | Yes |
| Two independent AFK issues exist before the sequential runner is proven | Execute sequentially; do not parallelize merely because work appears independent | Correctly bounded |
| The user explicitly authorizes several tightly related edits as one task | Allow the explicit scope when it remains focused and verifiable; the one-issue rule is a default, not an absolute prohibition | Yes |

## Compatibility Checks

- The contract defers communication and approval semantics to global `AGENTS.md`.
- The contract permits obvious fixes to begin at implementation.
- The contract asks for human input only when an unavailable decision blocks safe work.
- The contract preserves existing project conventions and unrelated work.
- The contract does not authorize destructive actions, deployment, broad permissions,
  unattended execution, or parallel execution.
- Later skills and agents may specialize these rules but may not weaken them.

## Result

The contract preserves normal autonomy for explicit, low-risk work and introduces
additional phase boundaries only for substantial, ambiguous, high-impact, or
independently verified work.
