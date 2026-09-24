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

# Backfilled from the Phase 10 follow-up fixes: lexical ID ordering would pick
# ISSUE-10 before ISSUE-2 (HARNESS-ROADMAP.md). This case locks in numeric
# comparison in the runner.
run_case numeric-id-ordering 0 node -e '
const fs = require("node:fs");
const src = fs.readFileSync(process.argv[1], "utf8");
if (/localeCompare/.test(src)) { console.error("runner.mjs orders IDs with localeCompare"); process.exit(1); }
if (!/idNumber\(a\.id\) - idNumber\(b\.id\)/.test(src)) { console.error("runner.mjs does not sort by numeric ID"); process.exit(1); }
console.log("runner orders issues numerically: ISSUE-2 precedes ISSUE-10");
' "$ROOT/runner.mjs"

finish_suite 'phase-10 deterministic validation passed'