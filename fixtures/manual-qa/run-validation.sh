#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p8-validation"
LOGS="$WORK/logs"
ARTIFACTS="$WORK/artifacts"
rm -rf "$WORK"
mkdir -p "$LOGS" "$ARTIFACTS"

SUITE_NAME="manual-qa"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
KNOWN_FAIL_CASES="browser"
. "$ROOT/../_lib/run-case.sh"

set -e
run_case syntax 0 bash -n "$ROOT/run-validation.sh"
run_case inputs 0 node "$ROOT/assert-inputs.js" "$ROOT"
node "$ROOT/server.js" >"$LOGS/server.log" 2>&1 & SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
run_case browser 0 env ARTIFACT_DIR="$ARTIFACTS" BASE_URL="http://127.0.0.1:4178" node "$ROOT/browser-check.js"
if [ "$LAST_CASE_STATUS" = "pass" ]; then
  run_case evidence 0 node -e "const x=require('$ARTIFACTS/browser-evidence.json'); const auth=x.events.filter(e=>e.name.startsWith('authorization')); if(x.events.length!==16 || !x.events.some(e=>e.failedRequests.length) || auth.length!==8 || !auth.every(e=>e.name==='authorization-viewer-fixed'||e.name==='authorization-signed-out'||(e.serverAuthorizationStatus===undefined&&e.responsive.noHorizontalOverflow&&e.responsive.criticalControlsUsable)) || !x.events.some(e=>e.serverAuthorizationStatus===403) || !x.events.some(e=>e.serverRetrievalStatus===403&&e.serverActionStatus===403)) process.exit(1); console.log('browser evidence has 14 state/viewport cases, 8 authorization cases, server denials, responsive assertions, and a detected failed request')"
else
  record_known_fail evidence "$ARTIFACTS/browser-evidence.json" "evidence case skipped: browser case did not pass (known environmental failure)"
fi

# Backfilled from the Phase 14 incident: a stale hardcoded project path broke
# the browser fixture (HARNESS-METRICS.md, 2026-09-10). Every absolute host
# path referenced by the fixture must resolve on this machine.
run_case no-stale-absolute-paths 0 node -e '
const fs = require("node:fs"), path = require("node:path");
const root = process.argv[1];
const stale = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(file); continue; }
    if (!/\.(js|mjs|sh|html)$/.test(entry.name)) continue;
    const text = fs.readFileSync(file, "utf8");
    for (const match of text.matchAll(/\/home\/DRE\/[A-Za-z0-9._\/-]*/g)) {
      const p = match[0].replace(/[.,;:)]+$/, "");
      if (!fs.existsSync(p)) stale.push(file + ": " + match[0]);
    }
  }
}
walk(root);
if (stale.length) { console.error("stale absolute paths (target missing):\n" + stale.join("\n")); process.exit(1); }
console.log("all /home/ubuntu absolute paths in manual-qa resolve on this machine");
' "$ROOT"

finish_suite 'phase-8 fixture validation passed'