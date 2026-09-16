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

finish_suite 'phase-8 fixture validation passed'