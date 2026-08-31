#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p9-validation"
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
    printf '\ncwd=%s\nenvironment=inherited; no secrets recorded\nduration_s=%s\nexit_code=%s\nevidence=%s\n' "$ROOT" "$duration" "$code" "$log"
  } >>"$log"
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' "$name" "$code" "$expected" "$ROOT" "$duration" "$log" | tee -a "$LOGS/results.txt"
  [ "$code" -eq "$expected" ]
}

set -e
run_case syntax 0 bash -n "$ROOT/run-validation.sh"
run_case contract 0 node "$ROOT/assert-contract.js" "$ROOT"
run_case seeded-detection 0 node "$ROOT/assert-seeded.js" "$ROOT"
run_case real-project-audit 0 node "$ROOT/assert-real-audit.js" "$ROOT"
printf 'phase-9 deterministic validation passed\n' | tee -a "$LOGS/results.txt"
{
  for log in "$LOGS/results.txt" "$LOGS/syntax.log" "$LOGS/contract.log" "$LOGS/seeded-detection.log" "$LOGS/real-project-audit.log"; do
    printf '\n===== %s =====\n' "$(basename "$log")"
    while IFS= read -r line || [ -n "$line" ]; do printf '%s\n' "$line"; done < "$log"
  done
} > "$WORK/complete-validation.log"
