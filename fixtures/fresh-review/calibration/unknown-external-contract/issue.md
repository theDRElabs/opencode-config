# ISSUE REF-105
OUTCOME: profile updates are applied without clobbering fields the caller did
not send.

## Acceptance Criteria
1. An update applies the caller's fields and leaves all others intact.
2. Repository failures propagate to the route.
3. Tests cover the partial-update path.

## Module Boundaries
- `src/profile.js` owns profile update behavior.
- Do not change other modules.
