#!/usr/bin/env node
// Phase 12 parallel AFK orchestrator.
//
// Selects at most --max-concurrency (2) dependency-ready, output-independent
// AFK issues, runs each through the Phase 10 sequential runner inside its own
// Phase 11 issue sandbox as concurrent plain node processes, prepares a
// recorded human merge gate per completed branch, and only after an explicit
// recorded --authorize-merge executes a sequential merge queue with full
// post-merge checks. Push and deploy have no code path here. Kernel
// namespaces are never used (proot constraint on this device): isolation is
// inherited from the Phase 11 sandbox.
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { sandboxRun, PROTECTED_REFS } from "../issue-sandbox/sandbox.mjs";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const RUNNER = path.join(HERE, "..", "sequential-afk-runner", "runner.mjs");
const INTERRUPTED = 75;

function runnerStage(id) {
  try {
    const runnerState = JSON.parse(fs.readFileSync(path.join(parallelBase(id), "state.json"), "utf8"));
    return runnerState.current?.stage || null;
  } catch { return null; }
}

// Trusted-coordinator git surface. The orchestrator may only run these
// subcommands; reset is pinned to rollback of a merge worktree, merge --abort
// to conflict rollback, and update-ref to the compare-and-swap landing of a
// human-gated merge commit on main. push/pull/fetch/remote and every other
// remote-mutating subcommand are absent by construction.
const GIT_SUBCOMMAND_ALLOWLIST = new Set(["rev-parse", "worktree", "merge", "commit", "status", "diff", "log", "update-ref", "reset"]);

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = {
    maxConcurrency: 2,
    maxRetries: 2,
    dryRun: false,
    resume: false,
    authorizeMerge: []
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg === "--authorize-merge") {
      let value = argv[i + 1];
      if (!value || value.startsWith("--")) fail("--authorize-merge requires at least one issue id");
      while (value && !value.startsWith("--")) {
        options.authorizeMerge.push(value);
        i += 1;
        value = argv[i + 1];
      }
    } else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[++i];
      if (!value) fail(`missing value for ${arg}`);
      const names = {
        repo: "repo", backlog: "backlog", "run-dir": "runDir",
        "stage-adapter": "stageAdapter", "sandbox-adapter": "sandboxAdapter",
        "full-check": "fullCheck", "max-concurrency": "maxConcurrency",
        "max-retries": "maxRetries"
      };
      if (!names[key]) fail(`unknown option ${arg}`);
      options[names[key]] = value;
    } else fail(`unexpected argument ${arg}`);
  }
  if (options.dryRun) {
    if (!options.backlog) fail("--backlog is required");
    return options;
  }
  for (const key of ["repo", "backlog", "runDir"])
    if (!options[key]) fail(`--${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)} is required`);
  options.maxConcurrency = Number(options.maxConcurrency);
  options.maxRetries = Number(options.maxRetries);
  if (!Number.isInteger(options.maxConcurrency) || options.maxConcurrency < 1 || options.maxConcurrency > 2)
    fail("--max-concurrency must be 1 or 2 (at most two concurrent sandboxed implementers)");
  if (!Number.isInteger(options.maxRetries) || options.maxRetries < 0 || options.maxRetries > 2)
    fail("--max-retries must be an integer from 0 through 2");
  for (const id of options.authorizeMerge)
    if (!/^ISSUE-\d+$/.test(id)) fail(`invalid issue id for --authorize-merge: ${id}`);
  return options;
}

function idNumber(id) {
  return Number(id.match(/\d+/)[0]);
}

function parseIssue(file) {
  const text = fs.readFileSync(file, "utf8");
  const first = text.match(/^(ISSUE-\d+):\s+(.+)$/m);
  if (!first) throw new Error(`${file}: missing issue header`);
  const field = name => text.match(new RegExp(`^${name}:\\s*(.+)$`, "m"))?.[1]?.trim();
  const issue = {
    id: first[1], title: first[2], status: field("STATUS"), type: field("TYPE"),
    blockersText: field("BLOCKERS"), commands: field("COMMANDS"), constraints: field("CONSTRAINTS"),
    coordinationText: field("COORDINATION"), file, text
  };
  for (const key of ["status", "type", "blockersText", "commands", "constraints"])
    if (!issue[key]) throw new Error(`${file}: missing ${key}`);
  issue.blockers = issue.blockersText === "none" ? [] : issue.blockersText.split(",").map(v => v.trim());
  issue.coordination = !issue.coordinationText || issue.coordinationText === "none"
    ? [] : issue.coordinationText.split(",").map(v => v.trim());
  return issue;
}

