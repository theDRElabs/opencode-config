#!/usr/bin/env bash
set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p5-validation"
LOGS="$WORK/logs"
WEB="$ROOT/node-web"
ANDROID="$ROOT/android"
PIPELINE_INIT="/root/projects/pipeline/pipeline-init.sh"

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
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' "$name" "$code" "$expected" "$PWD" "$duration" "$log" | tee -a "$LOGS/results.txt"
  printf 'command=%q ' "$@" >>"$log"
  printf '\ncwd=%s\nenvironment=inherited; command-scoped assignments are recorded in command\nduration_s=%s\nexit_code=%s\nevidence=%s\n' "$PWD" "$duration" "$code" "$log" >>"$log"
  if [ "$code" -ne "$expected" ]; then
    return 1
  fi
}

copy_web() {
  target="$1"
  rm -rf "$target"
  cp -R "$WEB" "$target"
}

set -e

copy_web "$WORK/valid"
run_case valid-full 0 npm --prefix "$WORK/valid" run check:full

copy_web "$WORK/type-fail"
printf '\nfunction broken( {\n' >>"$WORK/type-fail/src/value.js"
run_case type-fail 1 npm --prefix "$WORK/type-fail" run check:full

copy_web "$WORK/test-fail"
perl -0pi -e 's/assert\.equal\(double\(3\), 6\)/assert.equal(double(3), 7)/' "$WORK/test-fail/test/value.test.js"
run_case test-fail 1 npm --prefix "$WORK/test-fail" run check:full

copy_web "$WORK/lint-fail"
printf '\nvar forbidden = true;\n' >>"$WORK/lint-fail/src/value.js"
run_case lint-fail 1 npm --prefix "$WORK/lint-fail" run check:full

copy_web "$WORK/build-fail"
run_case build-fail 1 env INJECT_BUILD_FAILURE=1 npm --prefix "$WORK/build-fail" run check:full

copy_web "$WORK/eligible-web"
mkdir -p "$WORK/eligible-web/.git"
run_case eligible-web 0 bash -c "cd '$WORK/eligible-web' && '$PIPELINE_INIT' eligible-web --check-only"

mkdir -p "$WORK/ineligible-tiny/.git"
run_case ineligible-tiny 3 bash -c "cd '$WORK/ineligible-tiny' && '$PIPELINE_INIT' ineligible-tiny --check-only"

rm -rf "$WORK/android-project"
cp -R "$ANDROID" "$WORK/android-project"
mkdir -p "$WORK/android-project/.git"
run_case android-rejected 2 bash -c "cd '$WORK/android-project' && '$PIPELINE_INIT' android-project"
run_case android-isolation 0 bash -c "if [ -e '$WORK/android-project/package.json' ] || [ -e '$WORK/android-project/.github/workflows/pipeline.yml' ]; then echo 'android isolation failure: Node/Vercel files created'; exit 1; fi; echo 'android isolation passed: no package.json or pipeline.yml'"

run_case pipeline-static 0 node -e '
const fs = require("node:fs");
const source = fs.readFileSync(process.argv[1], "utf8");
for (const name of ["Type check", "Lint", "Test", "Build"]) {
  if (!source.includes(`- name: ${name}`)) {
    console.error(`pipeline gate failure: missing ${name}`);
    process.exit(1);
  }
}
if (source.includes("continue-on-error")) {
  console.error("pipeline gate failure: continue-on-error remains");
  process.exit(1);
}
console.log("pipeline gates passed: typecheck, lint, test, build exist and are hard failures");
' /root/projects/pipeline/.github/workflows/ci.yml

printf 'phase-5 fixture validation passed\n' | tee -a "$LOGS/results.txt"
