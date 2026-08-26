# Fixture Feedback Record

## Fast

- format: `npm run format`
- lint: `npm run lint`
- typecheck: `npm run typecheck`
- tests: `npm test`

## Full

- all fast checks plus build: `npm run check:full`

## Unavailable

| Check | Reason | Substitute | Owner | Residual risk |
|---|---|---|---|---|
| migrations | Fixture has no database | None applicable | fixture maintainer | No migration behavior is exercised |
| e2e | Fixture has no browser UI | Node behavioral test | fixture maintainer | Browser integration is not exercised |
| startup | Fixture has no service | Build artifact check | fixture maintainer | Process readiness is not exercised |
| test-data | Test uses an inline deterministic value | Fresh Node process | fixture maintainer | No seed/reset workflow is exercised |
