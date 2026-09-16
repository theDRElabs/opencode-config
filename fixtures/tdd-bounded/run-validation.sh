#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p6-validation"
LOGS="$WORK/logs"
rm -rf "$WORK"
mkdir -p "$LOGS"

SUITE_NAME="tdd-bounded"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

copy_fixture() {
  target="$1"
  rm -rf "$target"
  cp -R "$ROOT/node-domain" "$target"
  chmod +x "$target"/run-*.sh
}

set -e
copy_fixture "$WORK/domain"
CASE_CWD="$WORK/domain"
run_case domain-red 1 ./run-red.sh
run_case domain-green 0 ./run-green.sh
run_case domain-refactor 0 ./run-refactor.sh

rm -rf "$WORK/migration"
cp -R "$ROOT/migration" "$WORK/migration"
chmod +x "$WORK/migration"/*.sh
CASE_CWD="$WORK/migration"
run_case migration-red 1 ./run-red.sh
run_case migration-green 0 ./run-green.sh
run_case migration-refactor 0 ./run-refactor.sh

rm -rf "$WORK/bug-fix"
cp -R "$ROOT/bug-fix" "$WORK/bug-fix"
chmod +x "$WORK/bug-fix"/run-*.sh
CASE_CWD="$WORK/bug-fix"
run_case bug-fix-red 1 ./run-red.sh
run_case bug-fix-green 0 ./run-green.sh
run_case bug-fix-refactor 0 ./run-refactor.sh

CASE_CWD="$ROOT/blocking-failure"
run_case blocking-failure 1 ./run.sh
CASE_CWD="$ROOT"
run_case ambiguity-rejected 0 node ./assert-rejected.js ./ambiguous-issue.md

# Backfilled from the Phase 14 incident: the SQLite CLI is absent on this host,
# so the migration fixtures depend on the node:sqlite built-in instead
# (HARNESS-METRICS.md, 2026-09-10). This case locks the dependency out again.
run_case no-sqlite3-cli 0 node -e '
const fs = require("node:fs"), path = require("node:path");
const root = process.argv[1];
const offenders = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (entry.name === "run-validation.sh") continue;
    if (!/\.(sh|js|mjs)$/.test(entry.name)) continue;
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      if (new RegExp("\\bsqlite3\\b").test(line)) offenders.push(file + ": " + line.trim());
    }
  }
}
walk(root);
if (offenders.length) { console.error("sqlite3 CLI dependency found:\n" + offenders.join("\n")); process.exit(1); }
console.log("no bare sqlite3 CLI invocation in tdd-bounded scripts");
' "$ROOT"

finish_suite 'phase-6 fixture validation passed'