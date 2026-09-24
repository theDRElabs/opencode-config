#!/usr/bin/env bash
# Shared case runner + result emitter for fixture validation suites.
#
# A suite sets before sourcing:
#   SUITE_NAME   suite identifier
#   CASE_LOGS    directory for per-case logs and results.txt
#   ROOT         suite root (default case cwd)
# Optional env (caller-provided):
#   CASE_RESULTS      path to case-results.jsonl (default $CASE_LOGS/case-results.jsonl)
#   KNOWN_FAIL_CASES  space-separated case names whose failure is environmental
#   CASE_CWD          cwd for the next run_case (default $ROOT)
#   CASE_CONTINUE     "1" records failures and keeps running; finish_suite still
#                     fails the suite. Default aborts the suite on first failure.
#   SCORE_FILE        where a scored grader writes {"score": <0..1>, ...}.
#                     run_scored_case sets this; the grader must honor it.

SUITE_NAME="${SUITE_NAME:-unknown}"
CASE_RESULTS="${CASE_RESULTS:-$CASE_LOGS/case-results.jsonl}"
KNOWN_FAIL_CASES="${KNOWN_FAIL_CASES:-}"
CASE_CONTINUE="${CASE_CONTINUE:-0}"
CASE_FAIL_COUNT=0
CASE_PASS_COUNT=0
LAST_CASE_STATUS=""

is_known_fail() {
  case " ${KNOWN_FAIL_CASES} " in
    *" $1 "*) return 0 ;;
  esac
  return 1
}

_after_case() {
  LAST_CASE_STATUS="$1"
  case "$1" in
    pass|known_fail) return 0 ;;
    fail)
      if [ "$CASE_CONTINUE" = "1" ]; then return 0; fi
      return 1
      ;;
  esac
}

emit_case_result() {
  local name="$1" expected="$2" actual="$3" duration="$4" evidence="$5"
  local status score known_fail="false"
  if [ "$actual" -eq "$expected" ]; then
    status="pass"; score="1.0"; CASE_PASS_COUNT=$((CASE_PASS_COUNT + 1))
  else
    status="fail"; score="0.0"; CASE_FAIL_COUNT=$((CASE_FAIL_COUNT + 1))
    if is_known_fail "$name"; then
      known_fail="true"; status="known_fail"
    fi
  fi
  printf '{"suite":"%s","case":"%s","expected":%s,"actual":%s,"score":%s,"threshold":1.0,"status":"%s","duration_s":%s,"evidence":"%s","known_fail":%s,"timestamp":"%s"}\n' \
    "$SUITE_NAME" "$name" "$expected" "$actual" "$score" "$status" "$duration" "$evidence" "$known_fail" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$CASE_RESULTS"
  _after_case "$status"
}

emit_scored_result() {
  local name="$1" threshold="$2" score="$3" duration="$4" evidence="$5"
  local status known_fail="false"
  if node -e 'process.exit(Number(process.argv[1]) >= Number(process.argv[2]) ? 0 : 1)' "$score" "$threshold"; then
    status="pass"; CASE_PASS_COUNT=$((CASE_PASS_COUNT + 1))
  else
    status="fail"; CASE_FAIL_COUNT=$((CASE_FAIL_COUNT + 1))
    if is_known_fail "$name"; then
      known_fail="true"; status="known_fail"
    fi
  fi
  printf '{"suite":"%s","case":"%s","expected":%s,"actual":%s,"score":%s,"threshold":%s,"status":"%s","duration_s":%s,"evidence":"%s","known_fail":%s,"timestamp":"%s"}\n' \
    "$SUITE_NAME" "$name" "$threshold" "$score" "$score" "$threshold" "$status" "$duration" "$evidence" "$known_fail" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$CASE_RESULTS"
  _after_case "$status"
}

