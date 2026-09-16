# Applicable Standards — data-check M6

## Locked product decisions (constraints, not findings)
- Mobile data only; Wi-Fi traffic is out of scope.
- WorkManager-only scheduling. No AlarmManager, no foreground service.
- The permission set is fixed. No new `<uses-permission>` entries.
- Room schema is version 1. No schema change without a migration.
- No new dependencies.
- CI-only builds: there is no local JDK/Android SDK on the review host.

## Review standards
- Authorization is checked before mutation and must fail closed.
- Errors from the repository must propagate to the caller. A failure must
  never be reported as success.
- Every acceptance criterion needs a meaningful behavior assertion. A test
  that only asserts a non-null result is a weak test.
- Only files named by the issue may change. An unrelated change is a finding.
- A reported pass is not proof when the command, log, or assertion is
  missing, incomplete, or misleading.
- A swallowed error, an uncovered regression, or an unrelated change is a
  finding.
