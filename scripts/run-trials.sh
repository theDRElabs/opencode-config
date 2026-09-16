#!/usr/bin/env bash
set -euo pipefail

# Harness Trials Runner (Phase 17)
# Runs one suite (or every suite) N times, collects each trial's per-case JSONL,
# and builds a case x trial consistency matrix. Writes a trials artifact to
# metrics/trials-<suite>-<ts>.json (and metrics/trials-all-<ts>.json for --all).
#
# Interpretation tiers:
#   deterministic   — the 8 current fixture suites; 100% agreement is expected.
#                     Any variance is an environmental flake, not agent variance.
#   model-dependent — Phase 19+ calibration and real AFK runs; agreement % is a
#                     first-class metric (same task, same conditions, N runs).
#
# Usage:
#   bash scripts/run-trials.sh --suite tdd-bounded --n 5
#   bash scripts/run-trials.sh --all --n 3

CONFIG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FIXTURES_DIR="$CONFIG_DIR/fixtures"
METRICS_DIR="$CONFIG_DIR/metrics"
mkdir -p "$METRICS_DIR"

N=3
SUITE=""
ALL=false
while [ $# -gt 0 ]; do
  case "$1" in
    --suite) SUITE="${2:-}"; shift 2 ;;
    --all) ALL=true; shift ;;
    --n) N="${2:-3}"; shift 2 ;;
    -h|--help)
      echo "Usage: bash scripts/run-trials.sh --suite <name> --n <count>"
      echo "       bash scripts/run-trials.sh --all --n <count>"
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if ! [[ "$N" =~ ^[0-9]+$ ]] || [ "$N" -lt 1 ]; then
  echo "--n must be a positive integer" >&2
  exit 2
fi

if [ -z "$SUITE" ] && ! $ALL; then
  echo "specify --suite <name> or --all" >&2
  exit 2
fi

TS="$(date -u +%Y%m%d-%H%M%S)"
WORK="/tmp/opencode/trials-$TS"
mkdir -p "$WORK"

tier_for() {
  case "$1" in
    architecture-audit|fresh-review|issue-sandbox|manual-qa|parallel-afk-runner|project-feedback|sequential-afk-runner|tdd-bounded)
      echo "deterministic" ;;
    *) echo "model-dependent" ;;
  esac
}

suites=()
if $ALL; then
  while IFS= read -r -d '' d; do
    suites+=("$(basename "$d")")
  done < <(find "$FIXTURES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name "_*" -print0 | sort -z)
else
  if [ ! -d "$FIXTURES_DIR/$SUITE" ]; then
    echo "unknown suite: $SUITE" >&2
    exit 2
  fi
  suites=("$SUITE")
fi

echo "=== Harness Trials ===" >&2
echo "Suites: ${suites[*]}" >&2
echo "Trials per suite: $N" >&2
echo "Output: $METRICS_DIR" >&2
echo "" >&2

run_suite_trials() {
  local suite="$1"
  local suite_dir="$FIXTURES_DIR/$suite"
  local script="$suite_dir/run-validation.sh"
  local tier
  tier="$(tier_for "$suite")"
  local out_json="$METRICS_DIR/trials-$suite-$TS.json"

  if [ ! -f "$script" ]; then
    echo "  $suite: missing run-validation.sh (skipped)" >&2
    return 0
  fi

  local jsonls=()
  local i
  for i in $(seq 1 "$N"); do
    local jd="$WORK/$suite/trial-$i"
    mkdir -p "$jd"
    local jsonl="$jd/case-results.jsonl"
    : >"$jsonl"
    set +e
    CASE_RESULTS="$jsonl" bash "$script" >"$jd/run.log" 2>&1
    set -e
    jsonls+=("$jsonl")
  done

  node - "$suite" "$tier" "$N" "$TS" "$out_json" "${jsonls[@]}" <<'NODE'
const fs = require("node:fs");
const [suite, tier, nStr, ts, outJson, ...files] = process.argv.slice(2);
const n = Number(nStr);
const trials = files.map((f, idx) => {
  let cases = [];
  try {
    cases = fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);
  } catch {}
  return { trial: idx + 1, file: f, cases };
});
const names = [...new Set(trials.flatMap(t => t.cases.map(c => c.case)))];
const caseMatrix = {};
const nonDeterministic = [];
for (const name of names) {
  const verdicts = trials.map(t => {
    const c = t.cases.find(x => x.case === name);
    return c ? c.status : "absent";
  });
  const counts = {};
  for (const v of verdicts) counts[v] = (counts[v] || 0) + 1;
  const agreement = Math.max(...Object.values(counts)) / verdicts.length;
  caseMatrix[name] = { verdicts, agreement: Number(agreement.toFixed(4)) };
  if (agreement < 1) nonDeterministic.push(name);
}
const perTrial = trials.map(t => {
  const pass = t.cases.filter(c => c.status === "pass").length;
  const fail = t.cases.filter(c => c.status === "fail").length;
  const known = t.cases.filter(c => c.status === "known_fail").length;
  const mean = t.cases.length
    ? t.cases.reduce((a, c) => a + (Number(c.score) || 0), 0) / t.cases.length
    : 0;
  return { trial: t.trial, cases: t.cases.length, pass, fail, known_fail: known, mean_score: Number(mean.toFixed(4)) };
});
const consistency = names.length
  ? Number((names.reduce((a, name) => a + caseMatrix[name].agreement, 0) / names.length * 100).toFixed(2))
  : 100;
const out = {
  suite,
  tier,
  trials: n,
  timestamp: ts,
  case_count: names.length,
  consistency_pct: consistency,
  non_deterministic_cases: nonDeterministic,
  cases: caseMatrix,
  per_trial: perTrial
};
fs.writeFileSync(outJson, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({
  suite, tier, trials: n, case_count: names.length,
  consistency_pct: consistency, non_deterministic_cases: nonDeterministic
}));
NODE
}

for suite in "${suites[@]}"; do
  echo "--- $suite ---" >&2
  run_suite_trials "$suite" >&2
done

if $ALL; then
  AGG_JSON="$METRICS_DIR/trials-all-$TS.json"
  node - "$METRICS_DIR" "$TS" "$N" "$AGG_JSON" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [metricsDir, ts, nStr, aggJson] = process.argv.slice(2);
const n = Number(nStr);
const files = fs.readdirSync(metricsDir)
  .filter(f => /^trials-.*-\d{8}-\d{6}\.json$/.test(f))
  .filter(f => f.endsWith(`-${ts}.json`))
  .filter(f => !f.startsWith("trials-all-"))
  .sort();
const suites = files.map(f => {
  const j = JSON.parse(fs.readFileSync(path.join(metricsDir, f), "utf8"));
  return {
    suite: j.suite,
    tier: j.tier,
    trials: j.trials,
    case_count: j.case_count,
    consistency_pct: j.consistency_pct,
    non_deterministic_cases: j.non_deterministic_cases
  };
});
const consistencies = suites.map(s => s.consistency_pct);
const mean = consistencies.length
  ? Number((consistencies.reduce((a, b) => a + b, 0) / consistencies.length).toFixed(2))
  : 100;
const min = consistencies.length ? Math.min(...consistencies) : 100;
const out = {
  timestamp: ts,
  trials: n,
  suite_count: suites.length,
  mean_consistency_pct: mean,
  min_consistency_pct: min,
  suites
};
fs.writeFileSync(aggJson, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({
  timestamp: ts, trials: n, suite_count: suites.length,
  mean_consistency_pct: mean, min_consistency_pct: min
}));
NODE
  echo "" >&2
  echo "Aggregate: $AGG_JSON" >&2
fi