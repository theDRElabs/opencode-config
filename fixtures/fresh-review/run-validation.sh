#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p7-validation"
LOGS="$WORK/logs"
rm -rf "$WORK"
mkdir -p "$LOGS"

SUITE_NAME="fresh-review"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
CASE_CONTINUE=1
FRESH_REVIEW_THRESHOLD=0.9
export REVIEW_RESULT_OUT="$WORK/review-result.md"
. "$ROOT/../_lib/run-case.sh"

set -e
run_case syntax 0 bash -n "$ROOT/run-validation.sh"
run_scored_case seeded-review "$FRESH_REVIEW_THRESHOLD" node "$ROOT/assert-review.js" "$ROOT"
run_case result-contract 0 node "$ROOT/assert-result.js" "$WORK/review-result.md"
run_case complete-inputs 0 node "$ROOT/assert-inputs.js" "$ROOT"
run_case config-contract 0 node "$ROOT/assert-config.js" "$ROOT"

finish_suite 'phase-7 fixture validation passed (fresh-review recall threshold met)'