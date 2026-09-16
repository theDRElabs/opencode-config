#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p5-validation"
LOGS="$WORK/logs"
WEB="$ROOT/node-web"
ANDROID="$ROOT/android"
PIPELINE_INIT="/home/DRE/projects/pipeline/pipeline-init.sh"

rm -rf "$WORK"
mkdir -p "$LOGS"

SUITE_NAME="project-feedback"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

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
(
  cd "$WORK/android-project"
  git init -q -b main .
  git config user.email v@v
  git config user.name v
  mkdir -p .github/workflows
  echo "existing ci" > .github/workflows/ci.yml
) >"$LOGS/android-setup.log" 2>&1
run_case android-eligible 0 bash -c "cd '$WORK/android-project' && '$PIPELINE_INIT' android-project --check-only"
run_case android-no-clobber 2 bash -c "cd '$WORK/android-project' && '$PIPELINE_INIT' android-project"
run_case android-isolation 0 bash -c "if [ -e '$WORK/android-project/package.json' ] || [ -e '$WORK/android-project/.github/workflows/pipeline.yml' ]; then echo 'android isolation failure: Node/Vercel files created'; exit 1; fi; if [ \"\$(cat '$WORK/android-project/.github/workflows/ci.yml')\" != 'existing ci' ]; then echo 'android no-clobber failure: existing ci.yml was modified'; exit 1; fi; echo 'android isolation passed: no package.json, no pipeline.yml, existing ci.yml preserved'"

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
' /home/DRE/projects/pipeline/.github/workflows/ci.yml

# Backfilled from the Phase 5 Independent Verification Repairs: two static
# checks bypassed metadata capture (HARNESS-ROADMAP.md). Every suite must emit
# case results only through _lib/run-case.sh.
run_case results-contract-no-bypass 0 node -e '
const fs = require("node:fs"), path = require("node:path");
const harness = path.resolve(process.argv[1], "../..");
const fixtures = path.join(harness, "fixtures");
const suites = fs.readdirSync(fixtures, { withFileTypes: true })
  .filter(e => e.isDirectory() && !e.name.startsWith("_"))
  .map(e => e.name);
const problems = [];
const directWrite = ">" + ">" + "$CASE_RESULTS";
const directWriteQuoted = ">" + ">" + "\"$CASE_RESULTS\"";
for (const suite of suites) {
  const file = path.join(fixtures, suite, "run-validation.sh");
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, "utf8");
  if (!text.includes("run-case.sh")) problems.push(suite + ": does not source _lib/run-case.sh");
  if (text.includes(directWriteQuoted) || text.includes(directWrite)) problems.push(suite + ": writes case-results.jsonl directly");
}
if (problems.length) { console.error("results-contract bypass:\n" + problems.join("\n")); process.exit(1); }
console.log("all " + suites.length + " suites emit case results only through _lib/run-case.sh");
' "$ROOT"

# Backfilled from the Phase 15 out-of-scope fixes: the collectors scanned _lib
# as if it were a suite (HARNESS-ROADMAP.md).
run_case collectors-exclude-underscore 0 node -e '
const fs = require("node:fs"), path = require("node:path");
const harness = path.resolve(process.argv[1], "../..");
const missing = [];
for (const rel of ["harness-test.sh", "scripts/collect-metrics.sh"]) {
  const text = fs.readFileSync(path.join(harness, rel), "utf8");
  if (!text.includes("! -name \"_*\"")) missing.push(rel);
}
if (missing.length) { console.error("collectors scan underscore dirs: " + missing.join(", ")); process.exit(1); }
console.log("harness-test.sh and collect-metrics.sh exclude _* directories");
' "$ROOT"

finish_suite 'phase-5 fixture validation passed'