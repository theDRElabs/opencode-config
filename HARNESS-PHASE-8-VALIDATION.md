# Phase 8 Human QA and Visual Verification Validation

Date: 2026-08-26
Status: COMPLETED

## Rubric

| ID | Requirement | Evidence |
|---|---|---|
| A | A reusable manual QA workflow covers primary, empty, loading, error, boundary/validation, authentication/authorization, responsive, realistic-data, browser-health, and visual/usability checks. | `skills/manual-qa-plan/SKILL.md`; `fixtures/manual-qa/qa-checklist.md` |
| B | Human-owned product, visual, usability, security, accessibility, and release decisions are separate from automated browser evidence. | `skills/manual-qa-plan/SKILL.md`; `fixtures/manual-qa/qa-checklist.md` |
| C | A bounded manual QA command and read-only QA agent exist and reuse existing E2E and frontend-design conventions. | `commands/manual-qa-plan.md`; `agent/manual-qa.md`; `skills/e2e-testing/SKILL.md`; `skills/frontend-design/SKILL.md` |
| D | A deterministic seeded frontend fixture covers primary, empty, loading, error, authorization, desktop/mobile, and browser failure detection. | `fixtures/manual-qa/frontend/index.html`; `fixtures/manual-qa/browser-check.js`; `fixtures/manual-qa/server.js` |
| E | Follow-up issues include observable problem, reproduction, environment, evidence, severity, workflow, acceptance criteria, blocker status, and owner/decision. | `skills/manual-qa-plan/SKILL.md`; `fixtures/manual-qa/expected-follow-up.md` |
| F | Sequential validation records commands, cwd, environment, duration, exit codes, logs, screenshots/browser artifacts, and source inputs. | `fixtures/manual-qa/run-validation.sh`; `/tmp/opencode/p8-validation/logs/`; `/tmp/opencode/p8-validation/artifacts/` |
| G | A complete changed-file handoff is available even though the configuration workspace is not a Git repository. | `HARNESS-PHASE-8-DIFF.md` and every full source path listed there |

## Complete Fixture Inputs

- `/root/.config/opencode/fixtures/manual-qa/issue.md`
- `/root/.config/opencode/fixtures/manual-qa/qa-checklist.md`
- `/root/.config/opencode/fixtures/manual-qa/expected-follow-up.md`
- `/root/.config/opencode/fixtures/manual-qa/frontend/index.html`
- `/root/.config/opencode/fixtures/manual-qa/server.js`
- `/root/.config/opencode/fixtures/manual-qa/browser-check.js`
- `/root/.config/opencode/fixtures/manual-qa/assert-inputs.js`
- `/root/.config/opencode/fixtures/manual-qa/run-validation.sh`
- `/root/.config/opencode/skills/manual-qa-plan/SKILL.md`
- `/root/.config/opencode/commands/manual-qa-plan.md`
- `/root/.config/opencode/agent/manual-qa.md`
- `/root/.config/opencode/HARNESS-PHASE-8-DIFF.md`

## Sequential Commands and Evidence

No concurrent OpenCode processes were started.

1. `bash -n /root/.config/opencode/fixtures/manual-qa/run-validation.sh` -> `0`; `/tmp/opencode/p8-validation/logs/syntax.log`.
2. `node /root/.config/opencode/fixtures/manual-qa/assert-inputs.js /root/.config/opencode/fixtures/manual-qa` -> `0`; `/tmp/opencode/p8-validation/logs/inputs.log`.
3. `npx --no-install playwright install chromium` in `/root/projects/lumen` -> `0`; Chromium, FFmpeg, and headless shell installed under `/root/.cache/ms-playwright/`.
4. `npx --no-install playwright install-deps chromium` in `/root/projects/lumen` -> `0`; required host libraries and fonts installed.
5. `bash /root/.config/opencode/fixtures/manual-qa/run-validation.sh` -> `0`; complete browser evidence generated under `/tmp/opencode/p8-validation/`.

The fixture server started successfully; `/tmp/opencode/p8-validation/logs/server.log`.
The repaired browser log is expected to report 16 events, including 14 state/viewport
cases, viewer authorization evidence, and signed-out authorization evidence. It must
also record server-side HTTP 403 checks, no protected content in unauthorized pages,
responsive overflow/control assertions, console capture, and failed-request capture.
The artifact directory must contain 16 fixture PNG files and
`/tmp/opencode/p8-validation/artifacts/browser-evidence.json`.

