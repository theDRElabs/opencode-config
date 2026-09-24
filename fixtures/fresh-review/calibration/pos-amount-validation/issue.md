# ISSUE ORD-201
OUTCOME: A customer's order total reflects the discount, and an over-large
discount never produces a negative total.

## Acceptance Criteria
1. A discount larger than the subtotal is rejected and the order is not saved.
2. A valid discount produces a non-negative total and is persisted.
3. Repository failures are surfaced as 500 and are not reported as success.
4. Tests cover the valid discount, the over-large discount, and the failure path.

## Module Boundaries
- `src/order.js` owns order totals.
- `test/order.test.js` owns behavior tests.
- Do not change unrelated modules or test assertions.
