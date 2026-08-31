# Seeded Architecture Standards

- Domain contracts must not be owned by persistence or framework modules.
- Database and notification integrations must have controlled test seams.
- Public modules expose behavior, not raw connections or deployment flags.
- Tests assert observable outcomes and important failure behavior.
- Preserve the existing route response contract during migration.
