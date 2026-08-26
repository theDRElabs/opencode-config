## QA Finding: Viewer can open editor-only action (resolved)
status: resolved
severity: high
affected_workflow: authorization / new note
owner_or_human_decision: product owner and security reviewer
environment: Chromium 1280x800, seed=field-notes-v1, state=ready, role=viewer

### Observable Problem
The original fixture exposed an enabled `New note` action to viewers and only reported an error after clicking it. The fixture now hides that action for viewers, and the server rejects direct viewer requests.

### Reproduction Steps
1. Open `/?state=ready&role=viewer` as an authenticated viewer.
2. In the pre-fix reproduction, observe that `New note` is enabled.
3. In the corrected fixture, verify that the editor-only action is hidden.

### Evidence
- screenshot: `/tmp/opencode/p8-validation/artifacts/authorization-viewer.png`
- browser log: `/tmp/opencode/p8-validation/logs/browser.log`
- network/trace artifact: none

### Proposed Acceptance Criteria
- [x] Viewer cannot see or activate the editor-only action in the fixture.
- [x] Direct editor-action requests are rejected server-side with HTTP 403.

blocker_status: does not block human acceptance; deterministic fixture defect resolved
