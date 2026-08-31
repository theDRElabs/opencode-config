#!/usr/bin/env bash
set -u

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT="/tmp/opencode/p10-validation"
LOGS="$OUT/logs"
rm -rf "$OUT"
mkdir -p "$LOGS"

run_case() {
  name="$1" expected="$2"
  shift 2
  start="$(date +%s)"
  "$@" >"$LOGS/$name.log" 2>&1
  code=$?
  duration="$(( $(date +%s) - start ))"
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' "$name" "$code" "$expected" "$ROOT" "$duration" "$LOGS/$name.log" | tee -a "$LOGS/results.txt"
  [ "$code" -eq "$expected" ] || exit 1
}

run_case syntax-runner 0 node --check "$ROOT/runner.mjs"
run_case syntax-adapter 0 node --check "$ROOT/adapter.mjs"
run_case syntax-shell 0 bash -n "$ROOT/run-validation.sh"
run_case scenarios 0 node "$ROOT/test-runner.mjs" "$OUT"
printf 'phase-10 deterministic validation passed\n' | tee -a "$LOGS/results.txt"
