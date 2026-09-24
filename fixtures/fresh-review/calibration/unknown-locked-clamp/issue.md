# ISSUE REF-104
OUTCOME: sampling windows that exceed the clamp are truncated to the clamp so a
long gap cannot attribute stale traffic to today.

## Acceptance Criteria
1. A window longer than the clamp is truncated to the clamp.
2. The clamp value matches the locked product decision.
3. Existing tests stay green.

## Module Boundaries
- `src/sampling.js` only.