## Observed Results

- Source syntax and complete fixture-input contract: PASS.
- Human checklist and follow-up issue shape: PASS by input assertion.
- Browser behavioral evidence, screenshots, desktop/mobile inspection, console and
  network capture: pending the repaired deterministic runner and complete artifact
  inspection.
- Human visual/product acceptance: NOT CLAIMED; it requires a human and usable browser.

## Decisions and Follow-ups

- Automated evidence is limited to repeatable selectors, state transitions, viewport
  screenshots, console capture, and failed-request capture; it cannot accept visual,
  usability, security, accessibility, product-fit, or release quality.
- The viewer authorization finding remains preserved as a resolved follow-up issue.
  The repaired fixture also checks default-role and explicit editor-role unauthorized
  URLs, signed-out behavior, protected-content absence, search disabling, and
  server-side HTTP 403 enforcement.
- A human must still inspect the generated desktop/mobile screenshots and complete
  `fixtures/manual-qa/qa-checklist.md`; automated evidence is not human acceptance.

## Independent Verification Handoff

The completion decision must be made by one fresh read-only verifier receiving only
this rubric, the complete fixture/source paths above, and generated log, screenshot,
and browser-artifact paths. It must not modify files or run an OpenCode process.
Phase 8 remains `in_progress` unless that verifier returns `PASS` with no blocking
finding. Phase 9 remains `pending`.

Fresh verifier: a new read-only verifier is required after the current run.

Historical verifier verdict: `BLOCKED`. The verifier confirmed that syntax and static input
checks pass, but the Phase 8 gate does not pass because:

- the required browser validation exited `1` and generated no screenshots or JSON;
- desktop/mobile and browser-health inspection did not occur;
- the seeded follow-up issue cites an authorization screenshot that does not exist;
- separate complete command evidence for both browser attempts was not retained;
- non-blocking follow-up: the planned primary browser case does not exercise search.

Phase 8 therefore remains `in_progress`. No Phase 9 work may begin.

## 2026-08-26 Browser Installation and Historical Revalidation

- Playwright Chromium, headless shell, FFmpeg, and required Debian host libraries
  were installed successfully.
- The final deterministic runner passed sequentially with syntax, input, browser,
  and evidence exit codes all `0`.
- Current browser evidence contains primary search, empty, loading, error,
  authorization, desktop/mobile screenshots, console/network failure capture, and
  viewer-action hiding evidence.
- Fresh verifier `ses_fc49e8bebffeejEMR53p3UJAjB` returned `BLOCKED` because the
  initial repair still exposed the viewer action and lacked a complete change handoff.
  The action was then hidden and `HARNESS-PHASE-8-DIFF.md` was added.
- Historical final fresh verifier `ses_fc491848cffe7w3nk24dlV39z6` returned `FAIL` with two
  high-severity findings: unauthorized search can render protected seeded notes, and
  an unauthorized URL with the default editor role can expose the editor action.
- The verifier retry budget is exhausted. Phase 8 remains `in_progress`; the gate
  does not pass. Required follow-up is to make unauthorized state authoritative over
  search/data/action rendering, add sign-out and unauthorized-role browser assertions,
  demonstrate server-side authorization, and rerun from a fresh session.

## 2026-08-26 Authorization Repair Handoff

- Protected note seed data was removed from frontend source and is returned only by
  an authorized fixture-server API session.
- Unauthorized state is authoritative over URL role, and sign-out redirects to the
  same unauthorized state. Search is disabled, protected cards/text are absent, and
  editor actions are hidden.
- The fixture server rejects unauthorized note retrieval and viewer/signed-out editor
  actions with HTTP 403. This demonstrates the fixture boundary without implying
  client-side hiding is production security enforcement.
- The browser runner adds deterministic assertions for unauthorized URLs, sign-out,
  protected-content absence, server denials, no horizontal overflow, and usable
  critical controls.
- Current status remains `in_progress` until sequential validation, complete artifact
  inspection, and exactly one fresh independent verifier are complete.

## 2026-08-26 Historical Validation Blocker

