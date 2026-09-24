# Fixture Intake — Real-Failure Sourcing

Phase 20 pipeline that turns real harness incidents into regression fixtures.

## The rule

Every harness incident that required a fix becomes a fixture case within the
same session that fixes it. No exceptions. The case lands in the owning suite's
`run-validation.sh` using the Phase 15 JSONL contract
(`fixtures/_lib/run-case.sh`), and the incident is recorded in this file.

## Template

`fixtures/_intake/TEMPLATE.md`.

## Backfilled cases (2026-09-16)

| Case | Suite | Incident source |
|------|-------|-----------------|
| `no-sqlite3-cli` | tdd-bounded | Phase 14: SQLite CLI absent on this host; graders moved to `node:sqlite` (`HARNESS-METRICS.md`, 2026-09-10) |
| `no-stale-absolute-paths` | manual-qa | Phase 14: a stale hardcoded project path broke the browser fixture (`HARNESS-METRICS.md`, 2026-09-10) |
| `env-injection-sanitized` | issue-sandbox | Phase 11 round-5 repairs: loader-injection through an allowlisted child (`HARNESS-ROADMAP.md`) |
| `numeric-id-ordering` | sequential-afk-runner | Phase 10 follow-up fixes: `ISSUE-2` must be selected before `ISSUE-10` (`HARNESS-ROADMAP.md`) |
| `results-contract-no-bypass` | project-feedback | Phase 5 Independent Verification Repairs: two static checks bypassed metadata capture (`HARNESS-ROADMAP.md`) |
| `collectors-exclude-underscore` | project-feedback | Phase 15 out-of-scope fixes: `_lib` was scanned as a suite (`HARNESS-ROADMAP.md`) |

## Running count

- Real-failure-derived cases: **6**
- Target: 20–50 real-derived tasks across the suites.
- The 65 hand-written cases remain; real-derived cases add on top (71 total as
  of 2026-09-16).