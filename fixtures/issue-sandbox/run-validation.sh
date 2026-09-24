#!/usr/bin/env bash
set -u
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT="/tmp/opencode/p11-validation"
LOGS="$OUT/logs"
rm -rf "$OUT"
mkdir -p "$LOGS"

run_case() {
  name="$1" expected="$2"
  shift 2
  start="$(date +%s)"
  "$@" >"$LOGS/$name.log" 2>&1
  code=$?
  duration="$(( $(date +%s) - start ))"
  printf '%s exit=%s expected=%s cwd=%s duration_s=%s evidence=%s\n' "$name" "$code" "$expected" "$ROOT" "$duration" "$LOGS/$name.log" | tee -a "$LOGS/results.txt"
  [ "$code" -eq "$expected" ] || exit 1
}

run_case syntax-sandbox 0 node --check "$ROOT/sandbox.mjs"
run_case syntax-preload 0 node -e "require('$ROOT/guard-preload.cjs'); process.exit(0)"
run_case syntax-test 0 node --check "$ROOT/test-sandbox.mjs"
run_case syntax-integration 0 node --check "$ROOT/integration-adapter.mjs"
run_case syntax-shell 0 bash -n "$ROOT/run-validation.sh"

# Namespace discipline: the sandbox must not use unshare, mount namespaces,
# or any namespace syscall wrapper. Isolation is process-level by design.
if grep -rn -E 'unshare|map-root-user|CLONE_NEW|clone\(' "$ROOT"/sandbox.mjs "$ROOT"/guard-preload.cjs "$ROOT"/integration-adapter.mjs; then
  printf 'namespace-usage exit=1 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$LOGS/namespace-usage.log" | tee -a "$LOGS/results.txt"
  exit 1
fi
printf 'namespace-free exit=0 expected=0 cwd=%s evidence=static-grep\n' "$ROOT" | tee -a "$LOGS/results.txt"

# CLI dry run on a scratch repository: setup happens, adapter is not invoked,
# and the policy manifest records explicit network and shell permissions.
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
  printf 'cli-policy exit=0 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$POLICY" | tee -a "$LOGS/results.txt"
else
  printf 'cli-policy exit=1 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$POLICY" | tee -a "$LOGS/results.txt"
  exit 1
fi

# CLI execution: the CLI must accept an adapter command after -- and run it
# inside the sandbox with evidence capture.
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
  printf 'cli-execute-evidence exit=0 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$CLI_EXEC/run/ISSUE-001/attempt-1/sandbox-run.json" | tee -a "$LOGS/results.txt"
else
  printf 'cli-execute-evidence exit=1 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$CLI_EXEC/run/ISSUE-001/attempt-1/sandbox-run.json" | tee -a "$LOGS/results.txt"
  exit 1
fi

run_case scenarios 0 node "$ROOT/test-sandbox.mjs" "$OUT"

# Docker sandbox tests (if Docker is available)
if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
  run_case docker-syntax 0 node --check "$ROOT/sandbox-docker.mjs"
  run_case docker-test-syntax 0 node --check "$ROOT/test-docker-sandbox.mjs"
  run_case docker-scenarios 0 node "$ROOT/test-docker-sandbox.mjs" "$OUT/docker"
  printf 'phase-11 docker validation passed\n' | tee -a "$LOGS/results.txt"
else
  printf 'docker-scenarios SKIP (Docker not available)\n' | tee -a "$LOGS/results.txt"
fi

printf 'phase-11 deterministic validation passed\n' | tee -a "$LOGS/results.txt"
