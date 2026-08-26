# Human QA Record

Tester: ____________________  Date/build: ____________________

## Human-owned checks

| Check | Result | Notes/evidence |
|---|---|---|
| Primary workflow with realistic seeded data | TODO | |
| Empty state and next action | TODO | |
| Loading feedback and duplicate-action behavior | TODO | |
| Error recovery and partial-data behavior | TODO | |
| Boundary/validation cases | TODO | |
| Signed-out, expired, editor, viewer, forbidden access | TODO | |
| Desktop layout and keyboard focus | TODO | |
| Mobile layout, touch targets, wrapping, overflow | TODO | |
| Console and network failures reviewed | TODO | |
| Visual hierarchy, contrast, copy, and usability | TODO | |

Human acceptance boundary: automated evidence below does not constitute visual,
usability, accessibility, security, product-fit, or release acceptance. The human
tester must decide whether each TODO is acceptable and record blockers.

## Automated evidence

The sequential fixture runner records state transitions, desktop/mobile screenshots,
console messages, failed requests, seed, command, cwd, exit code, and artifact paths.
It is repeatable evidence, not a substitute for this checklist.

The fixture server stores the simulated authorization state in an HttpOnly session
cookie. It returns HTTP 403 for note retrieval by signed-out sessions and for direct
editor-action requests by signed-out or viewer sessions. UI hiding is presentation,
not security enforcement; a production system must enforce the same rules in its
trusted server authorization layer.
