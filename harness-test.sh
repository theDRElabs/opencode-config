#!/usr/bin/env bash
# harness-test.sh — Run all fixture validation suites and report per-suite
# pass/fail plus per-case JSONL counts. Consumes the Phase 15 results contract.
# Usage: bash ~/.config/opencode/harness-test.sh
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURES_DIR="$HARNESS_DIR/fixtures"
RESULTS_FILE="$HARNESS_DIR/harness-health.md"
CASE_RESULTS_DIR="/tmp/opencode/harness-test-case-results"
rm -rf "$CASE_RESULTS_DIR"
mkdir -p "$CASE_RESULTS_DIR"

NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "# Harness Health — $NOW" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "| Suite | Status | Cases | Pass | Fail | Known fail | Mean score | Duration |" >> "$RESULTS_FILE"
echo "|-------|--------|-------|------|------|------------|-----------|----------|" >> "$RESULTS_FILE"

PASS=0
FAIL=0
SKIP=0
TOTAL_CASES=0
TOTAL_FAIL_CASES=0
TOTAL_KNOWN_FAIL=0

while IFS= read -r -d '' suite_dir; do
  suite=$(basename "$suite_dir")
  script="$FIXTURES_DIR/$suite/run-validation.sh"
  if [[ ! -f "$script" ]]; then
    echo "| $suite | SKIP (no run-validation.sh) | - | - | - | - | - | - |" >> "$RESULTS_FILE"
    SKIP=$((SKIP + 1))
    continue
  fi

  jsonl="$CASE_RESULTS_DIR/$suite.jsonl"
  : >"$jsonl"
  start=$(date +%s)
  set +e
  CASE_RESULTS="$jsonl" timeout 300 bash "$script" > "/tmp/harness-test-$suite.log" 2>&1
  exit_code=$?
  set -e
  end=$(date +%s)
  duration=$((end - start))

  read -r cases pass_c fail_c known_c mean <<<"$(node - "$jsonl" <<'NODE'
const fs = require("node:fs");
let cases = [];
try { cases = fs.readFileSync(process.argv[2], "utf8").split("\n").filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean); } catch {}
const pass = cases.filter(c => c.status === "pass").length;
const fail = cases.filter(c => c.status === "fail").length;
const known = cases.filter(c => c.status === "known_fail").length;
const mean = cases.length ? (cases.reduce((a, c) => a + (Number(c.score) || 0), 0) / cases.length).toFixed(4) : "0";
console.log(cases.length, pass, fail, known, mean);
NODE
)"

  TOTAL_CASES=$((TOTAL_CASES + cases))
  TOTAL_FAIL_CASES=$((TOTAL_FAIL_CASES + fail_c))
  TOTAL_KNOWN_FAIL=$((TOTAL_KNOWN_FAIL + known_c))

  if [[ "$fail_c" -eq 0 && "$exit_code" -eq 0 ]]; then
    echo "| $suite | PASS | $cases | $pass_c | $fail_c | $known_c | $mean | ${duration}s |" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
  elif [[ "$fail_c" -eq 0 && "$known_c" -gt 0 ]]; then
    echo "| $suite | PASS (known-fail) | $cases | $pass_c | $fail_c | $known_c | $mean | ${duration}s |" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
  else
    echo "| $suite | FAIL (exit $exit_code) | $cases | $pass_c | $fail_c | $known_c | $mean | ${duration}s |" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo "<details><summary>$suite output</summary>" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    echo '```' >> "$RESULTS_FILE"
    tail -30 "/tmp/harness-test-$suite.log" >> "$RESULTS_FILE"
    echo '```' >> "$RESULTS_FILE"
    echo "</details>" >> "$RESULTS_FILE"
    echo "" >> "$RESULTS_FILE"
    FAIL=$((FAIL + 1))
  fi
done < <(find "$FIXTURES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name "_*" -print0 | sort -z)

echo "" >> "$RESULTS_FILE"
echo "**Summary:** $PASS passed, $FAIL failed, $SKIP skipped; $TOTAL_CASES cases ($TOTAL_FAIL_CASES fail, $TOTAL_KNOWN_FAIL known-fail)" >> "$RESULTS_FILE"

echo "=== Harness Test Results ==="
echo "Pass: $PASS | Fail: $FAIL | Skip: $SKIP"
echo "Cases: $TOTAL_CASES (fail: $TOTAL_FAIL_CASES, known-fail: $TOTAL_KNOWN_FAIL)"
echo "Results written to: $RESULTS_FILE"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi