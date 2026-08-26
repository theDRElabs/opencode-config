#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
WORK="/tmp/opencode/p8-validation"
LOGS="$WORK/logs"
ARTIFACTS="$WORK/artifacts"
rm -rf "$WORK"
mkdir -p "$LOGS" "$ARTIFACTS"
run_case() {
  name="$1"; expected="$2"; shift 2; log="$LOGS/$name.log"; started="$(date +%s)"
  set +e; "$@" >"$log" 2>&1; code=$?; set -e; finished="$(date +%s)"
  { printf 'command='; printf '%q ' "$@"; printf '\ncwd=%s\nenvironment=node=%s; playwright=%s; chromium=%s; os=%s/%s; command-scoped assignments are recorded in command\nduration_s=%s\nexit_code=%s\nevidence=%s\n' "$ROOT" "$(node --version)" "$(node -p "require('/root/projects/lumen/node_modules/playwright/package.json').version")" "$(env PLAYWRIGHT_EXECUTABLE_PATH= node -e "process.stdout.write(require('/root/projects/lumen/node_modules/playwright').chromium.executablePath())")" "$(uname -s)" "$(uname -m)" "$((finished-started))" "$code" "$log"; } >>"$log"
  printf '%s exit=%s expected=%s cwd=%s evidence=%s\n' "$name" "$code" "$expected" "$ROOT" "$log" | tee -a "$LOGS/results.txt"
  [ "$code" -eq "$expected" ]
}
set -e
run_case syntax 0 bash -n "$ROOT/run-validation.sh"
run_case inputs 0 node "$ROOT/assert-inputs.js" "$ROOT"
node "$ROOT/server.js" >"$LOGS/server.log" 2>&1 & SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT
run_case browser 0 env ARTIFACT_DIR="$ARTIFACTS" BASE_URL="http://127.0.0.1:4178" node "$ROOT/browser-check.js"
run_case evidence 0 node -e "const x=require('$ARTIFACTS/browser-evidence.json'); const auth=x.events.filter(e=>e.name.startsWith('authorization')); if(x.events.length!==16 || !x.events.some(e=>e.failedRequests.length) || auth.length!==8 || !auth.every(e=>e.name==='authorization-viewer-fixed'||e.name==='authorization-signed-out'||(e.serverAuthorizationStatus===undefined&&e.responsive.noHorizontalOverflow&&e.responsive.criticalControlsUsable)) || !x.events.some(e=>e.serverAuthorizationStatus===403) || !x.events.some(e=>e.serverRetrievalStatus===403&&e.serverActionStatus===403)) process.exit(1); console.log('browser evidence has 14 state/viewport cases, 8 authorization cases, server denials, responsive assertions, and a detected failed request')"
printf 'phase-8 fixture validation passed\n' | tee -a "$LOGS/results.txt"
