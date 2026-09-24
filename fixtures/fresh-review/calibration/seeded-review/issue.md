# ISSUE REVIEW-001
OUTCOME: Authenticated users can update their own profile display name.

## Acceptance Criteria
1. Authenticated users may update only their own profile.
2. Unauthenticated requests return 401 and other users return 403.
3. Database failures are surfaced as 500 and are not reported as success.
4. Tests cover success, authentication, authorization, and database failure.

## Module Boundaries
- `src/profile.js` owns profile update behavior.
- `test/profile.test.js` owns behavior tests.
- Do not change unrelated modules or test assertions.
