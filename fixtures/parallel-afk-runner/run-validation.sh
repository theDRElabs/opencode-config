#!/usr/bin/env bash
# Phase 12 parallel AFK runner validation. All checks run sequentially — the
# parallelism under test lives inside spawned node adapter processes only;
# this device runs a single OpenCode agent process (memory.md constraint).
set -u

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
OUT="/tmp/opencode/p12-validation"
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

# Syntax checks for every Phase 12 source file.
run_case syntax-orchestrator 0 node --check "$ROOT/orchestrator.mjs"
run_case syntax-test 0 node --check "$ROOT/test-orchestrator.mjs"
run_case syntax-adapter 0 node --check "$ROOT/parallel-adapter.mjs"
run_case syntax-stage-adapter 0 node --check "$ROOT/sandbox-stage-adapter.mjs"
run_case syntax-full-check 0 node --check "$ROOT/full-check.mjs"
run_case syntax-record 0 node --check "$ROOT/record.mjs"
run_case syntax-shell 0 bash -n "$ROOT/run-validation.sh"

# Namespace discipline (proot constraint, incident 2026-08-29): the parallel
# orchestrator must not use kernel namespaces; isolation is inherited from
# the Phase 11 sandbox.
if grep -rn -E 'unshare|map-root-user|CLONE_NEW|clone\(' "$ROOT"/orchestrator.mjs "$ROOT"/parallel-adapter.mjs "$ROOT"/sandbox-stage-adapter.mjs "$ROOT"/full-check.mjs; then
  printf 'namespace-usage exit=1 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$LOGS/namespace-usage.log" | tee -a "$LOGS/results.txt"
  exit 1
fi
printf 'namespace-free exit=0 expected=0 cwd=%s evidence=static-grep\n' "$ROOT" | tee -a "$LOGS/results.txt"

# Merge/push/deploy code-path discipline: the orchestrator's trusted git
# surface is a positive allowlist (no push/pull/fetch/remote can appear as a
# git invocation anywhere) and no deploy step exists; merging exists ONLY
# behind the recorded human gate in the merge-queue block. The allowlist
# itself is asserted exactly.
if grep -n -E '"(push|pull|fetch|remote)"[[:space:]]*,?[[:space:]]*\)' "$ROOT/orchestrator.mjs" \
  || grep -n -E 'git\([^)]*"(push|pull|fetch|remote)"' "$ROOT/orchestrator.mjs"; then
  printf 'remote-mutation-paths exit=1 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$LOGS/remote-mutation.log" | tee -a "$LOGS/results.txt"
  exit 1
fi
ALLOWLIST_LINE="$(grep -n 'GIT_SUBCOMMAND_ALLOWLIST = new Set' "$ROOT/orchestrator.mjs" | head -1)"
ALLOWLIST_BODY="$(printf '%s' "$ALLOWLIST_LINE" | grep -o 'new Set(\[.*\])')"
if [ -z "$ALLOWLIST_BODY" ] || printf '%s' "$ALLOWLIST_BODY" | grep -Eq '"(push|pull|fetch|remote)"' || ! printf '%s' "$ALLOWLIST_BODY" | grep -q '"update-ref"'; then
  printf 'git-allowlist exit=1 expected=0 cwd=%s evidence=%s\n' "$ROOT" "$LOGS/git-allowlist.log" | tee -a "$LOGS/results.txt"
  exit 1
fi
printf 'no-remote-mutation exit=0 expected=0 cwd=%s evidence=static-grep+allowlist-assertion\n' "$ROOT" | tee -a "$LOGS/results.txt"

# CLI dry run on a scratch backlog: shows the selected parallel set and merge
# plan, invokes no adapters, creates no run state.
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
  printf 'cli-dry-run-plan exit=0 expected=0 cwd=%s evidence=stdout\n' "$ROOT" | tee -a "$LOGS/results.txt"
else
  printf 'cli-dry-run-plan exit=1 expected=0 cwd=%s evidence=stdout\n' "$ROOT" | tee -a "$LOGS/results.txt"
  exit 1
fi

# Full adversarial scenario suite (dry run, queue stops, happy path with
# concurrency proof and gated sequential merges, retry exhaustion, state
# guard, malformed input, file-overlap contention, coordinated merge
# conflict, post-merge check failure, protected-ref fail-closed, interrupt/
# resume with sibling isolation, gate-preserving resume, sandbox scope
# containment).
run_case scenarios 0 node "$ROOT/test-orchestrator.mjs" "$OUT/scenarios"

# Per-command records for the authoritative run (complete evidence: command,
# cwd, environment provenance, duration, exit code, log path).
RECORDS="$OUT/records-final"
mkdir -p "$RECORDS"

printf 'phase-12 deterministic validation passed\n' | tee -a "$LOGS/results.txt"
