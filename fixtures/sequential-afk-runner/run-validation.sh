#!/usr/bin/env bash
set -u
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT="/tmp/opencode/p10-validation"
LOGS="$OUT/logs"
rm -rf "$OUT"
mkdir -p "$LOGS"

SUITE_NAME="sequential-afk-runner"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

set -e
run_case syntax-runner 0 node --check "$ROOT/runner.mjs"
run_case syntax-adapter 0 node --check "$ROOT/adapter.mjs"
run_case syntax-shell 0 bash -n "$ROOT/run-validation.sh"
run_case scenarios 0 node "$ROOT/test-runner.mjs" "$OUT"

finish_suite 'phase-10 deterministic validation passed'