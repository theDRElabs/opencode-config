# Applicable Standards

- Only files named by the issue may change. An unrelated change is a finding.
- An exported signature is a contract. Changing it is a breaking change.
- Errors must propagate to the caller. A failure must never be reported as success.
- Inputs must be validated before they are used. Out-of-range input must be
  rejected, not silently accepted.
- Every acceptance criterion needs a meaningful behavior assertion. A test that
  only asserts a non-null result, or that cannot fail for the defect it claims
  to cover, is a weak test and a finding.
- A reported pass is not proof when the command, log, or assertion is missing,
  incomplete, or misleading. An uncovered regression is a finding.
- When the correct behavior depends on a decision recorded outside the supplied
  bundle, return `unknown` — do not guess a verdict.
