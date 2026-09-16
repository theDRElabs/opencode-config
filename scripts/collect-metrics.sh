#!/usr/bin/env bash
set -euo pipefail

# Harness Metrics Collector (Phase 15)
# Runs all fixture validation suites, parses per-case JSONL results, and emits
# structured JSON or a human-readable summary. Appends a summary line to
# metrics/history.jsonl (in-repo, committed) on every collection run.
#
# Usage: bash scripts/collect-metrics.sh [--json] [--no-history]

CONFIG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES_DIR="$CONFIG_DIR/fixtures"
METRICS_DIR="$CONFIG_DIR/metrics"
OUT_DIR="/tmp/opencode/metrics-$(date +%Y%m%d-%H%M%S)"
LOGS="$OUT_DIR/logs"
mkdir -p "$LOGS" "$METRICS_DIR"

JSON_MODE=false
WRITE_HISTORY=true
for arg in "$@"; do
  case "$arg" in
    --json) JSON_MODE=true ;;
    --no-history) WRITE_HISTORY=false ;;
  esac
done

SUITE_RESULTS=()
total_cases=0
total_pass=0
total_fail=0
total_known_fail=0
total_duration=0

echo "=== Harness Metrics Collection ===" >&2
echo "Output: $OUT_DIR" >&2
echo "" >&2

while IFS= read -r -d '' suite_dir; do
  suite_name=$(basename "$suite_dir")
  suite_script="$suite_dir/run-validation.sh"
  suite_log="$LOGS/$suite_name.log"
  jsonl="$LOGS/$suite_name.jsonl"
  : >"$jsonl"

  if [[ ! -f "$suite_script" ]]; then
    SUITE_RESULTS+=("{\"suite\":\"$suite_name\",\"status\":\"missing\",\"cases\":0,\"pass\":0,\"fail\":0,\"known_fail\":0,\"mean_score\":0,\"duration_s\":0,\"legacy\":true}")
    printf "  %-25s %s\n" "$suite_name" "missing" >&2
    continue
  fi

  start=$(date +%s)
  set +e
  CASE_RESULTS="$jsonl" bash "$suite_script" >"$suite_log" 2>&1
  exit_code=$?
  set -e
  end=$(date +%s)
  duration=$((end - start))

  suite_json=$(node - "$suite_name" "$jsonl" "$exit_code" "$duration" "$suite_log" <<'NODE'
const [name, jsonlPath, exitCode, duration, log] = process.argv.slice(2);
const fs = require("node:fs");
let lines = [];
try {
  lines = fs.readFileSync(jsonlPath, "utf8").split("\n").filter(Boolean);
} catch {}
const cases = [];
for (const line of lines) {
  try { cases.push(JSON.parse(line)); } catch {}
}
const legacy = cases.length === 0;
const count = cases.length;
const pass = cases.filter(c => c.status === "pass").length;
const fail = cases.filter(c => c.status === "fail").length;
const knownFail = cases.filter(c => c.status === "known_fail").length;
const sum = cases.reduce((a, c) => a + (Number(c.score) || 0), 0);
const mean = count ? Number((sum / count).toFixed(4)) : 0;
const status = fail > 0 ? "fail" : (knownFail > 0 ? "pass_with_known_fail" : (Number(exitCode) === 0 ? "pass" : "fail"));
console.log(JSON.stringify({
  suite: name, status, cases: count, pass, fail, known_fail: knownFail,
  mean_score: mean, duration_s: Number(duration), exit_code: Number(exitCode),
  log, legacy
}));
NODE
)

  SUITE_RESULTS+=("$suite_json")
  read -r c p f kf < <(node -e "const j=JSON.parse(process.argv[1]);console.log(j.cases,j.pass,j.fail,j.known_fail)" "$suite_json")
  total_cases=$((total_cases + c))
  total_pass=$((total_pass + p))
  total_fail=$((total_fail + f))
  total_known_fail=$((total_known_fail + kf))
  total_duration=$((total_duration + duration))

  suite_status=$(node -e "console.log(JSON.parse(process.argv[1]).status)" "$suite_json")
  printf "  %-25s %s (cases=%s pass=%s fail=%s known_fail=%s)\n" "$suite_name" "$suite_status" "$c" "$p" "$f" "$kf" >&2
