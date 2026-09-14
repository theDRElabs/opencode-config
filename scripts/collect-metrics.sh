#!/usr/bin/env bash
set -euo pipefail

# Harness Metrics Collector
# Runs all fixture validation suites and produces structured JSON output.
# Usage: bash scripts/collect-metrics.sh [--json]

CONFIG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES_DIR="$CONFIG_DIR/fixtures"
OUT_DIR="/tmp/opencode/metrics-$(date +%Y%m%d-%H%M%S)"
LOGS="$OUT_DIR/logs"
mkdir -p "$LOGS"

JSON_MODE=false
[[ "${1:-}" == "--json" ]] && JSON_MODE=true

results=()
total_pass=0
total_fail=0
total_cases=0
total_duration=0

run_suite() {
  local name="$1"
  local script="$2"
  local suite_log="$LOGS/$name.log"
  local start end duration exit_code cases pass_count fail_count

  if [[ ! -f "$script" ]]; then
    printf '{"suite":"%s","status":"missing","cases":0,"pass":0,"fail":0,"duration_s":0}\n' "$name"
    return
  fi

  start=$(date +%s)
  set +e
  bash "$script" >"$suite_log" 2>&1
  exit_code=$?
  set -e
  end=$(date +%s)
  duration=$((end - start))

  # Parse results.txt if it exists
  cases=0; pass_count=0; fail_count=0
  local results_file
  results_file="$(dirname "$suite_log")/../logs/results.txt"
  # Some suites write results.txt inside their work dir; scan the log for exit lines
  if [[ -f "$suite_log" ]]; then
    cases=$(grep -c 'exit=' "$suite_log" 2>/dev/null || true)
    if [[ $exit_code -eq 0 ]]; then
      pass_count=$cases
    else
      # Count how many passed before the failure
      fail_count=1
      pass_count=$((cases > 0 ? cases - 1 : 0))
    fi
  fi

  total_cases=$((total_cases + cases))
  total_pass=$((total_pass + pass_count))
  total_fail=$((total_fail + fail_count))
  total_duration=$((total_duration + duration))

  printf '{"suite":"%s","status":"%s","cases":%d,"pass":%d,"fail":%d,"duration_s":%d,"exit_code":%d,"log":"%s"}\n' \
    "$name" "$([ $exit_code -eq 0 ] && echo pass || echo fail)" \
    "$cases" "$pass_count" "$fail_count" "$duration" "$exit_code" "$suite_log"
  # Write totals to a temp file so parent shell can read them (subshell isolation)
  printf '%d %d %d %d\n' "$cases" "$pass_count" "$fail_count" "$duration" >"$LOGS/$name.totals"
}

echo "=== Harness Metrics Collection ===" >&2
echo "Output: $OUT_DIR" >&2
echo "" >&2

# Run each fixture suite
while IFS= read -r -d '' suite_dir; do
  suite_name=$(basename "$suite_dir")
  suite_script="$suite_dir/run-validation.sh"
  result=$(run_suite "$suite_name" "$suite_script")
  results+=("$result")
  status=$(echo "$result" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)
  printf "  %-25s %s\n" "$suite_name" "$status" >&2
  # Read accumulated totals from file
  if [[ -f "$LOGS/$suite_name.totals" ]]; then
    read -r c p f d < "$LOGS/$suite_name.totals"
    total_cases=$((total_cases + c))
    total_pass=$((total_pass + p))
    total_fail=$((total_fail + f))
    total_duration=$((total_duration + d))
  fi
done < <(find "$FIXTURES_DIR" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

# Collect graph memory stats
graph_nodes=0; graph_edges=0; graph_episodes=0; graph_errors=0
if [[ -f "$CONFIG_DIR/graph/nodes.jsonl" ]]; then
  graph_nodes=$(wc -l < "$CONFIG_DIR/graph/nodes.jsonl")
fi
if [[ -f "$CONFIG_DIR/graph/edges.jsonl" ]]; then
  graph_edges=$(wc -l < "$CONFIG_DIR/graph/edges.jsonl")
fi
if [[ -d "$CONFIG_DIR/graph/episodes" ]]; then
  graph_episodes=$(ls "$CONFIG_DIR/graph/episodes/" 2>/dev/null | wc -l)
fi
if [[ -f "$CONFIG_DIR/graph/errors.log" ]]; then
  graph_errors=$(wc -l < "$CONFIG_DIR/graph/errors.log")
fi

# Collect skill stats
skill_count=$(ls -d "$CONFIG_DIR/skills"/*/ 2>/dev/null | wc -l)
skill_lines=0
while IFS= read -r f; do
  lines=$(wc -l < "$f")
  skill_lines=$((skill_lines + lines))
done < <(find "$CONFIG_DIR/skills" -name "SKILL.md" -type f 2>/dev/null)

# Context budget
context_lines=0
if [[ -f "$CONFIG_DIR/HARNESS-CONTEXT-BUDGET.md" ]]; then
  context_lines=$(wc -l < "$CONFIG_DIR/HARNESS-CONTEXT-BUDGET.md")
fi

# Phase count from roadmap
phases_completed=0
phases_total=0
if [[ -f "$CONFIG_DIR/HARNESS-ROADMAP.md" ]]; then
  phases_completed=$(grep -c '| completed |' "$CONFIG_DIR/HARNESS-ROADMAP.md" || true)
  phases_total=$(grep -cE '^\| [0-9]+ \|' "$CONFIG_DIR/HARNESS-ROADMAP.md" || true)
fi

timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if $JSON_MODE; then
  # Structured JSON output
  printf '{\n'
  printf '  "timestamp": "%s",\n' "$timestamp"
  printf '  "fixture_suites": [\n'
  for i in "${!results[@]}"; do
    printf '    %s%s\n' "${results[$i]}" "$([ $i -lt $((${#results[@]} - 1)) ] && echo ',' || echo '')"
  done
  printf '  ],\n'
  printf '  "totals": {"cases": %d, "pass": %d, "fail": %d, "duration_s": %d},\n' "$total_cases" "$total_pass" "$total_fail" "$total_duration"
  printf '  "graph": {"nodes": %d, "edges": %d, "episodes": %d, "errors": %d},\n' "$graph_nodes" "$graph_edges" "$graph_episodes" "$graph_errors"
  printf '  "skills": {"count": %d, "total_lines": %d},\n' "$skill_count" "$skill_lines"
  printf '  "phases": {"completed": %d, "total": %d},\n' "$phases_completed" "$phases_total"
  printf '  "context_budget_lines": %d\n' "$context_lines"
  printf '}\n'
else
  # Human-readable summary
  echo ""
  echo "=== Summary ==="
  echo "Fixture suites: ${#results[@]}"
  echo "Total cases: $total_cases (pass: $total_pass, fail: $total_fail)"
  echo "Total duration: ${total_duration}s"
  echo "Graph: $graph_nodes nodes, $graph_edges edges, $graph_episodes episodes, $graph_errors errors"
  echo "Skills: $skill_count ($skill_lines lines)"
  echo "Phases: $phases_completed/$phases_total completed"
  echo "Output: $OUT_DIR"
fi
