# ISSUE REF-101
OUTCOME: `formatBytes` reads as a table lookup instead of a nested ternary chain.
No exported behavior changes.

## Acceptance Criteria
1. `formatBytes` returns the same string for every input as before the change.
2. Tests cover the B, KB, and MB branches.
3. The exported signature is unchanged.

## Module Boundaries
- `src/format.js` owns byte formatting.
- `test/format.test.js` owns its behavior tests.
- No other module changes.