# run_case <name> <expected-exit-code> <command...>
run_case() {
  local name="$1" expected="$2"
  shift 2
  local cwd="${CASE_CWD:-$ROOT}"
  local log="$CASE_LOGS/$name.log"
  local started finished duration code
  started="$(date +%s)"
  set +e
  ( cd "$cwd" && "$@" ) >"$log" 2>&1
  code=$?
  set -e
  finished="$(date +%s)"
  duration=$((finished - started))
  {
    printf 'command='; printf '%q ' "$@"
    printf '\ncwd=%s\nenvironment=inherited; command-scoped assignments are recorded in command\nduration_s=%s\nexit_code=%s\nevidence=%s\n' \
      "$cwd" "$duration" "$code" "$log"
  } >>"$log"
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' \
    "$name" "$code" "$expected" "$cwd" "$duration" "$log" | tee -a "$CASE_LOGS/results.txt"
  emit_case_result "$name" "$expected" "$code" "$duration" "$log"
}

# run_scored_case <name> <threshold> <grader...>
# The grader must write {"score": <0..1>, ...} to $SCORE_FILE. Passes when
# score >= threshold. A missing or unparseable score file scores 0.0.
run_scored_case() {
  local name="$1" threshold="$2"
  shift 2
  local cwd="${CASE_CWD:-$ROOT}"
  local log="$CASE_LOGS/$name.log"
  local score_file="$CASE_LOGS/$name.score.json"
  local started finished duration code score
  rm -f "$score_file"
  started="$(date +%s)"
  set +e
  ( cd "$cwd" && SCORE_FILE="$score_file" "$@" ) >"$log" 2>&1
  code=$?
  set -e
  finished="$(date +%s)"
  duration=$((finished - started))
  score="0"
  if [ -f "$score_file" ]; then
    score=$(node -e 'try{const j=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const s=Number(j.score);process.stdout.write(Number.isFinite(s)?String(s):"0")}catch{process.stdout.write("0")}' "$score_file" 2>/dev/null || echo 0)
  fi
  {
    printf 'command='; printf '%q ' "$@"
    printf '\ncwd=%s\nenvironment=inherited; command-scoped assignments are recorded in command\nduration_s=%s\nexit_code=%s\nscore=%s\nthreshold=%s\nevidence=%s\n' \
      "$cwd" "$duration" "$code" "$score" "$threshold" "$log"
  } >>"$log"
  printf '%s score=%s threshold=%s exit=%s cwd=%s duration_s=%s evidence=%s\n' \
    "$name" "$score" "$threshold" "$code" "$cwd" "$duration" "$log" | tee -a "$CASE_LOGS/results.txt"
  emit_scored_result "$name" "$threshold" "$score" "$duration" "$log"
}

# record_case <name> <expected-exit-code> <actual-exit-code> <evidence> [message]
record_case() {
  local name="$1" expected="$2" actual="$3" evidence="$4" message="${5:-}"
  [ -n "$message" ] && printf '%s\n' "$message"
  printf '%s exit=%s expected=%s cwd=%s duration_s=0 evidence=%s\n' \
    "$name" "$actual" "$expected" "${ROOT:-$PWD}" "$evidence" | tee -a "$CASE_LOGS/results.txt"
  emit_case_result "$name" "$expected" "$actual" 0 "$evidence"
}

# record_known_fail <name> <evidence> [message] — record without running
record_known_fail() {
  local name="$1" evidence="$2" message="${3:-}"
  [ -n "$message" ] && printf '%s\n' "$message"
  printf '%s exit=0 expected=0 cwd=%s duration_s=0 evidence=%s known_fail=true\n' \
    "$name" "${ROOT:-$PWD}" "$evidence" | tee -a "$CASE_LOGS/results.txt"
  printf '{"suite":"%s","case":"%s","expected":0,"actual":0,"score":0.0,"threshold":1.0,"status":"known_fail","duration_s":0,"evidence":"%s","known_fail":true,"timestamp":"%s"}\n' \
    "$SUITE_NAME" "$name" "$evidence" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" >>"$CASE_RESULTS"
  LAST_CASE_STATUS="known_fail"; return 0
}

# finish_suite [success-message]
finish_suite() {
  if [ -n "${1:-}" ] && [ "$CASE_FAIL_COUNT" -eq 0 ]; then
    printf '%s\n' "$1" | tee -a "$CASE_LOGS/results.txt"
  fi
  [ "$CASE_FAIL_COUNT" -eq 0 ]
}