ISSUE-003: Restore doubling behavior
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: `double(3)` returns 6 instead of adding 2.
ACCEPTANCE:
- `double(3)` returns 6.
- The existing module export remains callable.
LAYERS: domain
MODULES: `double(value)` in `src.js`
TESTS: Demonstrate the regression as red, restore the multiplication behavior, then run syntax and behavior checks.
COMMANDS: `node test.js`; `node --check src.js`
CONSTRAINTS: Smallest implementation; no unrelated refactor.
NON-GOALS: No new numeric API or input-validation policy.
