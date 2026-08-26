# Phase 8 Complete Change Handoff

Date: 2026-08-26

This workspace is not a Git repository, so `git diff` is unavailable. This artifact
is the complete current Phase 8 source handoff. Every listed file is supplied in full
in the same workspace and is in scope for this phase.

## Added Files

- `/root/.config/opencode/skills/manual-qa-plan/SKILL.md`
- `/root/.config/opencode/commands/manual-qa-plan.md`
- `/root/.config/opencode/agent/manual-qa.md`
- `/root/.config/opencode/fixtures/manual-qa/frontend/index.html`
- `/root/.config/opencode/fixtures/manual-qa/issue.md`
- `/root/.config/opencode/fixtures/manual-qa/qa-checklist.md`
- `/root/.config/opencode/fixtures/manual-qa/expected-follow-up.md`
- `/root/.config/opencode/fixtures/manual-qa/assert-inputs.js`
- `/root/.config/opencode/fixtures/manual-qa/browser-check.js`
- `/root/.config/opencode/fixtures/manual-qa/server.js`
- `/root/.config/opencode/fixtures/manual-qa/run-validation.sh`
- `/root/.config/opencode/HARNESS-PHASE-8-VALIDATION.md`
- `/root/.config/opencode/HARNESS-PHASE-8-DIFF.md`

## Updated Files

- `/root/.config/opencode/HARNESS-ROADMAP.md`

## Scope and Intent

The Phase 8 workflow provides a human-owned QA checklist, read-only QA agent and
command, deterministic frontend fixture, Playwright browser evidence runner, and
follow-up issue schema/example. The current fixture repair moves protected note seed
data behind an HttpOnly-session-backed fixture server. Unauthorized state takes
precedence over URL role parameters; unauthorized pages cannot render or search notes,
cannot expose editor actions, and direct note/editor API requests return HTTP 403.
Sign-out lands in the same protected state. The browser runner also asserts desktop and
mobile no-overflow and critical-control usability. Human product, visual, usability,
accessibility, security, product-fit, and release acceptance remain outside automated
evidence.

## Complete Artifact Rule

No other source files were intentionally changed for Phase 8. Generated runtime
evidence is recorded separately under `/tmp/opencode/p8-validation/` and is not part
of this source handoff.

The complete current contents of `/root/.config/opencode/HARNESS-ROADMAP.md` are
also part of this handoff and must be supplied to independent verification together
with the paths above.

## Updated Roadmap Artifact

- `/root/.config/opencode/HARNESS-ROADMAP.md` is a required complete source artifact.
- Its current Phase 8 section records the authorization repair, historical overflow
  failure, authoritative passing revalidation, and the remaining independent and
  human acceptance gates.
