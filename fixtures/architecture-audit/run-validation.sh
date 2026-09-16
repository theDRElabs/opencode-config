#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p9-validation"
LOGS="$WORK/logs"
rm -rf "$WORK"
mkdir -p "$LOGS"

SUITE_NAME="architecture-audit"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

set -e
run_case syntax 0 bash -n "$ROOT/run-validation.sh"
run_case contract 0 node "$ROOT/assert-contract.js" "$ROOT"
run_case seeded-detection 0 node "$ROOT/assert-seeded.js" "$ROOT"
run_case real-project-audit 0 node "$ROOT/assert-real-audit.js" "$ROOT"

finish_suite 'phase-9 deterministic validation passed'
{
  for log in "$LOGS/results.txt" "$LOGS/syntax.log" "$LOGS/contract.log" "$LOGS/seeded-detection.log" "$LOGS/real-project-audit.log"; do
    printf '\n===== %s =====\n' "$(basename "$log")"
    while IFS= read -r line || [ -n "$line" ]; do printf '%s\n' "$line"; done < "$log"
  done
} > "$WORK/complete-validation.log"