---
name: fresh-context-review
description: Review one substantial implementation in a fresh read-only context against its bounded issue, acceptance criteria, diff, standards, boundaries, and complete verification evidence.
---

# Fresh-Context Review

Use this skill after one bounded implementation and its project-feedback checks.
The reviewer must be a new context that did not produce the implementation. Review
is read-only and is not human acceptance.

## Judge Protocol (calibration)

When the reviewer acts as a calibration judge, three rules are mandatory:

1. **Version stamp.** Every judge output carries a `Judge Version Stamp` section
   naming the model id, the skill/prompt version, and the UTC date. A verdict
   without a version stamp is not admissible calibration evidence.
2. **One dimension per invocation.** Grade exactly one dimension per judge run
   (correctness, completeness, or style). If a review would grade more than one,
   split it into separate judge passes and report each dimension separately.
   Never blend dimensions into a single verdict.
3. **Unknown escape.** Return `UNKNOWN` when the evidence in the diff, sources,
   and verification records is insufficient to decide. Never fabricate a verdict
   to avoid returning `UNKNOWN`.

## Entry Gate

Require these complete inputs before reviewing:

- one bounded issue and its observable acceptance criteria;
- the implementation diff, including every changed file;
- applicable project standards, constraints, non-goals, and module boundaries;
- complete verification evidence with commands, cwd, environment provenance,
  duration, exit codes, results, and complete log or artifact paths.

Return `BLOCKED` when an input is absent or selected excerpts replace available
complete evidence. Return `UNKNOWN` when every required input is present but the
evidence is insufficient to decide a verdict — an unverifiable assumption is not
a basis for `PASS` or `FAIL`. Do not infer omitted requirements, inspect producer chat, or ask
the producing context to explain its intent.

## Independence and Permissions

Start a fresh reviewer context with only the artifact bundle. Read only the supplied
project artifacts and directly relevant source needed to validate file and line
evidence. Never edit files, run shell commands, invoke an implementer, weaken or
rewrite tests, remediate findings, or claim human acceptance.

The general reviewer owns the integrated verdict. Delegate only when applicable:

- `security-reviewer`: authentication, authorization, input, secrets, and other
  security-sensitive surfaces;
- `silent-failure-hunter`: swallowed errors, unsafe fallbacks, and missing error
  propagation;
- `pr-test-analyzer`: behavioral test quality, misleading assertions, changed-path
  coverage, and regressions not exercised by tests.

Give each specialist the same bounded artifact bundle and only its named scope.
Specialists are advisory, read-only contexts and do not issue the integrated verdict.
Do not use them for general acceptance, scope, architecture, or style review.

## Review Method

1. Map every acceptance criterion to implementation and test evidence.
2. Trace each changed hunk to the issue, module boundaries, constraints, or a named
   necessary support change; flag unrelated changes.
3. Inspect behavior, boundary values, failure paths, authorization, and regressions.
4. Assess whether tests would fail for the seeded defect rather than merely execute
   code or assert a weak proxy.
5. Assess verification evidence independently. A reported pass is not proof when
   commands, logs, applicable checks, or assertions are incomplete or misleading.
6. Incorporate applicable specialist findings, remove duplicates, and preserve the
   highest justified severity.

Findings must describe an observable defect or concrete risk. Cite the exact
`path:line` in the supplied post-change source or test artifact and tie the evidence
to an acceptance criterion, standard, boundary, changed behavior, or verification
claim. Order findings `critical`, `high`, `medium`, then `low`.

An unresolved `critical` or `high` finding, failed required check, missing complete
input, acceptance gap, authorization failure, swallowed error, unrelated change, or
uncovered regression makes the verdict `FAIL` or `BLOCKED`, never `PASS`.

## Result Contract

Return exactly these sections:

1. `Verdict`: `PASS`, `FAIL`, `BLOCKED`, or `UNKNOWN`, with one factual reason.
2. `Blocking Findings`: severity-ordered findings, each with `path:line`, issue,
   impact, evidence, and required change; write `None` only when justified.
3. `Non-Blocking Findings`: same shape, or `None`.
4. `Required Changes`: a deduplicated list mapped to finding IDs, or `None`.
5. `Acceptance-Criteria Coverage`: every criterion marked `covered`, `partial`, or
   `uncovered`, with implementation and test evidence.
6. `Verification-Evidence Assessment`: applicable checks, exact evidence quality,
   failures, omissions, misleading claims, and whether evidence supports the verdict.
7. `Residual Risks`: risks remaining after the review, including unavailable checks
   and human QA needs; never claim human acceptance.
8. `Judge Version Stamp`: model id, skill/prompt version, and UTC date of the run.

If there are no findings, say so explicitly but still return every section. The
review result is an independent engineering assessment, not issue completion, merge
approval, deployment approval, or final human acceptance.
