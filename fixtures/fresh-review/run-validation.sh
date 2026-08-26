#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p7-validation"
LOGS="$WORK/logs"
rm -rf "$WORK"
mkdir -p "$LOGS"

run_case() {
  name="$1"
  expected="$2"
  shift 2
  log="$LOGS/$name.log"
  started="$(date +%s)"
  set +e
  "$@" >"$log" 2>&1
  code=$?
  set -e
  finished="$(date +%s)"
  duration=$((finished - started))
  {
    printf 'command='; printf '%q ' "$@"
    printf '\ncwd=%s\nenvironment=inherited; command-scoped assignments are recorded in command\nduration_s=%s\nexit_code=%s\nevidence=%s\n' "$ROOT" "$duration" "$code" "$log"
  } >>"$log"
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' "$name" "$code" "$expected" "$ROOT" "$duration" "$log" | tee -a "$LOGS/results.txt"
  [ "$code" -eq "$expected" ]
}

set -e
run_case syntax 0 bash -n "$ROOT/run-validation.sh"
run_case seeded-review 0 node "$ROOT/assert-review.js" "$ROOT"
run_case result-contract 0 node "$ROOT/assert-result.js" "$WORK/review-result.md"
run_case complete-inputs 0 node "$ROOT/assert-inputs.js" "$ROOT"
run_case config-contract 0 node "$ROOT/assert-config.js" "$ROOT"
printf 'phase-7 fixture validation passed\n' | tee -a "$LOGS/results.txt"
