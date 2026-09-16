#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p6-validation"
LOGS="$WORK/logs"
rm -rf "$WORK"
mkdir -p "$LOGS"

SUITE_NAME="tdd-bounded"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

copy_fixture() {
  target="$1"
  rm -rf "$target"
  cp -R "$ROOT/node-domain" "$target"
  chmod +x "$target"/run-*.sh
}

set -e
copy_fixture "$WORK/domain"
CASE_CWD="$WORK/domain"
run_case domain-red 1 ./run-red.sh
run_case domain-green 0 ./run-green.sh
run_case domain-refactor 0 ./run-refactor.sh

rm -rf "$WORK/migration"
cp -R "$ROOT/migration" "$WORK/migration"
chmod +x "$WORK/migration"/*.sh
CASE_CWD="$WORK/migration"
run_case migration-red 1 ./run-red.sh
run_case migration-green 0 ./run-green.sh
run_case migration-refactor 0 ./run-refactor.sh

rm -rf "$WORK/bug-fix"
cp -R "$ROOT/bug-fix" "$WORK/bug-fix"
chmod +x "$WORK/bug-fix"/run-*.sh
CASE_CWD="$WORK/bug-fix"
run_case bug-fix-red 1 ./run-red.sh
run_case bug-fix-green 0 ./run-green.sh
run_case bug-fix-refactor 0 ./run-refactor.sh

CASE_CWD="$ROOT/blocking-failure"
run_case blocking-failure 1 ./run.sh
CASE_CWD="$ROOT"
run_case ambiguity-rejected 0 node ./assert-rejected.js ./ambiguous-issue.md

finish_suite 'phase-6 fixture validation passed'