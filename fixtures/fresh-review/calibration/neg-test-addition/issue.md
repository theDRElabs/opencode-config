# ISSUE REF-103
OUTCOME: boundary values of `formatBytes` are pinned by regression tests.

## Acceptance Criteria
1. Tests cover 0 bytes, exactly 1024 bytes, and exactly 1 MiB.
2. No production code changes.

## Module Boundaries
- `test/format.test.js` only.
