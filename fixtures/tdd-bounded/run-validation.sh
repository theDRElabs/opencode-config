#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p6-validation"
LOGS="$WORK/logs"
rm -rf "$WORK"
mkdir -p "$LOGS"

run_case() {
  name="$1"
  expected="$2"
  case_cwd="$3"
  shift 3
  log="$LOGS/$name.log"
  started="$(date +%s)"
  set +e
  (cd "$case_cwd" && "$@") >"$log" 2>&1
  code=$?
  set -e
  finished="$(date +%s)"
  duration=$((finished - started))
  {
    printf 'command='; printf '%q ' "$@"
    printf '\ncwd=%s\nenvironment=inherited; command-scoped assignments are recorded in command\nduration_s=%s\nexit_code=%s\nevidence=%s\n' "$case_cwd" "$duration" "$code" "$log"
  } >>"$log"
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' "$name" "$code" "$expected" "$case_cwd" "$duration" "$log" | tee -a "$LOGS/results.txt"
  [ "$code" -eq "$expected" ]
}

copy_fixture() {
  target="$1"
  rm -rf "$target"
  cp -R "$ROOT/node-domain" "$target"
  chmod +x "$target"/run-*.sh
}

set -e
copy_fixture "$WORK/domain"
run_case domain-red 1 "$WORK/domain" ./run-red.sh
run_case domain-green 0 "$WORK/domain" ./run-green.sh
run_case domain-refactor 0 "$WORK/domain" ./run-refactor.sh

rm -rf "$WORK/migration"
cp -R "$ROOT/migration" "$WORK/migration"
chmod +x "$WORK/migration"/*.sh
run_case migration-red 1 "$WORK/migration" ./run-red.sh
run_case migration-green 0 "$WORK/migration" ./run-green.sh
run_case migration-refactor 0 "$WORK/migration" ./run-refactor.sh

rm -rf "$WORK/bug-fix"
cp -R "$ROOT/bug-fix" "$WORK/bug-fix"
chmod +x "$WORK/bug-fix"/run-*.sh
run_case bug-fix-red 1 "$WORK/bug-fix" ./run-red.sh
run_case bug-fix-green 0 "$WORK/bug-fix" ./run-green.sh
run_case bug-fix-refactor 0 "$WORK/bug-fix" ./run-refactor.sh

run_case blocking-failure 1 "$ROOT/blocking-failure" ./run.sh
run_case ambiguity-rejected 0 "$ROOT" node ./assert-rejected.js ./ambiguous-issue.md

printf 'phase-6 fixture validation passed\n' | tee -a "$LOGS/results.txt"
