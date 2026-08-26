---
name: manual-qa-plan
description: Create and execute a human-owned QA plan with deterministic browser evidence for frontend workflows.
---

# Manual QA Plan

Use this skill after implementation review and before final human acceptance. The
plan is a human QA record, not an automated approval. Browser checks provide
repeatable behavioral and visual evidence; a human owns product judgment.

## Entry Information

Require the bounded issue, acceptance criteria, target users, supported browsers,
seed/reset command, startup command, test credentials or role model, and the
environment URL. Return `BLOCKED` when a required input is missing.

## Human QA Checklist

Record `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`, notes, and evidence for each:

- Primary workflow: complete the main user journey with realistic seeded data;
  verify persistence, navigation, confirmation, and recovery after refresh.
- Empty state: reset to no records and confirm the message explains what happened
  and offers the correct next action.
- Loading state: exercise a delayed response and check that feedback is visible,
  stable, accessible, and does not permit unsafe duplicate actions.
- Error state: exercise a failed request and verify a specific user-facing recovery
  path; inspect that partial data is not presented as success.
- Boundaries and validation: blank, minimum, maximum, malformed, duplicate, rapid
  repeat, back/refresh, and network interruption cases relevant to the issue.
- Authentication and authorization: signed-out, authenticated, expired-session,
  permitted-role, and forbidden-role behavior; verify no protected data leaks.
- Responsive behavior: inspect desktop and mobile widths, orientation-sensitive
  layouts, keyboard focus, touch targets, overflow, and text wrapping.
- Realistic data: use representative names, long values, dates, counts, and any
  domain-specific sensitive-looking values without production data.
- Browser health: review console errors/warnings and failed or unexpected network
  requests. Attach logs rather than relying on memory.
- Visual quality and usability: human judges hierarchy, legibility, contrast,
  spacing, alignment, copy, affordances, feedback, and whether the flow feels
  trustworthy and complete. Automated screenshots are evidence only.

## Ownership Boundary

Automated evidence may establish that selectors, state transitions, viewport
layouts, console capture, and request-failure detection occurred. It cannot accept
visual taste, copy quality, usability, accessibility in the broad sense, security,
realistic product fit, or release readiness. A human must explicitly record those
decisions and acceptance boundaries.

## Deterministic Browser Evidence

Use Playwright only when it reduces repeatable browser work. Prefer stable locators,
explicit state/query fixtures, `waitFor` conditions, one worker, no arbitrary sleeps,
and fixed desktop/mobile viewport projects. Capture full-page screenshots, console
messages, failed requests, URL, viewport, fixture seed, and exact command. Keep
the server and browser lifecycle sequential. Do not use a passing screenshot as a
visual acceptance claim.

## QA Finding Follow-up Issue

Create one issue per observable finding:

```markdown
## QA Finding: <short observable problem>
status: blocked | ready | accepted-risk | resolved
severity: critical | high | medium | low
affected_workflow: <workflow/state>
owner_or_human_decision: <named owner or decision required>
environment: <browser, viewport, build, seed, URL>

### Observable Problem
<what the user sees or what fails>

### Reproduction Steps
1. <exact step>
2. <exact step>

### Evidence
- screenshot: <path>
- browser log: <path>
- network/trace artifact: <path or none>

### Proposed Acceptance Criteria
- [ ] <observable correction>

blocker_status: blocks human acceptance | does not block human acceptance
```

Do not silently convert a human finding into an automated pass. Preserve the
finding and ask the human owner when severity, product behavior, or acceptance is
uncertain.
