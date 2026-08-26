ISSUE-002: Remove the obsolete account status column
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: The disposable database migration creates the compatible account schema and inserts an account.
ACCEPTANCE:
- The migration applies to a fresh disposable database.
- The account row can be read after migration.
- Integrity rehearsal passes after cleanup.
LAYERS: data
MODULES: `schema.sql` and `migrate.sh`
TESTS: Demonstrate a failing migration rehearsal, then a passing migration and integrity check.
COMMANDS: `./migrate.sh`; `sqlite3 db.sqlite "PRAGMA integrity_check;"`
CONSTRAINTS: Disposable database only; never production data; preserve atomic migration behavior.
NON-GOALS: No data backfill, deployment, or production rollout.
