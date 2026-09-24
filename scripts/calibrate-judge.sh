#!/usr/bin/env bash
set -euo pipefail

# Harness LLM-Judge Calibration (Phase 19)
# Runs the fresh-context judge (fresh-reviewer subagent; producer != verifier)
# over fixtures/fresh-review/calibration/, scores its verdict + findings against
# each case's expected-findings.json (recall, precision, unknown-rate), and
# writes metrics/judge-calibration-<ts>.json with a per-case disagreement list.
#
# This script MEASURES the judge. It must not tune it in the same run.
#
# Usage:
#   bash scripts/calibrate-judge.sh                 # all cases
#   bash scripts/calibrate-judge.sh --case <name>   # one case
#   bash scripts/calibrate-judge.sh --model <id>    # override judge model
#
# Env:
#   JUDGE_MODEL   model id (default xkiro/deepseek/deepseek-v4-flash)
#   JUDGE_AGENT   agent to run (default: none). fresh-reviewer is declared
#                 `mode: subagent`, and `opencode run --agent <subagent>`
#                 silently falls back to the default agent, so the judge
#                 protocol lives in the prompt instead of the agent file.
#   JUDGE_TIMEOUT per-case timeout in seconds (default 300)

CONFIG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
CORPUS="$CONFIG_DIR/fixtures/fresh-review/calibration"
METRICS_DIR="$CONFIG_DIR/metrics"
SKILL_VERSION="fresh-context-review@2026-09-16"
mkdir -p "$METRICS_DIR"

JUDGE_MODEL="${JUDGE_MODEL:-xkiro/deepseek/deepseek-v4-flash}"
JUDGE_AGENT="${JUDGE_AGENT:-}"
JUDGE_TIMEOUT="${JUDGE_TIMEOUT:-300}"
ONLY_CASE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --case) ONLY_CASE="${2:-}"; shift 2 ;;
    --model) JUDGE_MODEL="${2:-}"; shift 2 ;;
    --agent) JUDGE_AGENT="${2:-}"; shift 2 ;;
    --timeout) JUDGE_TIMEOUT="${2:-}"; shift 2 ;;
    -h|--help) sed -n '3,20p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ ! -d "$CORPUS" ]; then
  echo "calibration corpus missing: $CORPUS" >&2
  exit 2
fi

TS="$(date -u +%Y%m%d-%H%M%S)"
WORK="/tmp/opencode/judge-cal-$TS"
mkdir -p "$WORK"
OUT_JSON="$METRICS_DIR/judge-calibration-$TS.json"
CASE_JSONL="$WORK/case-verdicts.jsonl"
: >"$CASE_JSONL"

echo "=== Judge Calibration ===" >&2
echo "Model: $JUDGE_MODEL  Agent: $JUDGE_AGENT  Skill: $SKILL_VERSION" >&2
echo "Corpus: $CORPUS" >&2
echo "Work: $WORK" >&2
echo "Artifact: $OUT_JSON" >&2
echo "" >&2

cases=()
while IFS= read -r -d '' d; do
  name="$(basename "$d")"
  [ -n "$ONLY_CASE" ] && [ "$name" != "$ONLY_CASE" ] && continue
  [ -f "$d/expected-findings.json" ] || { echo "skip $name (no expected-findings.json)" >&2; continue; }
  cases+=("$name")
done < <(find "$CORPUS" -mindepth 1 -maxdepth 1 -type d -print0 | sort -z)

if [ "${#cases[@]}" -eq 0 ]; then
  echo "no calibration cases found" >&2
  exit 2
fi