function loadIssues(backlog) {
  const files = fs.readdirSync(backlog).filter(name => /^ISSUE-\d+\.md$/.test(name));
  return files.map(name => parseIssue(path.join(backlog, name))).sort((a, b) => idNumber(a.id) - idNumber(b.id));
}

export function blockerClosure(issue, byId, seen = new Set()) {
  for (const blocker of issue.blockers) {
    if (seen.has(blocker)) continue;
    seen.add(blocker);
    const next = byId.get(blocker);
    if (next) blockerClosure(next, byId, seen);
  }
  return seen;
}

export function parallelSafe(a, b, byId) {
  if (!a || !b || a.id === b.id) return false;
  const closureA = blockerClosure(a, byId);
  const closureB = blockerClosure(b, byId);
  return !closureA.has(b.id) && !closureB.has(a.id);
}

function selectBatch(issues, maxConcurrency) {
  const byId = new Map(issues.map(i => [i.id, i]));
  const done = new Set(issues.filter(i => i.status === "done").map(i => i.id));
  const ready = issues
    .filter(i => i.status === "ready" && i.type === "afk" && i.commands !== "UNKNOWN"
      && i.blockers.every(id => done.has(id)))
    .sort((a, b) => idNumber(a.id) - idNumber(b.id));
  const batch = [];
  for (const candidate of ready) {
    if (batch.length >= maxConcurrency) break;
    if (batch.every(member => parallelSafe(member, candidate, byId))) batch.push(candidate);
  }
  const stopReason = batch.length > 0 ? null
    : issues.some(i => i.type === "hitl" && i.status !== "done") ? "human_required"
    : issues.some(i => i.status === "blocked" || i.blockers.some(id => !done.has(id))) ? "blocked_queue"
    : "empty_ready_queue";
  return { batch, stopReason };
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

function setStatus(issue, status) {
  writeAtomic(issue.file, issue.text.replace(/^STATUS:\s*.+$/m, `STATUS: ${status}`));
}

function appendEvent(runDir, event, details = {}) {
  const record = { at: new Date().toISOString(), event, ...details };
  fs.mkdirSync(runDir, { recursive: true });
  fs.appendFileSync(path.join(runDir, "events.jsonl"), `${JSON.stringify(record)}\n`);
  process.stdout.write(`${record.at} ${event} ${JSON.stringify(details)}\n`);
}

function saveState(runDir, state) {
  writeAtomic(path.join(runDir, "state.json"), `${JSON.stringify(state, null, 2)}\n`);
}

function git(cwd, args, extraEnv = {}) {
  if (!Array.isArray(args) || args.length === 0) throw new Error("git requires arguments");
  const sub = args[0];
  if (!GIT_SUBCOMMAND_ALLOWLIST.has(sub)) throw new Error(`git subcommand not allowed for orchestrator: ${sub}`);
  if (sub === "reset" && (args.length !== 3 || args[1] !== "--hard" || args[2] !== "HEAD"))
    throw new Error("git reset is only allowed as reset --hard HEAD (merge worktree rollback)");
  if (sub === "merge" && args[1] === "--abort" && args.length !== 2)
    throw new Error("git merge --abort takes no additional arguments");
  if (sub === "update-ref" && (args.length !== 4 || args[1] !== "refs/heads/main"))
    throw new Error("git update-ref is only allowed as update-ref refs/heads/main <new> <old> (compare-and-swap landing of a gated merge)");
  const result = spawnSync("git", args, { cwd, encoding: "utf8", env: { ...process.env, ...extraEnv } });
  const stderr = `${result.stderr || ""}${result.error ? `${result.error.message}\n` : ""}`;
  return { code: result.status ?? 1, stdout: result.stdout || "", stderr };
}

function refSha(repo, ref) {
  const r = git(repo, ["rev-parse", "--verify", "--quiet", ref]);
  return r.code === 0 ? r.stdout.trim() : null;
}

function shaOf(mergeDir) {
  const r = git(mergeDir, ["rev-parse", "HEAD"]);
  if (r.code !== 0) throw new Error(`rev-parse HEAD failed in ${mergeDir}: ${r.stderr}`);
  return r.stdout.trim();
}

function nextIssueNumber(backlog) {
  const existing = fs.readdirSync(backlog).filter(name => /^ISSUE-\d+\.md$/.test(name));
  return Math.max(0, ...existing.map(name => Number(name.match(/\d+/)[0]))) + 1;
}

function stop(runDir, state, reason, code = 0, summary = {}) {
  state.stopReason = reason;
  state.updatedAt = new Date().toISOString();
  saveState(runDir, state);
  appendEvent(runDir, "stop", { reason });
  process.stdout.write(`${JSON.stringify({ stopReason: reason, ...summary })}\n`);
  process.exit(code);
}

const options = parseArgs(process.argv.slice(2));
const stageAdapter = options.stageAdapter || path.join(HERE, "sandbox-stage-adapter.mjs");
const sandboxAdapter = options.sandboxAdapter || path.join(HERE, "parallel-adapter.mjs");
const fullCheckAdapter = options.fullCheck || path.join(HERE, "full-check.mjs");

// ---------------------------------------------------------------------------
// Dry run: selection and merge plan only. No directories, state, or adapters.
// ---------------------------------------------------------------------------
if (options.dryRun) {
  const issues = loadIssues(options.backlog);
  const { batch, stopReason } = selectBatch(issues, options.maxConcurrency);
  const byId = new Map(issues.map(i => [i.id, i]));
  const plan = {
    stopReason: "dry_run",
    selected: batch.map(i => ({ id: i.id, branch: `sandbox/${i.id}`, modules: i.modules || null })),
    parallelSafePairs: batch.length === 2 ? parallelSafe(batch[0], batch[1], byId) : null,
    mergePlan: batch.map((i, index) => ({ issue: i.id, order: index + 1, branch: `sandbox/${i.id}` })),
    humanApprovalRequiredFor: ["merge", "push", "deploy"],
    invokedAdapters: false,
    maxConcurrency: options.maxConcurrency
  };
  if (stopReason) plan.queueStopReason = stopReason;
  process.stdout.write(`${JSON.stringify(plan)}\n`);
  process.exit(0);
}

if (!fs.existsSync(options.repo) || !fs.statSync(options.repo).isDirectory()) fail("repo directory does not exist");
if (!fs.existsSync(options.backlog) || !fs.statSync(options.backlog).isDirectory()) fail("backlog directory does not exist");

fs.mkdirSync(options.runDir, { recursive: true });
const lock = path.join(options.runDir, "orchestrator.lock");
let lockFd;
try { lockFd = fs.openSync(lock, "wx"); } catch { fail(`orchestrator run lock exists: ${lock}`); }
process.on("exit", () => { try { fs.closeSync(lockFd); fs.unlinkSync(lock); } catch {} });

const stateFile = path.join(options.runDir, "state.json");
let state;
if (options.resume) {
  if (!fs.existsSync(stateFile)) fail("--resume requires existing state.json");
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  appendEvent(options.runDir, "resume", { phase: state.phase });
} else {
  if (fs.existsSync(stateFile)) fail("existing run state requires --resume or a new --run-dir");
}

let issues;
try {
  issues = loadIssues(options.backlog);
} catch (error) {
  fail(`malformed backlog input: ${error.message}`);
}
const byId = new Map(issues.map(i => [i.id, i]));

function parallelBase(id) { return path.join(options.runDir, "parallel", id); }
function gateFile(id) { return path.join(options.runDir, "merge-gates", `${id}.json`); }

if (!state) {
  const { batch, stopReason } = selectBatch(issues, options.maxConcurrency);
  if (batch.length === 0) {
    state = { version: 1, phase: "prepare", batch: [], issues: {}, mergeQueue: [], stopReason: null };
    stop(options.runDir, state, stopReason, 0, { selected: [] });
  }
  const batchBase = refSha(options.repo, "refs/heads/main");
  state = {
    version: 1,
    phase: "prepare",
    batch: batch.map(i => i.id),
    batchBase,
    expectedMainSha: batchBase,
    protectedBaseline: Object.fromEntries(PROTECTED_REFS.map(ref => [ref, refSha(options.repo, ref)])),
    maxRetries: options.maxRetries,
    issues: {},
    mergeQueue: []
  };
  for (const issue of batch) {
    const copyDir = path.join(parallelBase(issue.id), "backlog");
    fs.mkdirSync(copyDir, { recursive: true });
    for (const other of issues) {
      if (other.id === issue.id || !batch.some(b => b.id === other.id)) {
        fs.copyFileSync(other.file, path.join(copyDir, `${other.id}.md`));
      } else {
        // Other concurrent batch members are marked in_progress in this copy
        // so the sequential runner selects exactly its own issue.
        writeAtomic(path.join(copyDir, `${other.id}.md`),
          other.text.replace(/^STATUS:\s*.+$/m, "STATUS: in_progress"));
      }
    }
    state.issues[issue.id] = {
      status: "selected",
      branch: `sandbox/${issue.id}`,
      copyDir,
      copyFiles: fs.readdirSync(copyDir).filter(n => /^ISSUE-\d+\.md$/.test(n)).sort()
    };
    setStatus(issue, "in_progress");
  }
  appendEvent(options.runDir, "selected", { batch: state.batch });
  saveState(options.runDir, state);
}

// ---------------------------------------------------------------------------
// Prepare phase: run each selected issue through the Phase 10 runner inside
// its Phase 11 sandbox. Worktrees are pre-created sequentially so concurrent
// stage runs only ever attach, never race on `git worktree add`.
// ---------------------------------------------------------------------------
if (state.phase === "prepare" || state.phase === "interrupted") {
  state.phase = "prepare";
  const toRun = state.batch.filter(id => ["selected", "running", "interrupted"].includes(state.issues[id].status));
  for (const id of toRun) {
    sandboxRun({ repo: options.repo, runDir: parallelBase(id), issue: id, attempt: 1, command: [], dryRun: true });
    state.issues[id].status = "running";
  }
  saveState(options.runDir, state);

  const runnerEnv = id => ({
    ...process.env,
    SANDBOX_INTEGRATION_REPO: options.repo,
    SANDBOX_INTEGRATION_RUN_DIR: parallelBase(id),
    SANDBOX_STAGE_ADAPTER: sandboxAdapter
  });
  const children = toRun.map(id => {
    const runnerArgs = [
      RUNNER, "--backlog", state.issues[id].copyDir, "--run-dir", parallelBase(id),
      "--implement", stageAdapter, "--check", stageAdapter, "--review", stageAdapter,
      "--max-iterations", "1", "--max-retries", String(state.maxRetries)
    ];
    const runnerState = path.join(parallelBase(id), "state.json");
    const resumeRunner = fs.existsSync(runnerState);
    if (resumeRunner) runnerArgs.push("--resume");
    const logPath = path.join(parallelBase(id), "runner.log");
    const logFd = fs.openSync(logPath, "a");
    appendEvent(options.runDir, "runner_start", { issue: id, resume: resumeRunner });
    const child = spawn(process.execPath, runnerArgs, { cwd: options.runDir, env: runnerEnv(id), stdio: ["ignore", logFd, logFd] });
    return {
      id,
      exitCode: new Promise(resolve => {
        child.on("exit", (code, signal) => resolve({ id, code: code ?? 1, signal }));
        child.on("error", () => resolve({ id, code: 1, signal: "SPAWN_ERROR" }));
      })
    };
  });
  const results = await Promise.all(children.map(c => c.exitCode));
  for (const result of results) appendEvent(options.runDir, "runner_end", { issue: result.id, exitCode: result.code });

  // Reconcile each issue's private backlog copy into the shared backlog.
  for (const result of results) {
    const id = result.id;
    const entry = state.issues[id];
    const copyPath = path.join(entry.copyDir, `${id}.md`);
    const copyStatus = fs.readFileSync(copyPath, "utf8").match(/^STATUS:\s*(\S+)/m)?.[1];
    const newFiles = fs.readdirSync(entry.copyDir)
      .filter(n => /^ISSUE-\d+\.md$/.test(n) && !entry.copyFiles.includes(n))
      .sort();
    const followUps = [];
    for (const name of newFiles) {
      const number = nextIssueNumber(options.backlog);
      const newId = `ISSUE-${String(number).padStart(3, "0")}`;
      const text = fs.readFileSync(path.join(entry.copyDir, name), "utf8");
      const oldId = text.match(/^(ISSUE-\d+):/m)?.[1];
      writeAtomic(path.join(options.backlog, `${newId}.md`),
        oldId ? text.replace(new RegExp(`^${oldId}:`, "m"), `${newId}:`) : text);
      followUps.push(newId);
      appendEvent(options.runDir, "followup_created", { origin: id, from: oldId || name, to: newId });
    }
    entry.followUps = followUps;
    entry.runnerExit = result.code;
    const mainIssue = parseIssue(path.join(options.backlog, `${id}.md`));
    if (result.code === INTERRUPTED) {
      // The sandboxed runner stopped mid-stage (adapter exit 75). The issue
      // stays resumable: shared-backlog status returns to in_progress and a
      // later --resume re-enters the same runner with --resume, continuing
      // the exact unfinished stage without consuming another attempt
      // (Phase 10 semantics).
      entry.status = "interrupted";
      setStatus(mainIssue, "in_progress");
      appendEvent(options.runDir, "reconciled", { issue: id, status: "interrupted", followUps });
      appendEvent(options.runDir, "interrupted", { issue: id, stage: runnerStage(id) });
    } else if (result.code === 0 && copyStatus === "done") {
      entry.status = "done_awaiting_gate";
      setStatus(mainIssue, "in_progress");
      appendEvent(options.runDir, "reconciled", { issue: id, status: "done", followUps });
    } else if (result.code === 1 && copyStatus === "blocked") {
      entry.status = "blocked";
      entry.blockReason = "retries_exhausted";
      setStatus(mainIssue, "blocked");
      appendEvent(options.runDir, "reconciled", { issue: id, status: "blocked", followUps });
      appendEvent(options.runDir, "blocked", { issue: id, reason: "retries_exhausted" });
    } else {
      fail(`runner for ${id} produced unexpected outcome: exit ${result.code}, copy status ${copyStatus}`);
    }
  }
  saveState(options.runDir, state);

  const settled = state.batch.filter(id => !["selected", "running", "interrupted"].includes(state.issues[id].status));
  const interruptedIds = state.batch.filter(id => state.issues[id].status === "interrupted");

  // Contentious file overlap across branch diffs is checked before gates.
  // Uncoordinated shared files defer the lower-priority (higher-numbered)
  // issue: both branches stay intact, the deferred issue is blocked, and only
  // the priority issue reaches a gate. Mutually coordinated overlap proceeds
  // to gates and is resolved by the merge queue itself.
  const diffs = {};
  for (const id of settled) {
    const r = git(options.repo, ["diff", "--name-only", `${state.batchBase}...sandbox/${id}`]);
    diffs[id] = r.stdout.trim().split("\n").filter(Boolean).sort();
    state.issues[id].branchFiles = diffs[id];
  }
  const pairs = [];
  const deferredIds = new Set();
  for (let i = 0; i < settled.length; i += 1) {
    for (let j = i + 1; j < settled.length; j += 1) {
      const a = settled[i];
      const b = settled[j];
      const sharedFiles = diffs[a].filter(f => diffs[b].includes(f));
      if (sharedFiles.length === 0) continue;
      const coordinated = byId.get(a)?.coordination?.includes(b) && byId.get(b)?.coordination?.includes(a);
      if (!coordinated) {
        deferredIds.add(b);
        state.issues[b].status = "deferred_contention";
        state.issues[b].blockReason = "file_overlap";
        state.issues[b].sharedFiles = sharedFiles;
        setStatus(parseIssue(path.join(options.backlog, `${b}.md`)), "blocked");
        appendEvent(options.runDir, "deferred", { issue: b, reason: "file_overlap", sharedFiles, priority: a });
        pairs.push({ a, b, sharedFiles, deferred: b });
      } else {
        pairs.push({ a, b, sharedFiles, coordinated: true });
      }
    }
  }
  appendEvent(options.runDir, "contention_check", { pairs });
  writeAtomic(path.join(options.runDir, "contention-report.json"), `${JSON.stringify({ base: state.batchBase, pairs, deferred: [...deferredIds] }, null, 2)}\n`);

  for (const id of settled) {
    if (state.issues[id].status !== "done_awaiting_gate") continue;
    if (state.mergeQueue.some(q => q.issue === id)) continue; // already prepared before an interruption
    const gate = {
      issue: id,
      branch: `sandbox/${id}`,
      base: state.batchBase,
      preparedAt: new Date().toISOString(),
      humanApprovalRequiredFor: ["merge", "push", "deploy"],
      approved: false,
      approvedAt: null,
      approvedBy: null,
      merged: false
    };
    writeAtomic(gateFile(id), `${JSON.stringify(gate, null, 2)}\n`);
    state.issues[id].status = "gate_prepared";
    state.mergeQueue.push({ issue: id, approved: false, merged: false });
    appendEvent(options.runDir, "gate_prepared", { issue: id, base: state.batchBase });
  }

  if (interruptedIds.length > 0) {
    // Settled siblings keep their prepared gates; the interrupted issue stays
    // resumable and the run stops so a human can decide when to resume.
    state.phase = "interrupted";
    stop(options.runDir, state, "interrupted", INTERRUPTED, {
      batch: state.batch,
      interrupted: interruptedIds,
      pendingGates: state.mergeQueue.filter(q => !q.merged).map(q => q.issue)
    });
  }
  state.phase = "merge_pending";
  saveState(options.runDir, state);
}

// ---------------------------------------------------------------------------
// Authorization: the recorded explicit human gate. No merge can execute
// without a gate file whose approved flag was set by --authorize-merge.
// ---------------------------------------------------------------------------
if (options.authorizeMerge.length > 0) {
  if (!["merge_pending", "merge_queue", "merge_queue_done"].includes(state.phase))
    fail(`--authorize-merge requires a prepared batch (phase ${state.phase}); run --resume first if prepare was interrupted`);
  for (const id of options.authorizeMerge) {
    const queueEntry = state.mergeQueue.find(q => q.issue === id);
    if (!queueEntry) fail(`--authorize-merge: no prepared merge gate for ${id}`);
    const gate = JSON.parse(fs.readFileSync(gateFile(id), "utf8"));
    if (!gate.approved) {
      gate.approved = true;
      gate.approvedAt = new Date().toISOString();
      gate.approvedBy = "human-cli (--authorize-merge)";
      writeAtomic(gateFile(id), `${JSON.stringify(gate, null, 2)}\n`);
      appendEvent(options.runDir, "merge_authorized", { issue: id, approvedBy: gate.approvedBy });
    }
    queueEntry.approved = true;
  }
  saveState(options.runDir, state);
  state.phase = "merge_queue";
}

// ---------------------------------------------------------------------------
// Sequential merge queue: one merge at a time, full post-merge checks before
// the merge commit lands, protected refs verified against the recorded chain.
// ---------------------------------------------------------------------------
if (state.phase === "merge_queue") {
  // Fail-closed protected-ref failure: revoke every unmerged gate, block
  // every in-flight issue, and stop. Used both by the queue-entry checkpoint
  // and by any per-merge drift or refused (compare-and-swap) landing.
  const failClosedRefs = detail => {
    for (const id of state.batch) {
      if (["merged"].includes(state.issues[id]?.status)) continue;
      state.issues[id].status = "failed_closed_refs";
      setStatus(parseIssue(path.join(options.backlog, `${id}.md`)), "blocked");
      const gatePath = gateFile(id);
      if (fs.existsSync(gatePath)) {
        const gate = JSON.parse(fs.readFileSync(gatePath, "utf8"));
        gate.approved = false;
        gate.revoked = true;
        gate.revokedAt = new Date().toISOString();
        gate.revocationReason = "protected_refs_mutated";
        writeAtomic(gatePath, `${JSON.stringify(gate, null, 2)}\n`);
      }
    }
    appendEvent(options.runDir, "fail_closed", { reason: "protected_refs_mutated", ...detail });
    state.mergeQueue = (state.mergeQueue || []).map(q => ({ ...q, approved: false }));
    stop(options.runDir, state, "protected_refs_mutated", 1, { failed: state.batch });
  };

  // Fail-closed protected-ref checkpoint at queue entry: main/production
  // must still sit exactly at the recorded expected commits.
  const actualMain = refSha(options.repo, "refs/heads/main");
  const actualProduction = refSha(options.repo, "refs/heads/production");
  const expectedProduction = state.protectedBaseline?.["refs/heads/production"] || null;
  const chainIntact = actualMain === state.expectedMainSha && actualProduction === expectedProduction;
  writeAtomic(path.join(options.runDir, "refs-checkpoint.json"), `${JSON.stringify({
    at: new Date().toISOString(),
    expectedMain: state.expectedMainSha,
    actualMain,
    expectedProduction,
    actualProduction,
    chainIntact
  }, null, 2)}\n`);
  if (!chainIntact) {
    failClosedRefs({ actualMain, expectedMain: state.expectedMainSha, checkpoint: "queue_entry" });
  }

  const queue = [...state.mergeQueue]
    .filter(q => q.approved && !q.merged)
    .sort((a, b) => idNumber(a.issue) - idNumber(b.issue));
  for (const entry of queue) {
    const id = entry.issue;
    const gate = JSON.parse(fs.readFileSync(gateFile(id), "utf8"));
    if (!gate.approved) throw new Error(`merge refused: gate for ${id} is not approved`);

    // Per-merge protected-ref re-check: drift since the last landing (or
    // since queue entry, for the first merge) fails closed BEFORE any merge
    // work starts. This closes the mid-queue window between merges.
    const mainNow = refSha(options.repo, "refs/heads/main");
    const productionNow = refSha(options.repo, "refs/heads/production");
    const expectedProduction = state.protectedBaseline?.["refs/heads/production"] || null;
    if (mainNow !== state.expectedMainSha || productionNow !== expectedProduction) {
      writeAtomic(path.join(options.runDir, "merge", id, "landing-failure.json"), `${JSON.stringify({
        issue: id,
        at: new Date().toISOString(),
        checkpoint: "merge_entry",
        expectedMain: state.expectedMainSha,
        actualMain: mainNow,
        expectedProduction,
        actualProduction: productionNow
      }, null, 2)}\n`);
      failClosedRefs({ issue: id, checkpoint: "merge_entry", expectedMain: state.expectedMainSha, actualMain: mainNow });
    }

    const mergeRoot = path.join(options.runDir, "merge", id);
    const mergeDir = path.join(mergeRoot, "worktree");
    if (fs.existsSync(mergeDir)) {
      git(options.repo, ["worktree", "remove", "--force", mergeDir]);
      if (fs.existsSync(mergeDir)) fs.rmSync(mergeDir, { recursive: true, force: true });
    }
    fs.mkdirSync(mergeRoot, { recursive: true });
    const before = state.expectedMainSha;
    const added = git(options.repo, ["worktree", "add", "--detach", mergeDir, before]);
    if (added.code !== 0) throw new Error(`merge worktree add failed for ${id}: ${added.stderr}`);
    appendEvent(options.runDir, "merge_started", { issue: id, base: before });

    const merged = git(mergeDir, ["merge", "--no-commit", "--no-ff", `sandbox/${id}`]);
    writeAtomic(path.join(mergeRoot, "merge-attempt.log"), `${merged.stdout}${merged.stderr}`);
    if (merged.code !== 0) {
      // Merge conflict: abort cleanly, defer (block) the issue, never force
      // it through. The branch, gate, and conflict evidence all survive.
      git(mergeDir, ["merge", "--abort"]);
      git(mergeDir, ["reset", "--hard", "HEAD"]);
      const refState = {
        status: "blocked",
        blockReason: "merge_conflict",
        mergeRefusedAtMain: shaOf(mergeDir),
        evidence: path.join(mergeRoot, "merge-attempt.log")
      };
      Object.assign(state.issues[id], refState);
      setStatus(parseIssue(path.join(options.backlog, `${id}.md`)), "blocked");
      gate.revoked = true;
      gate.revokedAt = new Date().toISOString();
      gate.revocationReason = "merge_conflict";
      gate.approved = false;
      writeAtomic(gateFile(id), `${JSON.stringify(gate, null, 2)}\n`);
      appendEvent(options.runDir, "merge_conflict", { issue: id, evidence: refState.evidence, refusedAt: refState.mergeRefusedAtMain });
      entry.merged = false;
      entry.approved = false;
      saveState(options.runDir, state);
      continue;
    }

    const fullCheck = spawnSync(process.execPath, [fullCheckAdapter, path.join(options.backlog, `${id}.md`)],
      { cwd: mergeDir, encoding: "utf8", env: { ...process.env } });
    writeAtomic(path.join(mergeRoot, "full-check.log"), `${fullCheck.stdout || ""}${fullCheck.stderr || ""}`);
    appendEvent(options.runDir, "post_merge_check", { issue: id, exitCode: fullCheck.status ?? 1 });
    if ((fullCheck.status ?? 1) !== 0) {
      // Post-merge check failure: abort the merge (main stays unchanged),
      // block the issue fail-closed, continue with the rest of the queue.
      git(mergeDir, ["reset", "--hard", "HEAD"]);
      Object.assign(state.issues[id], {
        status: "blocked",
        blockReason: "post_merge_check_failed",
        evidence: path.join(mergeRoot, "full-check.log")
      });
      setStatus(parseIssue(path.join(options.backlog, `${id}.md`)), "blocked");
      gate.revoked = true;
      gate.revokedAt = new Date().toISOString();
      gate.revocationReason = "post_merge_check_failed";
      gate.approved = false;
      writeAtomic(gateFile(id), `${JSON.stringify(gate, null, 2)}\n`);
      appendEvent(options.runDir, "merge_aborted", { issue: id, reason: "post_merge_check_failed", evidence: path.join(mergeRoot, "full-check.log") });
      entry.merged = false;
      entry.approved = false;
      saveState(options.runDir, state);
      continue;
    }

    const committed = git(mergeDir, ["commit", "-m", `merge ${id} (human-gated)`], {
      GIT_AUTHOR_NAME: "parallel-afk-orchestrator",
      GIT_AUTHOR_EMAIL: "parallel-afk@example.invalid",
      GIT_COMMITTER_NAME: "parallel-afk-orchestrator",
      GIT_COMMITTER_EMAIL: "parallel-afk@example.invalid"
    });
    if (committed.code !== 0) throw new Error(`merge commit failed for ${id}: ${committed.stderr}`);
    const after = git(mergeDir, ["rev-parse", "HEAD"]).stdout.trim();
    // Compare-and-swap landing: the update succeeds only if main still sits
    // at the recorded expected commit. A rogue movement between the merge
    // and the landing (e.g. a hostile git hook during the commit) refuses
    // the landing instead of silently clobbering the movement.
    const landed = git(options.repo, ["update-ref", "refs/heads/main", after, before]);
    if (landed.code !== 0 || refSha(options.repo, "refs/heads/main") !== after) {
      writeAtomic(path.join(mergeRoot, "landing-failure.json"), `${JSON.stringify({
        issue: id,
        at: new Date().toISOString(),
        checkpoint: "landing",
        expectedMain: before,
        attemptedLanding: after,
        actualMain: refSha(options.repo, "refs/heads/main"),
        stderr: landed.stderr
      }, null, 2)}\n`);
      failClosedRefs({ issue: id, checkpoint: "landing", expectedMain: before, attemptedLanding: after, actualMain: refSha(options.repo, "refs/heads/main"), evidence: path.join(mergeRoot, "landing-failure.json") });
    }

    gate.merged = true;
    gate.mergedAt = new Date().toISOString();
    gate.mergeCommit = after;
    writeAtomic(gateFile(id), `${JSON.stringify(gate, null, 2)}\n`);
    entry.merged = true;
    state.expectedMainSha = after;
    state.issues[id].status = "merged";
    setStatus(parseIssue(path.join(options.backlog, `${id}.md`)), "done");
    appendEvent(options.runDir, "merge_completed", { issue: id, before, after });
    saveState(options.runDir, state);
  }
  state.phase = "merge_queue_done";
  saveState(options.runDir, state);
}

const failed = state.batch.filter(id => ["blocked", "deferred_contention", "failed_closed_refs"].includes(state.issues[id]?.status));
const pendingGates = (state.mergeQueue || []).filter(q => !q.merged && !failed.includes(q.issue));
const stopReason = failed.length > 0 ? "issues_blocked"
  : pendingGates.length > 0 ? "merge_gate_pending"
  : state.batch.length === 0 ? (state.stopReason || "empty_ready_queue")
  : "batch_complete";
stop(options.runDir, state, stopReason, failed.length > 0 ? 1 : 0, {
  merged: state.batch.filter(id => state.issues[id]?.status === "merged"),
  blocked: failed,
  pendingGates: pendingGates.map(q => q.issue)
});
