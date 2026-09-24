# ISSUE UP-301
OUTCOME: Uploads report success only when the storage write actually succeeded.

## Acceptance Criteria
1. A successful upload returns 200 and the stored URL.
2. A storage failure returns 500 and is not reported as success.
3. Tests cover the success and the failure path.

## Module Boundaries
- `src/upload.js` owns upload behavior.
- `test/upload.test.js` owns behavior tests.
- Do not change unrelated modules or test assertions.