build_prompt() {
  local dir="$1"
  local srcs
  srcs="$(find "$dir" -type f \
    ! -name 'issue.md' ! -name 'standards.md' ! -name 'diff.patch' \
    ! -name 'verification.log' ! -name 'expected-findings.json' \
    ! -path '*/verification/*' | sort | sed "s|$dir/|  $dir/|")"
  cat <<EOF
You are a fresh-context review judge being calibrated. Review exactly one
implementation from the artifact bundle below. Read ONLY the listed files.

Issue:
  $dir/issue.md
Standards:
  $dir/standards.md
Diff:
  $dir/diff.patch
Verification evidence:
$(if [ -d "$dir/verification" ]; then find "$dir/verification" -type f | sort | sed 's/^/  /'; else echo "  $dir/verification.log"; fi)
Post-change sources (read these — the diff alone is not enough to judge
whether a finding is real):
$srcs

Judge one dimension only: correctness/completeness of the implementation
against the issue's acceptance criteria. Do not grade style.

Rules:
- PASS when no unresolved blocking finding exists.
- FAIL when at least one blocking (critical/high) finding exists.
- BLOCKED when a required input is absent.
- UNKNOWN when the supplied evidence is insufficient to decide. Never
  fabricate a verdict.

For every finding, cite the changed source file and the line in that file, as
a path relative to the case root (for example \`src/order.js\`). Do not cite
\`diff.patch\`. A finding with no source file and line is not a finding.

After the review, output EXACTLY ONE fenced json block as the final content,
with nothing after it:
EOF
}

extract_json() {
  node -e '
    const fs = require("node:fs");
    const raw = fs.readFileSync(process.argv[1], "utf8").replace(/\u001b\[[0-9;]*m/g, "");
    let parsed = null;
    const fences = [...raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/g)].map(m => m[1]);
    for (let i = fences.length - 1; i >= 0 && !parsed; i--) {
      try { parsed = JSON.parse(fences[i].trim()); } catch {}
    }
    if (!parsed) {
      const starts = [...raw.matchAll(/\{/g)].map(m => m.index);
      for (let i = starts.length - 1; i >= 0 && !parsed; i--) {
        for (let j = raw.length; j > starts[i] && !parsed; j--) {
          if (raw[j] !== "}") continue;
          try { parsed = JSON.parse(raw.slice(starts[i], j + 1)); } catch {}
        }
      }
    }
    if (!parsed) process.exit(3);
    process.stdout.write(JSON.stringify(parsed));
  ' "$1" 2>/dev/null
}

for name in "${cases[@]}"; do
  dir="$CORPUS/$name"
  prompt_file="$WORK/$name.prompt.txt"
  raw_out="$WORK/$name.out.txt"
  parsed="$WORK/$name.json"

  build_prompt "$dir" >"$prompt_file"
  echo "--- $name ---" >&2
  started="$(date +%s)"
  judge_args=(run --model "$JUDGE_MODEL")
  [ -n "$JUDGE_AGENT" ] && judge_args+=(--agent "$JUDGE_AGENT")
  set +e
  timeout "$JUDGE_TIMEOUT" opencode "${judge_args[@]}" \
    "$(cat "$prompt_file")" >"$raw_out" 2>&1
  rc=$?
  set -e
  finished="$(date +%s)"
  duration=$((finished - started))

  if [ "$rc" -ne 0 ]; then
    printf '{"case":"%s","verdict":"UNKNOWN","findings":[],"raw_rc":%s,"duration_s":%s,"parse_error":"judge run failed (rc=%s)"}\n' \
      "$name" "$rc" "$duration" "$rc" >>"$CASE_JSONL"
    echo "  run failed rc=$rc (${duration}s)" >&2
    continue
  fi

  if extract_json "$raw_out" >"$parsed" 2>/dev/null; then
    node - "$name" "$parsed" "$duration" "$raw_out" "$SKILL_VERSION" >>"$CASE_JSONL" <<'NODE'
const fs = require("node:fs");
const [name, parsedFile, duration, rawOut, skillVersion] = process.argv.slice(2);
const j = JSON.parse(fs.readFileSync(parsedFile, "utf8"));
const verdict = String(j.verdict || "UNKNOWN").toUpperCase();
const findings = Array.isArray(j.findings) ? j.findings.map(f => ({
  path: String(f.path || f.file || ""),
  line: Number(f.line) || 0,
  kind: String(f.kind || "").toLowerCase()
})) : [];
console.log(JSON.stringify({
  case: name,
  verdict,
  findings,
  judge_version: j.judge_version || skillVersion,
  duration_s: Number(duration),
  raw_out: rawOut,
  parse_error: null
}));
NODE
    echo "  verdict parsed (${duration}s)" >&2
  else
    printf '{"case":"%s","verdict":"UNKNOWN","findings":[],"duration_s":%s,"raw_out":"%s","parse_error":"no parsable json verdict in judge output"}\n' \
      "$name" "$duration" "$raw_out" >>"$CASE_JSONL"
    echo "  no parsable verdict (${duration}s)" >&2
  fi
done

node - "$CORPUS" "$CASE_JSONL" "$OUT_JSON" "$JUDGE_MODEL" "${JUDGE_AGENT:-default}" "$SKILL_VERSION" "$TS" <<'NODE'
const fs = require("node:fs");
const path = require("node:path");
const [corpus, caseJsonl, outJson, model, agent, skillVersion, ts] = process.argv.slice(2);

const results = fs.readFileSync(caseJsonl, "utf8").split("\n").filter(Boolean).map(l => {
  try { return JSON.parse(l); } catch { return null; }
}).filter(Boolean);

const norm = (v) => String(v || "").toUpperCase();
const fileOf = (f) => String(f.path || f.file || "").replace(/^\.\//, "");
const lineOf = (f) => Number(f.line) || 0;
const label = (f) => `${fileOf(f)}:${lineOf(f) || "?"}${f.kind ? ":" + String(f.kind).toLowerCase() : ""}`;
const sameSpot = (a, b) => {
  if (fileOf(a) !== fileOf(b)) return false;
  const al = lineOf(a), bl = lineOf(b);
  if (!al || !bl) return true;
  return Math.abs(al - bl) <= 2;
};

const perCase = [];
const disagreements = [];
let sumRecall = 0, sumPrecision = 0;
let recalledCases = 0, unknownCases = 0, ambiguousCases = 0, ambiguousUnknown = 0;

for (const r of results) {
  const expFile = path.join(corpus, r.case, "expected-findings.json");
  let exp = { verdict: "PASS", findings: [] };
  try { exp = JSON.parse(fs.readFileSync(expFile, "utf8")); } catch {}
  const expectedVerdict = norm(exp.verdict);
  const expectedFindings = Array.isArray(exp.findings) ? exp.findings : [];
  const detected = Array.isArray(r.findings) ? r.findings : [];

  const matchedExp = new Set();
  const matchedDet = new Set();
  expectedFindings.forEach((e, ei) => {
    const di = detected.findIndex((d, i) => !matchedDet.has(i) && sameSpot(e, d));
    if (di >= 0) { matchedExp.add(ei); matchedDet.add(di); }
  });
  const matched = expectedFindings.filter((e, i) => matchedExp.has(i));
  const missing = expectedFindings.filter((e, i) => !matchedExp.has(i));
  const spurious = detected.filter((d, i) => !matchedDet.has(i));

  const recall = expectedFindings.length ? matched.length / expectedFindings.length : 1;
  const precision = detected.length ? matched.length / detected.length : 1;
  const verdictMatch = norm(r.verdict) === expectedVerdict;

  if (expectedFindings.length > 0) { sumRecall += recall; sumPrecision += precision; recalledCases++; }
  if (expectedVerdict === "UNKNOWN") {
    ambiguousCases++;
    if (norm(r.verdict) === "UNKNOWN") ambiguousUnknown++;
  }
  if (norm(r.verdict) === "UNKNOWN") unknownCases++;

  perCase.push({
    case: r.case,
    expected_verdict: expectedVerdict,
    actual_verdict: norm(r.verdict),
    verdict_match: verdictMatch,
    control: exp.control || null,
    expected_findings: expectedFindings.length,
    findings_scored: expectedFindings.length > 0,
    detected_findings: detected.length,
    recall: Number(recall.toFixed(4)),
    precision: Number(precision.toFixed(4)),
    matched: matched.length,
    missing: missing.map(label),
    spurious: spurious.map(label),
    judge_version: r.judge_version || skillVersion,
    duration_s: r.duration_s || 0,
    raw_out: r.raw_out || null,
    parse_error: r.parse_error || null,
    hypothesis: r.parse_error
      ? "judge output did not contain a parsable json verdict"
      : (verdictMatch ? null : `expected ${expectedVerdict}, judge returned ${norm(r.verdict)}${missing.length ? "; missed " + missing.length + " expected finding(s)" : ""}${spurious.length ? "; " + spurious.length + " spurious finding(s)" : ""}`)
  });

  const findingsScored = expectedFindings.length > 0;
  if (!verdictMatch || r.parse_error || (findingsScored && (missing.length || spurious.length))) {
    disagreements.push({
      case: r.case,
      expected: expectedVerdict,
      actual: norm(r.verdict),
      expected_findings: expectedFindings.length,
      detected_findings: detected.length,
      missing: missing.map(label),
      spurious: spurious.map(label),
      hypothesis: r.parse_error
        ? "judge output did not contain a parsable json verdict"
        : "verdict and/or finding set differs from the expected-findings.json ground truth"
    });
  }
}

const verdictCounts = perCase.reduce((a, c) => { a[c.actual_verdict] = (a[c.actual_verdict] || 0) + 1; return a; }, {});
const aggregate = {
  cases: perCase.length,
  verdict_match_rate: perCase.length ? Number((perCase.filter(c => c.verdict_match).length / perCase.length).toFixed(4)) : 0,
  mean_recall: recalledCases ? Number((sumRecall / recalledCases).toFixed(4)) : null,
  mean_precision: recalledCases ? Number((sumPrecision / recalledCases).toFixed(4)) : null,
  unknown_rate: perCase.length ? Number((unknownCases / perCase.length).toFixed(4)) : 0,
  ambiguous_unknown_rate: ambiguousCases ? Number((ambiguousUnknown / ambiguousCases).toFixed(4)) : null,
  verdict_counts: verdictCounts
};

const out = {
  phase: 19,
  kind: "judge-calibration",
  timestamp: ts,
  judge: { model, agent, skill_version: skillVersion },
  corpus: { dir: corpus, cases: perCase.length },
  aggregate,
  per_case: perCase,
  disagreements
};
fs.writeFileSync(outJson, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify({ timestamp: ts, ...aggregate, disagreements: disagreements.length }));
NODE

echo "" >&2
echo "Artifact: $OUT_JSON" >&2
echo "Per-case raw outputs: $WORK" >&2