done < <(find "$FIXTURES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name "_*" -print0 | sort -z)

# Mean score across all cases (known_fail records carry score 0.0)
mean_score=$(node -e "const [c,s]=process.argv.slice(1);console.log(c>0?Number((s/c).toFixed(4)):0)" "$total_cases" "$(node -e "
const nums=process.argv.slice(1).map(Number); console.log(nums.reduce((a,b)=>a+b,0));
" $(for r in "${SUITE_RESULTS[@]}"; do node -e "console.log(JSON.parse(process.argv[1]).mean_score*JSON.parse(process.argv[1]).cases)" "$r"; done))")

# Graph memory stats
graph_nodes=0; graph_edges=0; graph_episodes=0; graph_errors=0
[[ -f "$CONFIG_DIR/graph/nodes.jsonl" ]] && graph_nodes=$(wc -l < "$CONFIG_DIR/graph/nodes.jsonl")
[[ -f "$CONFIG_DIR/graph/edges.jsonl" ]] && graph_edges=$(wc -l < "$CONFIG_DIR/graph/edges.jsonl")
[[ -d "$CONFIG_DIR/graph/episodes" ]] && graph_episodes=$(ls "$CONFIG_DIR/graph/episodes/" 2>/dev/null | wc -l)
[[ -f "$CONFIG_DIR/graph/errors.log" ]] && graph_errors=$(wc -l < "$CONFIG_DIR/graph/errors.log")

# Skill stats
skill_count=$(ls -d "$CONFIG_DIR/skills"/*/ 2>/dev/null | wc -l)
skill_lines=0
while IFS= read -r f; do
  skill_lines=$((skill_lines + $(wc -l < "$f")))
done < <(find "$CONFIG_DIR/skills" -name "SKILL.md" -type f 2>/dev/null)

context_lines=0
[[ -f "$CONFIG_DIR/HARNESS-CONTEXT-BUDGET.md" ]] && context_lines=$(wc -l < "$CONFIG_DIR/HARNESS-CONTEXT-BUDGET.md")

phases_completed=0
phases_total=0
if [[ -f "$CONFIG_DIR/HARNESS-ROADMAP.md" ]]; then
  phases_completed=$(grep -c '| completed |' "$CONFIG_DIR/HARNESS-ROADMAP.md" || true)
  phases_total=$(grep -cE '^\| [0-9]+ \|' "$CONFIG_DIR/HARNESS-ROADMAP.md" || true)
fi

# Trials consistency (Phase 17) — latest trials artifact per suite, if any.
CONSISTENCY_FILE="$OUT_DIR/consistency.json"
node - "$METRICS_DIR" "$CONSISTENCY_FILE" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [dir, outFile] = process.argv.slice(2);
let files = [];
try {
  files = fs.readdirSync(dir).filter(f => /^trials-.*\.json$/.test(f) && !f.startsWith("trials-all-"));
} catch {}
const latest = {};
for (const f of files) {
  let j;
  try { j = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")); } catch { continue; }
  const prev = latest[j.suite];
  if (!prev || String(j.timestamp) > String(prev.timestamp)) latest[j.suite] = j;
}
const suites = Object.values(latest).map(j => ({
  suite: j.suite, tier: j.tier, trials: j.trials,
  consistency_pct: j.consistency_pct, non_deterministic_cases: j.non_deterministic_cases
}));
fs.writeFileSync(outFile, JSON.stringify({ suites }, null, 2) + "\n");
NODE
consistency_suites=$(node -e "console.log(JSON.parse(require('fs').readFileSync(process.argv[1],'utf8')).suites.length)" "$CONSISTENCY_FILE")
consistency_mean=$(node -e "const j=JSON.parse(require('fs').readFileSync(process.argv[1],'utf8'));const c=j.suites.map(s=>s.consistency_pct);console.log(c.length?Number((c.reduce((a,b)=>a+b,0)/c.length).toFixed(2)):null)" "$CONSISTENCY_FILE")

timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

if $WRITE_HISTORY; then
  node - "$METRICS_DIR/history.jsonl" "$timestamp" "$total_cases" "$total_pass" "$total_fail" "$total_known_fail" "$mean_score" "$total_duration" <<'NODE'
const fs = require("node:fs");
const [file, timestamp, cases, pass, fail, knownFail, meanScore, duration] = process.argv.slice(2);
const record = {
  timestamp,
  cases: Number(cases),
  pass: Number(pass),
  fail: Number(fail),
  known_fail: Number(knownFail),
  mean_score: Number(meanScore),
  duration_s: Number(duration)
};
fs.appendFileSync(file, JSON.stringify(record) + "\n");
NODE
fi

if $JSON_MODE; then
  node - "${SUITE_RESULTS[@]}" <<NODE
const suites = process.argv.slice(2).map(s => JSON.parse(s));
const out = {
  timestamp: "$timestamp",
  fixture_suites: suites,
  totals: {
    cases: $total_cases,
    pass: $total_pass,
    fail: $total_fail,
    known_fail: $total_known_fail,
    mean_score: $mean_score,
    duration_s: $total_duration
  },
  graph: { nodes: $graph_nodes, edges: $graph_edges, episodes: $graph_episodes, errors: $graph_errors },
  skills: { count: $skill_count, total_lines: $skill_lines },
  phases: { completed: $phases_completed, total: $phases_total },
  consistency: JSON.parse(require("fs").readFileSync("$CONSISTENCY_FILE", "utf8")).suites,
  context_budget_lines: $context_lines,
  output_dir: "$OUT_DIR"
};
console.log(JSON.stringify(out, null, 2));
NODE
else
  echo ""
  echo "=== Summary ==="
  echo "Fixture suites: ${#SUITE_RESULTS[@]}"
  echo "Total cases: $total_cases (pass: $total_pass, fail: $total_fail, known_fail: $total_known_fail)"
  echo "Mean score: $mean_score"
  echo "Total duration: ${total_duration}s"
  echo "Graph: $graph_nodes nodes, $graph_edges edges, $graph_episodes episodes, $graph_errors errors"
  echo "Skills: $skill_count ($skill_lines lines)"
  echo "Phases: $phases_completed/$phases_total completed"
  if [ "$consistency_suites" -gt 0 ]; then
    echo "Consistency: $consistency_suites suite(s) with trials data, mean ${consistency_mean}% (see metrics/trials-*.json)"
  else
    echo "Consistency: no trials data yet (run scripts/run-trials.sh)"
  fi
  echo "History: $METRICS_DIR/history.jsonl"
  echo "Output: $OUT_DIR"
fi