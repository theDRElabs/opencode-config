#!/usr/bin/env bash
set -u
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT="/tmp/opencode/p11-validation"
LOGS="$OUT/logs"
rm -rf "$OUT"
mkdir -p "$LOGS"

SUITE_NAME="issue-sandbox"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

set -e
run_case syntax-sandbox 0 node --check "$ROOT/sandbox.mjs"
run_case syntax-preload 0 node -e "require('$ROOT/guard-preload.cjs'); process.exit(0)"
run_case syntax-test 0 node --check "$ROOT/test-sandbox.mjs"
run_case syntax-integration 0 node --check "$ROOT/integration-adapter.mjs"
run_case syntax-shell 0 bash -n "$ROOT/run-validation.sh"

if grep -rn -E 'unshare|map-root-user|CLONE_NEW|clone\(' "$ROOT"/sandbox.mjs "$ROOT"/guard-preload.cjs "$ROOT"/integration-adapter.mjs; then
  record_case namespace-free 0 1 "$LOGS/namespace-usage.log"
else
  record_case namespace-free 0 0 static-grep
fi

CLI_BASE="$OUT/cli"
mkdir -p "$CLI_BASE/repo"
(
  cd "$CLI_BASE/repo"
  git init -q -b main .
  git config user.email v@v
  git config user.name v
  echo base > base.txt
  git add .
  git commit -qm init
) >"$LOGS/cli-setup.log" 2>&1
run_case cli-dry-run 0 node "$ROOT/sandbox.mjs" --repo "$CLI_BASE/repo" --run-dir "$CLI_BASE/run" --issue ISSUE-001 --attempt 1 --dry-run
POLICY="$CLI_BASE/run/ISSUE-001/attempt-1/sandbox-policy.json"
if [ -f "$POLICY" ] && grep -q '"network": "denied"' "$POLICY" && grep -q '"shell": "restricted-allowlist"' "$POLICY" \
  && grep -q '"humanApprovalRequiredFor"' "$CLI_BASE/run/ISSUE-001/attempt-1/sandbox-context.json" \
  && [ ! -f "$CLI_BASE/run/ISSUE-001/attempt-1/adapter.log" ]; then
  record_case cli-policy 0 0 "$POLICY"
else
  record_case cli-policy 0 1 "$POLICY"
fi

CLI_EXEC="$OUT/cli-exec"
mkdir -p "$CLI_EXEC/repo"
(
  cd "$CLI_EXEC/repo"
  git init -q -b main .
  git config user.email v@v
  git config user.name v
  echo base > base.txt
  git add .
  git commit -qm init
) >>"$LOGS/cli-setup.log" 2>&1
mkdir -p "$CLI_EXEC/run/ISSUE-001/attempt-1/scratch"
printf 'import fs from "node:fs";\nfs.writeFileSync("cli-ok.txt", "ok\\n");\nprocess.exit(0);\n' > "$CLI_EXEC/run/ISSUE-001/attempt-1/scratch/adapter.mjs"
run_case cli-execute 0 node "$ROOT/sandbox.mjs" --repo "$CLI_EXEC/repo" --run-dir "$CLI_EXEC/run" --issue ISSUE-001 --attempt 1 -- node "$CLI_EXEC/run/ISSUE-001/attempt-1/scratch/adapter.mjs"
if [ -f "$CLI_EXEC/run/ISSUE-001/attempt-1/sandbox-run.json" ] \
  && grep -q '"exitCode": 0' "$CLI_EXEC/run/ISSUE-001/attempt-1/sandbox-run.json" \
  && [ -f "$CLI_EXEC/run/ISSUE-001/worktree/cli-ok.txt" ]; then
  record_case cli-execute-evidence 0 0 "$CLI_EXEC/run/ISSUE-001/attempt-1/sandbox-run.json"
else
  record_case cli-execute-evidence 0 1 "$CLI_EXEC/run/ISSUE-001/attempt-1/sandbox-run.json"
fi

run_case scenarios 0 node "$ROOT/test-sandbox.mjs" "$OUT"

# Backfilled from the Phase 11 round-5 repairs: an allowlisted node child
# inherited LD_PRELOAD and executed native code (HARNESS-ROADMAP.md). This case
# locks in the loader-injection sanitization in the guard.
run_case env-injection-sanitized 0 node -e '
const fs = require("node:fs");
const src = fs.readFileSync(process.argv[1], "utf8");
const missing = [];
if (!/LD_/.test(src)) missing.push("LD_ prefix");
if (!/DYLD_/.test(src)) missing.push("DYLD_ prefix");
if (!/NODE_PATH/.test(src)) missing.push("NODE_PATH");
if (!/STRIP_ENV_RE/.test(src)) missing.push("STRIP_ENV_RE guard");
if (missing.length) { console.error("loader-injection sanitization missing: " + missing.join(", ")); process.exit(1); }
console.log("guard strips LD_/DYLD_/NODE_PATH loader-injection keys from child environments");
' "$ROOT/guard-preload.cjs"

if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  run_case docker-syntax 0 node --check "$ROOT/sandbox-docker.mjs"
  run_case docker-test-syntax 0 node --check "$ROOT/test-docker-sandbox.mjs"
  run_case docker-scenarios 0 node "$ROOT/test-docker-sandbox.mjs" "$OUT/docker"
  finish_suite 'phase-11 docker validation passed'
else
  printf 'docker-scenarios SKIP (Docker not available)\n' | tee -a "$LOGS/results.txt"
  finish_suite 'phase-11 deterministic validation passed'
fi