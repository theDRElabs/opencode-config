#!/usr/bin/env bash
# harness-test.sh — Run all fixture validation suites and report pass/fail
# Usage: bash ~/.config/opencode/harness-test.sh
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
FIXTURES_DIR="$HARNESS_DIR/fixtures"
RESULTS_FILE="$HARNESS_DIR/harness-health.md"

SUITES=(
  "architecture-audit"
  "fresh-review"
  "issue-sandbox"
  "manual-qa"
  "parallel-afk-runner"
  "project-feedback"
  "sequential-afk-runner"
  "tdd-bounded"
)

PASS=0
FAIL=0
SKIP=0
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

echo "# Harness Health — $NOW" > "$RESULTS_FILE"
echo "" >> "$RESULTS_FILE"
echo "| Suite | Status | Duration |" >> "$RESULTS_FILE"
echo "|-------|--------|----------|" >> "$RESULTS_FILE"

for suite in "${SUITES[@]}"; do
  script="$FIXTURES_DIR/$suite/run-validation.sh"
  if [[ ! -f "$script" ]]; then
    echo "| $suite | SKIP (no run-validation.sh) | - |" >> "$RESULTS_FILE"
    SKIP=$((SKIP + 1))
    continue
  fi

  start=$(date +%s)
  if timeout 120 bash "$script" > "/tmp/harness-test-$suite.log" 2>&1; then
    end=$(date +%s)
    duration=$((end - start))
    echo "| $suite | PASS | ${duration}s |" >> "$RESULTS_FILE"
    PASS=$((PASS + 1))
  else
    end=$(date +%s)
    duration=$((end - start))
    exit_code=$?
    echo "| $suite | FAIL (exit $exit_code) | ${duration}s |" >> "$RESULTS_FILE"
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
done

echo "" >> "$RESULTS_FILE"
echo "**Summary:** $PASS passed, $FAIL failed, $SKIP skipped out of ${#SUITES[@]} suites" >> "$RESULTS_FILE"

echo "=== Harness Test Results ==="
echo "Pass: $PASS | Fail: $FAIL | Skip: $SKIP | Total: ${#SUITES[@]}"
echo "Results written to: $RESULTS_FILE"

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
