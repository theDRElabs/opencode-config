#!/usr/bin/env bash
set -euo pipefail

# Token and Cost Accounting (Phase 18)
# Rollups from the opencode `session` table via node:sqlite (the sqlite3 CLI is
# NOT installed on this host). Emits per-agent, per-directory, per-day, and
# top-N session rollups, split into two named layers:
#   - harness-development spend  (sessions whose directory is the harness config)
#   - project-execution spend    (sessions in project / working directories)
#
# Usage: bash scripts/token-report.sh [--json] [--top N]

CONFIG_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DB="${OPENCODE_DB:-$HOME/.local/share/opencode/opencode.db}"

JSON_MODE=false
TOP=10
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON_MODE=true; shift ;;
    --top) TOP="${2:-10}"; shift 2 ;;
    -h|--help)
      echo "Usage: bash scripts/token-report.sh [--json] [--top N]"
      exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [ ! -f "$DB" ]; then
  echo "token-report: database not found: $DB" >&2
  exit 2
fi

REPORT_JSON="$(mktemp)"
trap 'rm -f "$REPORT_JSON"' EXIT

node - "$DB" "$TOP" "$CONFIG_DIR" "$REPORT_JSON" <<'NODE'
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const [dbPath, topStr, configDir, outFile] = process.argv.slice(2);
const topN = Math.max(1, Number(topStr) || 10);

function toMs(t) {
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n > 1e12 ? n : n * 1000;
}

function sumLayer(rows) {
  const acc = {
    sessions: rows.length,
    tokens_input: 0,
    tokens_output: 0,
    tokens_reasoning: 0,
    tokens_cache_read: 0,
    tokens_cache_write: 0,
    cost: 0,
  };
  for (const r of rows) {
    acc.tokens_input += Number(r.tokens_input) || 0;
    acc.tokens_output += Number(r.tokens_output) || 0;
    acc.tokens_reasoning += Number(r.tokens_reasoning) || 0;
    acc.tokens_cache_read += Number(r.tokens_cache_read) || 0;
    acc.tokens_cache_write += Number(r.tokens_cache_write) || 0;
    acc.cost += Number(r.cost) || 0;
  }
  acc.cost = Number(acc.cost.toFixed(6));
  acc.total_tokens = acc.tokens_input + acc.tokens_output + acc.tokens_reasoning;
  return acc;
}

function groupBy(rows, keyFn, sortFn) {
  const map = new Map();
  for (const r of rows) {
    const k = keyFn(r);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(r);
  }
  return [...map.entries()].map(([k, rs]) => ({ key: k, ...sumLayer(rs) })).sort(sortFn);
}

const db = new DatabaseSync(dbPath, { readOnly: true });
const sessions = db.prepare(
  "SELECT id, directory, agent, model, title, cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read, tokens_cache_write, time_created, time_updated FROM session"
).all();
db.close();

const isHarness = (r) => typeof r.directory === "string" && r.directory.startsWith(configDir);
const harnessRows = sessions.filter(isHarness);
const projectRows = sessions.filter((r) => !isHarness(r));

const byTokens = (a, b) => (b.tokens_input + b.tokens_output) - (a.tokens_input + a.tokens_output);

const report = {
  generated_at: new Date().toISOString(),
  database: dbPath,
  layers: {
    harness_development: { directory: configDir, ...sumLayer(harnessRows) },
    project_execution: { note: "all sessions outside the harness config directory", ...sumLayer(projectRows) },
  },
  totals: sumLayer(sessions),
  by_agent: groupBy(sessions, (r) => r.agent || "(none)", byTokens).map(({ key, ...rest }) => ({ agent: key, ...rest })),
  by_directory: groupBy(sessions, (r) => r.directory || "(unknown)", byTokens).map(({ key, ...rest }) => ({ directory: key, ...rest })),
  by_day: groupBy(
    sessions.filter((r) => toMs(r.time_created)),
    (r) => new Date(toMs(r.time_created)).toISOString().slice(0, 10),
    (a, b) => (a.key < b.key ? 1 : -1)
  ).map(({ key, ...rest }) => ({ day: key, ...rest })),
  top_sessions: [...sessions]
    .sort((a, b) => (b.tokens_input + b.tokens_output) - (a.tokens_input + a.tokens_output))
    .slice(0, topN)
    .map((r) => ({
      id: r.id,
      directory: r.directory,
      agent: r.agent || null,
      model: r.model || null,
      title: r.title || null,
      cost: Number(r.cost) || 0,
      tokens_input: Number(r.tokens_input) || 0,
      tokens_output: Number(r.tokens_output) || 0,
      tokens_reasoning: Number(r.tokens_reasoning) || 0,
      time_created: toMs(r.time_created) ? new Date(toMs(r.time_created)).toISOString() : null,
    })),
  warnings: [],
};

