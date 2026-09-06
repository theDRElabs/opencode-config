import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

// Phase 12 parallel AFK orchestrator adversarial fixtures.
// Usage: node test-orchestrator.mjs <out-dir>
const root = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2];
if (!out) {
  process.stderr.write("usage: node test-orchestrator.mjs <out-dir>\n");
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });
const ORCH = path.join(root, "orchestrator.mjs");

function sh(cmd, args, cwd) {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} -> ${r.status}\n${r.stdout || ""}${r.stderr || ""}`);
  return r.stdout;
}
function git(repo, args) { return sh("git", args, repo); }
function assert(value, message) { if (!value) throw new Error(message); }
function read(file) { return fs.readFileSync(file, "utf8"); }
function jread(file) { return JSON.parse(read(file)); }

const issue = (id, o = {}) => `${id}: ${o.title || `Exercise ${o.scenario || "success"}`}
STATUS: ${o.status || "ready"}
TYPE: ${o.type || "afk"}
BLOCKERS: ${o.blockers || "none"}
OUTCOME: The fixture outcome is recorded.
ACCEPTANCE:
- The observable fixture result is recorded.
LAYERS: fixture
MODULES: ${o.modules || `src/${id}`}
TESTS: fixture test
COMMANDS: node --check src/${id}.mjs
CONSTRAINTS: SCENARIO=${o.scenario || "success"}${o.pause ? ` PAUSE=${o.pause}` : ""}
COORDINATION: ${o.coordination || "none"}
NON-GOALS: Human acceptance, merge approval, deploy
`;

function setup(name, issues) {
  const base = path.join(out, name);
  fs.rmSync(base, { recursive: true, force: true });
  const repo = path.join(base, "repo");
  const backlog = path.join(base, "backlog");
  fs.mkdirSync(path.join(repo, "src"), { recursive: true });
  fs.mkdirSync(backlog, { recursive: true });
  sh("git", ["init", "-q", "-b", "main", "."], repo);
  git(repo, ["config", "user.email", "fixture@example.invalid"]);
  git(repo, ["config", "user.name", "fixture"]);
  fs.writeFileSync(path.join(repo, "src", "base.mjs"), "export const base = 1;\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "init"]);
  for (const [id, body] of issues) fs.writeFileSync(path.join(backlog, `${id}.md`), body);
  return { base, repo, backlog, run: path.join(base, "run") };
}

function invoke(f, extras = [], expected = 0) {
  const args = [ORCH, "--repo", f.repo, "--backlog", f.backlog, "--run-dir", f.run, ...extras];
  const r = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (r.status !== expected)
    throw new Error(`${f.base}: expected exit ${expected}, got ${r.status}\n${r.stdout || ""}\n${r.stderr || ""}`);
  return r;
}
function status(f, id) {
  return read(path.join(f.backlog, `${id}.md`)).match(/^STATUS:\s*(\S+)/m)[1];
}
function events(f) {
  return read(path.join(f.run, "events.jsonl")).trim().split("\n").map(line => JSON.parse(line));
}
function ev(f, name) { return events(f).filter(e => e.event === name); }
function sha(repo, ref) { return git(repo, ["rev-parse", ref]).trim(); }

// ---------------------------------------------------------------------------
// Cycle 1: selection, dry run, queue stops, happy path, retry exhaustion,
// state guards.
// ---------------------------------------------------------------------------

// C1: dry run shows the selected parallel set and merge plan, mutates nothing.
{
  const f = setup("dry-run", [
    ["ISSUE-001", issue("ISSUE-001")],
    ["ISSUE-002", issue("ISSUE-002")],
    ["ISSUE-003", issue("ISSUE-003", { type: "hitl" })]
  ]);
  const before = fs.readdirSync(f.backlog).sort().map(n => [n, read(path.join(f.backlog, n))]);
  const r = invoke(f, ["--dry-run"]);
  const plan = JSON.parse(r.stdout);
  assert(plan.stopReason === "dry_run", `dry run stop reason wrong: ${plan.stopReason}`);
  assert(plan.invokedAdapters === false, "dry run invoked adapters");
  assert(plan.selected.map(s => s.id).join(",") === "ISSUE-001,ISSUE-002", "dry run selected the wrong parallel set");
  assert(plan.selected.every(s => s.branch === `sandbox/${s.id}`), "dry run branch names wrong");
  assert(plan.mergePlan.map(m => m.issue).join(",") === "ISSUE-001,ISSUE-002", "dry run merge plan wrong");
  assert(plan.humanApprovalRequiredFor.join(",") === "merge,push,deploy", "dry run must record human gates");
  assert(!fs.existsSync(f.run), "dry run created run state");
  const after = fs.readdirSync(f.backlog).sort().map(n => [n, read(path.join(f.backlog, n))]);
  assert(JSON.stringify(before) === JSON.stringify(after), "dry run mutated the backlog");
}

// C1: HITL-only queue stops with human_required and never spawns runners.
{
  const f = setup("hitl-only", [["ISSUE-001", issue("ISSUE-001", { type: "hitl" })]]);
  invoke(f);
  const state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "human_required", `hitl stop wrong: ${state.stopReason}`);
  assert(ev(f, "runner_start").length === 0, "hitl queue spawned a runner");
  assert(status(f, "ISSUE-001") === "ready", "hitl issue was mutated");
}

// C1: empty ready queue stops with empty_ready_queue.
{
  const f = setup("empty-queue", [["ISSUE-001", issue("ISSUE-001", { status: "done" })]]);
  invoke(f);
  assert(jread(path.join(f.run, "state.json")).stopReason === "empty_ready_queue", "empty queue stop wrong");
}

// C1: happy path — two independent issues run concurrently in their own
// sandboxes, both reviewed, no merge without the human gate, then both merged
// sequentially with full post-merge checks.
{
  const f = setup("happy-path", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "success", pause: 600 })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success", pause: 600 })]
  ]);
  const base = sha(f.repo, "main");

  // Phase A: prepare only — no merge authorization given.
  invoke(f);
  let state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "merge_gate_pending", `prepare stop wrong: ${state.stopReason}`);
  assert(status(f, "ISSUE-001") === "in_progress" && status(f, "ISSUE-002") === "in_progress",
    "prepared issues must be in_progress pending merge");
  assert(sha(f.repo, "main") === base, "prepare moved main");

  // Concurrency proof: the two sandboxed runner processes overlapped in time.
  const starts = {};
  const ends = {};
  for (const e of events(f)) {
    if (e.event === "runner_start") starts[e.issue] = Date.parse(e.at);
    if (e.event === "runner_end") ends[e.issue] = Date.parse(e.at);
  }
  assert(Object.keys(starts).length === 2 && Object.keys(ends).length === 2, "runner events missing");
  assert(Math.max(...Object.values(starts)) < Math.min(...Object.values(ends)),
    "sandboxed runners did not run concurrently (sequential execution detected)");

  // Per-issue sandbox isolation and full gates before any merge.
  for (const id of ["ISSUE-001", "ISSUE-002"]) {
    const p = path.join(f.run, "parallel", id, id);
    assert(fs.existsSync(path.join(p, "worktree", ".git")), `${id} sandbox worktree missing`);
    const policy = jread(path.join(p, "attempt-1", "sandbox-policy.json"));
    assert(policy.network === "denied" && policy.shell === "restricted-allowlist", `${id} sandbox policy wrong`);
    const result = jread(path.join(p, "attempt-1", "result.json"));
    assert(result.gates.review === "PASS" && result.humanAcceptance === false, `${id} completion gates wrong`);
    assert(read(path.join(p, "attempt-1", "review.md")).includes("VERDICT: PASS"), `${id} review verdict missing`);
    const commits = git(f.repo, ["rev-list", "--count", `${base}..sandbox/${id}`]).trim();
    assert(Number(commits) >= 1, `${id} branch has no implementation commits`);
  }
  assert(sha(f.repo, "sandbox/ISSUE-001") !== sha(f.repo, "sandbox/ISSUE-002"), "sandbox branches are not distinct");

  // Recorded human gates prepared, unapproved, and no merge without them.
  for (const id of ["ISSUE-001", "ISSUE-002"]) {
    const gate = jread(path.join(f.run, "merge-gates", `${id}.json`));
    assert(gate.approved === false, `${id} gate must start unapproved`);
    assert(gate.humanApprovalRequiredFor.join(",") === "merge,push,deploy", `${id} gate must record human approval scope`);
    assert(gate.base === base, `${id} gate base wrong`);
  }
  assert(ev(f, "merge_started").length === 0, "merge started without human authorization");
  assert(git(f.repo, ["log", "--oneline", "main"]).trim().split("\n").length === 1,
    "main gained commits before authorization");

  // Phase B: authorize both merges.
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001", "ISSUE-002"]);
  state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "batch_complete", `authorize stop wrong: ${state.stopReason}`);
  assert(status(f, "ISSUE-001") === "done" && status(f, "ISSUE-002") === "done", "merged issues not done");

  // Sequential merge queue: one merge at a time, full checks after each.
  // First-parent chain: init + the two merge commits in queue order; the full
  // history also carries each branch's implement commit.
  const firstParent = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(firstParent.length === 3, `expected base + 2 gated merge commits on main, got ${firstParent.length}`);
  assert(firstParent[0].includes("merge ISSUE-002") && firstParent[1].includes("merge ISSUE-001"), "merge order wrong");
  const log = git(f.repo, ["log", "--oneline", "main"]).trim().split("\n");
  assert(log.length === 5, `expected base + 2 implement commits + 2 merge commits on main, got ${log.length}`);
  const done1 = ev(f, "merge_completed").find(e => e.issue === "ISSUE-001");
  const started2 = ev(f, "merge_started").find(e => e.issue === "ISSUE-002");
  assert(Date.parse(started2.at) > Date.parse(done1.at), "merges did not run one at a time");
  assert(ev(f, "post_merge_check").length === 2, "full post-merge checks did not run per merge");
  assert(ev(f, "merge_authorized").length === 2, "merge authorizations were not recorded");

  // Merged content actually landed on main (check committed trees, not the
  // stale primary worktree).
  for (const id of ["ISSUE-001", "ISSUE-002"])
    sh("git", ["cat-file", "-e", `main:src/${id}.mjs`], f.repo);

  // Recorded merge chain ends exactly at main.
  const merges = ev(f, "merge_completed");
  assert(merges.length === 2, "merge completion events missing");
  assert(merges[0].before === base && merges[0].after === merges[1].before && merges[1].after === sha(f.repo, "main"),
    "recorded merge chain is not sequential or does not end at main");
  for (const id of ["ISSUE-001", "ISSUE-002"]) {
    const gate = jread(path.join(f.run, "merge-gates", `${id}.json`));
    assert(gate.approved === true && gate.merged === true, `${id} gate not updated after merge`);
    git(f.repo, ["rev-parse", "--verify", "--quiet", `sandbox/${id}`]);
    assert(jread(path.join(f.run, "state.json")).issues[id].status === "merged", `${id} state not merged`);
  }
}

// C1: retry exhaustion fails that issue closed while its independent sibling
// still completes and can merge (inherited Phase 10 semantics).
{
  const f = setup("retry-exhaustion", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "failed-tests" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success" })]
  ]);
  const base = sha(f.repo, "main");
  invoke(f, ["--max-retries", "0"], 1);
  let state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "issues_blocked", `exhaustion run stop wrong: ${state.stopReason}`);
  assert(status(f, "ISSUE-001") === "blocked", "exhausted issue not blocked");
  assert(fs.existsSync(path.join(f.run, "parallel", "ISSUE-001", "ISSUE-001", "attempt-1", "failure.json")),
    "exhausted issue failure evidence missing");
  assert(jread(path.join(f.run, "merge-gates", "ISSUE-002.json")).approved === false, "sibling gate missing");
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-002"], 1);
  state = jread(path.join(f.run, "state.json"));
  assert(state.issues["ISSUE-002"].status === "merged" && status(f, "ISSUE-002") === "done",
    "sibling did not merge after exhaustion of the other issue");
  assert(status(f, "ISSUE-001") === "blocked", "exhausted issue changed status on authorize");
  assert(git(f.repo, ["cat-file", "-e", "main:src/ISSUE-002.mjs"], f.repo) === "", "sibling content not merged");
  assert(!fs.existsSync(path.join(f.run, "merge-gates", "ISSUE-001.json")), "exhausted issue got a merge gate");
  const log = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(log.length === 2 && log[0].includes("merge ISSUE-002"), "unexpected merge history after exhaustion");
}

// C1: existing run state requires --resume; malformed input fails closed.
{
  const f = setup("state-guard", [["ISSUE-001", issue("ISSUE-001")]]);
  invoke(f);
  invoke(f, [], 2);
  invoke(f, ["--resume"]);
  assert(jread(path.join(f.run, "state.json")).stopReason === "merge_gate_pending", "resume did not preserve state");
}
{
  const f = setup("malformed-input", [["ISSUE-001", "ISSUE-001: Truncated fixture issue\nSTATUS: ready\n"]]);
  const before = read(path.join(f.backlog, "ISSUE-001.md"));
  invoke(f, [], 2);
  assert(!fs.existsSync(path.join(f.run, "state.json")), "malformed input produced run state");
  assert(read(path.join(f.backlog, "ISSUE-001.md")) === before, "malformed input mutated the backlog");
}

// ---------------------------------------------------------------------------
// Cycle 2: file-overlap contention, coordinated merge conflict, post-merge
// check failure, protected-ref fail-closed across concurrent worktrees.
// ---------------------------------------------------------------------------

// C2: two issues touching the same file without declared coordination → the
// lower-priority issue is deferred, both branches stay intact.
{
  const f = setup("file-overlap", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "overlap" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "overlap" })]
  ]);
  const base = sha(f.repo, "main");
  invoke(f, [], 1);
  let state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "issues_blocked", `overlap stop wrong: ${state.stopReason}`);
  assert(state.issues["ISSUE-002"].status === "deferred_contention", "overlapping issue was not deferred");
  assert(status(f, "ISSUE-002") === "blocked", "deferred issue not blocked in the backlog");
  assert(!fs.existsSync(path.join(f.run, "merge-gates", "ISSUE-002.json")), "deferred issue received a merge gate");
  assert(jread(path.join(f.run, "merge-gates", "ISSUE-001.json")).approved === false, "priority issue gate missing");
  const report = jread(path.join(f.run, "contention-report.json"));
  const pair = report.pairs.find(p => p.a === "ISSUE-001" && p.b === "ISSUE-002");
  assert(pair && pair.sharedFiles.includes("src/shared.txt") && pair.deferred === "ISSUE-002",
    "contention report missing shared file or deferral record");
  const deferredEvent = ev(f, "deferred").find(e => e.issue === "ISSUE-002");
  assert(deferredEvent && deferredEvent.sharedFiles.includes("src/shared.txt"), "deferral event missing evidence");
  for (const id of ["ISSUE-001", "ISSUE-002"]) {
    const commits = git(f.repo, ["rev-list", "--count", `${base}..sandbox/${id}`]).trim();
    assert(Number(commits) >= 1, `${id} branch not intact after contention deferral`);
  }
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001"], 1);
  state = jread(path.join(f.run, "state.json"));
  assert(state.issues["ISSUE-001"].status === "merged" && status(f, "ISSUE-001") === "done",
    "priority issue did not merge after contention deferral");
  assert(git(f.repo, ["cat-file", "-p", "main:src/shared.txt"]).includes("ISSUE-001"),
    "shared file on main is not the merged issue's version");
  const firstParent = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(firstParent.length === 2 && firstParent[0].includes("merge ISSUE-001"), "unexpected merges after contention");
  git(f.repo, ["rev-parse", "--verify", "--quiet", "sandbox/ISSUE-002"]);
}

// C2: mutual coordination allows same-file branches into the merge queue; a
// real git conflict then defers the issue fail-closed with evidence.
{
  const f = setup("merge-conflict", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "coordinated-conflict", coordination: "ISSUE-002" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "coordinated-conflict", coordination: "ISSUE-001" })]
  ]);
  const base = sha(f.repo, "main");
  invoke(f);
  assert(fs.existsSync(path.join(f.run, "merge-gates", "ISSUE-001.json"))
    && fs.existsSync(path.join(f.run, "merge-gates", "ISSUE-002.json")),
    "mutually coordinated overlapping issues must both reach gates");
  const branch2 = sha(f.repo, "sandbox/ISSUE-002");
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001", "ISSUE-002"], 1);
  const state = jread(path.join(f.run, "state.json"));
  assert(state.issues["ISSUE-001"].status === "merged", "first coordinated branch did not merge");
  assert(state.issues["ISSUE-002"].status === "blocked", "conflicting branch not blocked");
  assert(state.issues["ISSUE-002"].blockReason === "merge_conflict", "conflict reason not recorded");
  assert(status(f, "ISSUE-002") === "blocked", "conflicting issue not blocked in the backlog");
  const attempt = read(path.join(f.run, "merge", "ISSUE-002", "merge-attempt.log"));
  assert(attempt.includes("CONFLICT"), "merge conflict evidence missing CONFLICT marker");
  assert(ev(f, "merge_conflict").some(e => e.issue === "ISSUE-002"), "merge_conflict event missing");
  const firstParent = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(firstParent.length === 2 && firstParent[0].includes("merge ISSUE-001"),
    "main moved beyond the successful merge despite the conflict");
  assert(sha(f.repo, "sandbox/ISSUE-002") === branch2, "conflicted branch was mutated");
  const mergeDir = path.join(f.run, "merge", "ISSUE-002", "worktree");
  assert(git(mergeDir, ["status", "--porcelain"]).trim() === "", "merge worktree not rolled back cleanly");
  assert(git(mergeDir, ["rev-parse", "HEAD"]).trim() === sha(f.repo, "main"),
    "aborted merge worktree HEAD does not match main");
}

// C2: clean merge whose full post-merge check fails → merge aborted (main
// unchanged), issue blocked fail-closed, independent sibling still merges.
{
  const f = setup("post-merge-failure", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "post-merge-failure" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success" })]
  ]);
  const base = sha(f.repo, "main");
  invoke(f);
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001", "ISSUE-002"], 1);
  const state = jread(path.join(f.run, "state.json"));
  assert(state.issues["ISSUE-001"].status === "blocked", "post-merge failure did not block the issue");
  assert(state.issues["ISSUE-001"].blockReason === "post_merge_check_failed", "post-merge reason not recorded");
  assert(status(f, "ISSUE-001") === "blocked", "post-merge failure not blocked in the backlog");
  assert(state.issues["ISSUE-002"].status === "merged" && status(f, "ISSUE-002") === "done",
    "independent sibling did not merge after the other issue's post-merge failure");
  const checkLog = read(path.join(f.run, "merge", "ISSUE-001", "full-check.log"));
  const report = JSON.parse(checkLog);
  assert(report.allPassed === false && report.reason, "full-check report missing failure reason");
  assert(ev(f, "merge_aborted").some(e => e.issue === "ISSUE-001" && e.reason === "post_merge_check_failed"),
    "merge_aborted event missing");
  const mergeDir = path.join(f.run, "merge", "ISSUE-001", "worktree");
  assert(git(mergeDir, ["status", "--porcelain"]).trim() === "", "failed merge worktree not rolled back");
  assert(git(mergeDir, ["rev-parse", "HEAD"]).trim() === base, "aborted merge HEAD is not the base");
  const firstParent = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(firstParent.length === 2 && firstParent[0].includes("merge ISSUE-002"),
    "main history wrong after post-merge failure");
  sh("git", ["cat-file", "-e", "main:src/ISSUE-002.mjs"], f.repo);
}

// C2: a main movement outside the recorded gate chain (rogue actor) → every
// in-flight attempt fails closed, all gates revoked, no merge executes.
{
  const f = setup("protected-refs", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "success" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success" })]
  ]);
  const base = sha(f.repo, "main");
  invoke(f);
  assert(jread(path.join(f.run, "state.json")).stopReason === "merge_gate_pending", "prepare failed");
  git(f.repo, ["commit", "--allow-empty", "-qm", "rogue main movement outside any gate"]);
  const rogue = sha(f.repo, "main");
  assert(rogue !== base, "rogue move did not happen");
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001"], 1);
  const state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "protected_refs_mutated", `fail-closed stop wrong: ${state.stopReason}`);
  for (const id of ["ISSUE-001", "ISSUE-002"]) {
    assert(state.issues[id].status === "failed_closed_refs", `${id} not failed closed`);
    assert(status(f, id) === "blocked", `${id} not blocked after fail-closed`);
    const gate = jread(path.join(f.run, "merge-gates", `${id}.json`));
    assert(gate.revoked === true && gate.approved === false, `${id} gate not revoked`);
    git(f.repo, ["rev-parse", "--verify", "--quiet", `sandbox/${id}`]);
  }
  const firstParent = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(firstParent.length === 2 && firstParent[0].includes("rogue"),
    "orchestrator merged despite the rogue main movement");
  assert(ev(f, "merge_started").length === 0, "a merge was attempted after the rogue movement");
  assert(ev(f, "fail_closed").some(e => e.reason === "protected_refs_mutated"), "fail_closed event missing");
  assert(jread(path.join(f.run, "refs-checkpoint.json")).actualMain === rogue, "refs checkpoint evidence wrong");
}

// ---------------------------------------------------------------------------
// Cycle 3: interruption/resumability (inherited Phase 10 semantics) and
// sandbox-leak checks (run-dir base, primary worktree, adapter source).
// ---------------------------------------------------------------------------

// C3: an interrupted sandbox stage (adapter exit 75) propagates: the batch
// run stops with exit 75 (interrupted), the interrupted issue stays
// in_progress and resumable, the sibling's prepared state is untouched, and
// a --resume run completes the exact unfinished stage (Phase 10 semantics).
{
  const f = setup("interrupt-resume", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "interrupt" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success" })]
  ]);
  const base = sha(f.repo, "main");
  invoke(f, [], 75);
  let state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "interrupted", `interrupt run stop wrong: ${state.stopReason}`);
  assert(state.issues["ISSUE-001"].status === "interrupted", "interrupted issue not marked interrupted");
  assert(status(f, "ISSUE-001") === "in_progress", "interrupted issue must stay in_progress (resumable)");
  const runnerState = jread(path.join(f.run, "parallel", "ISSUE-001", "state.json"));
  assert(runnerState.stopReason === "interrupted" && runnerState.current?.stage === "check",
    `runner state not preserved mid-stage: ${JSON.stringify(runnerState.stopReason)}`);
  assert(ev(f, "interrupted").some(e => e.issue === "ISSUE-001" && e.stage === "check"),
    "orchestrator interrupted event missing the runner stage");
  const sibling = state.issues["ISSUE-002"];
  assert(sibling.status === "gate_prepared", "sibling was disturbed by the interruption");
  assert(fs.existsSync(path.join(f.run, "merge-gates", "ISSUE-002.json")), "sibling gate missing");

  // Resume: the interrupted issue completes its remaining stage (review only
  // — implement/check already passed) and both issues reach gates.
  invoke(f, ["--resume"], 0);
  state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "merge_gate_pending", `resume stop wrong: ${state.stopReason}`);
  assert(state.issues["ISSUE-001"].status === "gate_prepared", "interrupted issue did not complete on resume");
  assert(status(f, "ISSUE-001") === "in_progress", "resumed issue must stay in_progress pending gate");
  assert(fs.existsSync(path.join(f.run, "parallel", "ISSUE-001", "ISSUE-001", "attempt-1", "review.md")),
    "resumed issue did not produce its review artifact");
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001", "ISSUE-002"]);
  state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "batch_complete", "authorized merges did not complete after resume");
  assert(status(f, "ISSUE-001") === "done" && status(f, "ISSUE-002") === "done", "issues not done after full resume");
  const firstParent = git(f.repo, ["log", "--oneline", "--first-parent", "main"]).trim().split("\n");
  assert(firstParent.length === 3, "unexpected history after interrupt/resume");
  sh("git", ["cat-file", "-e", "main:src/ISSUE-002.mjs"], f.repo);
  sh("git", ["cat-file", "-e", "main:src/ISSUE-001.mjs"], f.repo);
}

// C3: orchestrator-level resume of a fully prepared batch: a second
// invocation without --resume fails; with --resume the merge-gate-pending
// state is preserved exactly (already covered by state-guard) and gates stay
// unapproved until --authorize-merge records them.
{
  const f = setup("resume-gates", [["ISSUE-001", issue("ISSUE-001")]]);
  invoke(f);
  const before = read(path.join(f.run, "merge-gates", "ISSUE-001.json"));
  const eventsBefore = read(path.join(f.run, "events.jsonl"));
  invoke(f, ["--resume"]);
  assert(read(path.join(f.run, "merge-gates", "ISSUE-001.json")) === before, "resume mutated a prepared gate");
  assert(read(path.join(f.run, "events.jsonl")) !== eventsBefore, "resume did not record its entry");
  assert(ev(f, "merge_started").length === 0, "resume merged without authorization");
  assert(jread(path.join(f.run, "state.json")).stopReason === "merge_gate_pending", "resume changed the phase");
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001"]);
  assert(jread(path.join(f.run, "state.json")).stopReason === "batch_complete", "authorized merge did not complete");
}

// C3: sandbox-leak checks — every sandbox scope stays inside the per-issue
// run directory; the primary repo worktree and the fixture adapter sources
// are never modified by a run.
{
  const f = setup("sandbox-leak", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "success" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success" })]
  ]);
  const sources = {};
  for (const name of ["parallel-adapter.mjs", "full-check.mjs", "orchestrator.mjs", "sandbox-stage-adapter.mjs", "record.mjs"]) {
    sources[name] = fs.readFileSync(path.join(root, name), "utf8");
  }
  invoke(f);
  for (const id of ["ISSUE-001", "ISSUE-002"]) {
    const policy = jread(path.join(f.run, "parallel", id, id, "attempt-1", "sandbox-policy.json"));
    for (const scope of policy.fsScope)
      assert(scope.startsWith(path.join(f.run, "parallel", id)),
        `${id} sandbox scope escapes its run directory: ${scope}`);
    assert((policy.fsDenyPrefixes || []).includes("/root"), `${id} sandbox does not deny /root`);
  }
  // Primary repo worktree clean: implementation commits live only on
  // sandbox branches, never in the fixture repo's own working tree.
  const status = git(f.repo, ["status", "--porcelain"]).trim();
  assert(status === "", `primary repo worktree dirty: ${status}`);
  // Adapter and orchestrator sources must be byte-identical after a run.
  for (const name of Object.keys(sources))
    assert(fs.readFileSync(path.join(root, name), "utf8") === sources[name], `${name} was modified during a run`);
}

// C4: rogue main movement MID-QUEUE (between the first and second gated
// merges, fired by a hostile post-commit hook — git-internal, invisible to
// the orchestrator's git allowlist, same attack class as the Phase 11
// fail-closed-refs fixture). The landing must be a compare-and-swap: the
// rogue movement is detected, every in-flight attempt fails closed, gates
// are revoked, and the rogue ref state is preserved as evidence instead of
// being silently clobbered.
{
  const f = setup("mid-queue-rogue", [
    ["ISSUE-001", issue("ISSUE-001", { scenario: "success" })],
    ["ISSUE-002", issue("ISSUE-002", { scenario: "success" })]
  ]);
  const base = sha(f.repo, "main");
  const hookDir = path.join(f.repo, ".git", "hooks");
  fs.mkdirSync(hookDir, { recursive: true });
  fs.writeFileSync(path.join(hookDir, "post-commit"),
    '#!/bin/sh\nmsg=$(git log -1 --pretty=%B)\ncase "$msg" in\n  *"merge ISSUE-002 (human-gated)"*)\n    rogue=$(git commit-tree HEAD^{tree} -m "rogue mid-queue movement")\n    git update-ref refs/heads/main "$rogue"\n    ;;\nesac\nexit 0\n');
  fs.chmodSync(path.join(hookDir, "post-commit"), 0o755);
  invoke(f);
  assert(jread(path.join(f.run, "state.json")).stopReason === "merge_gate_pending", "prepare failed under the hostile hook");
  invoke(f, ["--resume", "--authorize-merge", "ISSUE-001", "ISSUE-002"], 1);
  const state = jread(path.join(f.run, "state.json"));
  assert(state.stopReason === "protected_refs_mutated", `mid-queue stop wrong: ${state.stopReason}`);
  assert(state.issues["ISSUE-001"].status === "merged", "first gated merge did not land");
  assert(state.issues["ISSUE-002"].status === "failed_closed_refs", "second issue not failed closed");
  assert(status(f, "ISSUE-001") === "done" && status(f, "ISSUE-002") === "blocked",
    "backlog statuses wrong after the mid-queue rogue movement");
  assert(ev(f, "merge_completed").filter(e => e.issue === "ISSUE-002").length === 0,
    "the clobbered merge was recorded as completed");
  assert(ev(f, "fail_closed").some(e => e.reason === "protected_refs_mutated" && e.issue === "ISSUE-002"),
    "fail_closed event for the mid-queue window missing");
  const gate = jread(path.join(f.run, "merge-gates", "ISSUE-002.json"));
  assert(gate.revoked === true && gate.approved === false && gate.revocationReason === "protected_refs_mutated",
    "mid-queue gate not revoked");
  const merge1Commit = jread(path.join(f.run, "merge-gates", "ISSUE-001.json")).mergeCommit;
  const landing = jread(path.join(f.run, "merge", "ISSUE-002", "landing-failure.json"));
  const merge2Head = sh("git", ["rev-parse", "HEAD"], path.join(f.run, "merge", "ISSUE-002", "worktree")).trim();
  const mainNow = sha(f.repo, "main");
  assert(landing.expectedMain === merge1Commit, "landing evidence base wrong");
  assert(landing.attemptedLanding === merge2Head, "landing evidence did not record the refused commit");
  assert(landing.actualMain !== landing.expectedMain && landing.actualMain === mainNow,
    "landing evidence does not match the preserved rogue ref state");
  assert(mainNow !== merge2Head && mainNow !== merge1Commit && mainNow !== base,
    "main was silently clobbered instead of preserving the rogue movement");
}

console.log("cycle-2 scenarios passed: file-overlap contention deferral, coordinated merge conflict fail-closed, post-merge check failure abort, protected-ref fail-closed");
console.log("cycle-3 scenarios passed: interrupt/resume with sibling isolation, gate-preserving resume, sandbox scope containment");
console.log("cycle-4 scenario passed: mid-queue rogue main movement fails closed via compare-and-swap landing (verifier NB2 repair)");
