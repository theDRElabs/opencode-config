ISSUE-001: Classify a score at the high threshold
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: A score of 10 is classified as high.
ACCEPTANCE:
- `labelFor(10)` returns `high`.
- Scores below 10 remain `low`.
LAYERS: domain
MODULES: `labelFor(score)` in `src.js`
TESTS: Add a focused assertion, demonstrate red before implementation, then green and refactor reruns.
COMMANDS: `npm test`; `node --check src.js`
CONSTRAINTS: Preserve the existing function export and unrelated behavior.
NON-GOALS: No API, persistence, or threshold policy changes beyond this issue.