if (report.layers.harness_development.sessions === 0) {
  report.warnings.push(
    `no sessions recorded with directory under ${configDir}; harness-development spend layer is empty`
  );
}
if (report.totals.sessions === 0) {
  report.warnings.push("session table is empty; no token data to report");
}

fs.writeFileSync(outFile, JSON.stringify(report, null, 2) + "\n");
NODE

human() {
  node - "$REPORT_JSON" <<'NODE'
const fs = require("node:fs");
const j = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const n = (v) => Number(v || 0).toLocaleString("en-US");

function row(label, v) {
  return `  ${label.padEnd(22)} ${String(v).padStart(16)}`;
}

console.log("=== Token & Cost Report ===");
console.log(`Database: ${j.database}`);
console.log(`Generated: ${j.generated_at}`);
console.log("");
console.log("Totals (all sessions)");
console.log(row("sessions", n(j.totals.sessions)));
console.log(row("tokens_input", n(j.totals.tokens_input)));
console.log(row("tokens_output", n(j.totals.tokens_output)));
console.log(row("tokens_reasoning", n(j.totals.tokens_reasoning)));
console.log(row("tokens_cache_read", n(j.totals.tokens_cache_read)));
console.log(row("tokens_cache_write", n(j.totals.tokens_cache_write)));
console.log(row("cost", "$" + Number(j.totals.cost).toFixed(6)));
console.log("");
console.log("Layers");
for (const [name, layer] of Object.entries(j.layers)) {
  console.log(`  ${name}: sessions=${n(layer.sessions)} input=${n(layer.tokens_input)} output=${n(layer.tokens_output)} cost=$${Number(layer.cost).toFixed(6)}`);
}
console.log("");
console.log("By agent");
for (const a of j.by_agent) console.log(`  ${String(a.agent).padEnd(24)} sessions=${String(a.sessions).padStart(4)} input=${n(a.tokens_input).padStart(12)} output=${n(a.tokens_output).padStart(10)} cost=$${Number(a.cost).toFixed(6)}`);
console.log("");
console.log("By directory");
for (const d of j.by_directory) console.log(`  ${String(d.directory).padEnd(48)} sessions=${String(d.sessions).padStart(4)} input=${n(d.tokens_input).padStart(12)} cost=$${Number(d.cost).toFixed(6)}`);
console.log("");
console.log("By day");
for (const d of j.by_day) console.log(`  ${d.day}  sessions=${String(d.sessions).padStart(4)} input=${n(d.tokens_input).padStart(12)} output=${n(d.tokens_output).padStart(10)} cost=$${Number(d.cost).toFixed(6)}`);
console.log("");
console.log(`Top ${j.top_sessions.length} sessions by tokens_input+tokens_output`);
for (const s of j.top_sessions) {
  console.log(`  ${String(s.id).padEnd(30)} ${String(s.directory).padEnd(40)} input=${n(s.tokens_input).padStart(12)} output=${n(s.tokens_output).padStart(9)} cost=$${Number(s.cost).toFixed(6)}`);
}
if (j.warnings.length) {
  console.log("");
  console.log("Warnings");
  for (const w of j.warnings) console.log(`  - ${w}`);
}
NODE
}

if $JSON_MODE; then
  cat "$REPORT_JSON"
else
  human
fi