- The initial repaired validation run and both permitted retries were used
  sequentially. No concurrent OpenCode process was started.
- Syntax and complete-input checks returned exit `0` on every run.
- Browser validation returned exit `1` on every run at the deterministic responsive
  assertion: `primary/mobile: horizontal overflow 404>390` at
  `fixtures/manual-qa/browser-check.js:9`.
- The failure log was current at that historical point. The runner recreates its output
  directory, so it was intentionally superseded by the authoritative passing run below.
- The runner recreates its output directory on each run, so only the final attempt is
  the current generated evidence. Evidence validation did not run after the blocking
  browser failure, and the incomplete screenshot set is not completion evidence.
- This historical failure was repaired by constraining mobile control sizing and
  excluding the screen-reader-only label from the mobile full-width rule. It is not
  the current validation result.

## 2026-08-26 Authoritative Revalidation

- After the historical overflow repair, the full sequential command
  `bash /root/.config/opencode/fixtures/manual-qa/run-validation.sh` returned exit `0`.
- `results.txt` records syntax, inputs, browser, and evidence all at exit `0`.
- `browser.log` records 16 events and 16 screenshots, network-failure detection,
  console capture, server authorization checks, and responsive assertions.
- `browser-evidence.json` records all authorization URL variants, sign-out behavior,
  protected-content absence, HTTP 403 responses, and desktop/mobile assertions.
- Each current check log records Node, Playwright, Chromium executable, OS, architecture,
  command, cwd, duration, exit code, and evidence path.
- Current artifacts are authoritative for this entry and are tied to the complete
  current handoff in `HARNESS-PHASE-8-DIFF.md`, including the updated roadmap path.
- Phase 8 remains `in_progress` pending one fresh independent verifier and human-owned
  visual/product acceptance. Phase 9 remains `pending`.

## 2026-08-26 Independent Verification Result

- Exactly one fresh read-only verifier was launched after the authoritative passing
  run: `ses_fc460856dffeuitk3QfIh72P50`.
- Verdict: `BLOCKED`.
- The verifier identified stale current-result wording, omitted roadmap handoff,
  incomplete runtime/browser provenance, and a `resolved` follow-up status absent from
  the reusable status schema. These record defects were repaired: historical failure
  wording is explicit, the complete roadmap is required by the handoff, every current
  log records Node/Playwright/Chromium/OS provenance, and `resolved` is schema-valid
  and deterministically asserted.
- The full sequential runner was rerun after those repairs. Syntax, inputs, browser,
  and evidence all returned exit `0`; current artifacts under
  `/tmp/opencode/p8-validation/` supersede historical failed attempts.
- Remaining blocker: the verifier interface could enumerate all PNG files and inspect
  their JSON metadata but could not decode their pixels. Therefore it could not perform
  the explicitly required independent inspection of every desktop/mobile and
  authorization screenshot.
- No second verifier was launched because this session was authorized to launch exactly
  one. Automated responsive assertions pass, but they are not substituted for the
  unavailable independent PNG inspection or for human visual acceptance.
- Phase 8 remains `in_progress`. Phase 9 remains `pending` and was not started.

## 2026-08-26 Final Vision Verification and Completion

- Renamed session `phase 8 vision ver.` is session
  `ses_fc41dc185ffeAsdfsXF4mgecK8`.
- Its final independent verdict was `PASS` with no blocking or non-blocking findings.
- The verifier recorded successful pixel inspection of all 16 required PNGs and
  confirmed the expected states, plausible desktop/mobile framing, visible critical
  controls without obvious clipping or overflow, and no protected notes or editor-only
  controls in unauthorized screenshots.
- The deterministic syntax, input, browser, and evidence checks all remained exit `0`.
- Database provenance shows that the final PNG inspection and verdict were generated by
  `opencode/big-pickle`. Earlier messages in the same renamed session used
  `opencode/x-preview-f-free`; the final response's model-confirmation sentence is
  inaccurate and is not used as evidence.
- The user confirmed Phase 8 is completed. This records the human-owned completion
  decision without converting automated screenshot evidence into broad visual,
  usability, accessibility, security, product-fit, release, or final product
  acceptance claims.
- Phase 8 is `completed`. Phase 9 remains `pending` and was not started by this update.
