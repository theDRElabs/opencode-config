#!/usr/bin/env bash
set -u
ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT="/tmp/opencode/p12-validation"
LOGS="$OUT/logs"
rm -rf "$OUT"
mkdir -p "$LOGS"

SUITE_NAME="parallel-afk-runner"
CASE_LOGS="$LOGS"
CASE_RESULTS="${CASE_RESULTS:-$LOGS/case-results.jsonl}"
. "$ROOT/../_lib/run-case.sh"

set -e
run_case syntax-orchestrator 0 node --check "$ROOT/orchestrator.mjs"
run_case syntax-test 0 node --check "$ROOT/test-orchestrator.mjs"
run_case syntax-adapter 0 node --check "$ROOT/parallel-adapter.mjs"
run_case syntax-stage-adapter 0 node --check "$ROOT/sandbox-stage-adapter.mjs"
run_case syntax-full-check 0 node --check "$ROOT/full-check.mjs"
run_case syntax-record 0 node --check "$ROOT/record.mjs"
run_case syntax-shell 0 bash -n "$ROOT/run-validation.sh"

if grep -rn -E 'unshare|map-root-user|CLONE_NEW|clone\(' "$ROOT"/orchestrator.mjs "$ROOT"/parallel-adapter.mjs "$ROOT"/sandbox-stage-adapter.mjs "$ROOT"/full-check.mjs; then
  record_case namespace-free 0 1 "$LOGS/namespace-usage.log"
else
  record_case namespace-free 0 0 static-grep
fi

if grep -n -E '"(push|pull|fetch|remote)"[[:space:]]*,?[[:space:]]*\)' "$ROOT/orchestrator.mjs" \
  || grep -n -E 'git\([^)]*"(push|pull|fetch|remote)"' "$ROOT/orchestrator.mjs"; then
  record_case no-remote-mutation 0 1 "$LOGS/remote-mutation.log"
else
  ALLOWLIST_LINE="$(grep -n 'GIT_SUBCOMMAND_ALLOWLIST = new Set' "$ROOT/orchestrator.mjs" | head -1)"
  ALLOWLIST_BODY="$(printf '%s' "$ALLOWLIST_LINE" | grep -o 'new Set(\[.*\])')"
  if [ -z "$ALLOWLIST_BODY" ] || printf '%s' "$ALLOWLIST_BODY" | grep -Eq '"(push|pull|fetch|remote)"' || ! printf '%s' "$ALLOWLIST_BODY" | grep -q '"update-ref"'; then
    record_case no-remote-mutation 0 1 "$LOGS/git-allowlist.log"
  else
    record_case no-remote-mutation 0 0 static-grep+allowlist-assertion
  fi
fi

CLI_BASE="$OUT/cli"
mkdir -p "$CLI_BASE/backlog"
cat >"$CLI_BASE/backlog/ISSUE-001.md" <<'EOF'
ISSUE-001: CLI dry run issue one
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: The fixture outcome is recorded.
ACCEPTANCE:
- The observable fixture result is recorded.
LAYERS: fixture
MODULES: src/ISSUE-001
TESTS: fixture test
COMMANDS: node --check src/ISSUE-001.mjs
CONSTRAINTS: SCENARIO=success
COORDINATION: none
NON-GOALS: Human acceptance, merge approval, deploy
EOF
sed 's/ISSUE-001/ISSUE-002/g; s/src\/ISSUE-002/src\/ISSUE-002/' "$CLI_BASE/backlog/ISSUE-001.md" >"$CLI_BASE/backlog/ISSUE-002.md"
run_case cli-dry-run 0 node "$ROOT/orchestrator.mjs" --backlog "$CLI_BASE/backlog" --dry-run
DRY_JSON="$(node "$ROOT/orchestrator.mjs" --backlog "$CLI_BASE/backlog" --dry-run)"
if printf '%s' "$DRY_JSON" | grep -q '"stopReason":"dry_run"' \
  && printf '%s' "$DRY_JSON" | grep -q '"invokedAdapters":false' \
  && printf '%s' "$DRY_JSON" | grep -q '"humanApprovalRequiredFor":\["merge","push","deploy"\]' \
  && [ ! -d "$CLI_BASE/run" ]; then
  record_case cli-dry-run-plan 0 0 stdout
else
  record_case cli-dry-run-plan 0 1 stdout
fi

run_case scenarios 0 node "$ROOT/test-orchestrator.mjs" "$OUT/scenarios"

RECORDS="$OUT/records-final"
mkdir -p "$RECORDS"

finish_suite 'phase-12 deterministic validation passed'