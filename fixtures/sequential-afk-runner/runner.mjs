#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const INTERRUPTED = 75;

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const options = { maxIterations: 1, maxRetries: 0, dryRun: false, resume: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--resume") options.resume = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[++i];
      if (!value) fail(`missing value for ${arg}`);
      const names = {
        backlog: "backlog", "run-dir": "runDir", implement: "implement",
        check: "check", review: "review", "max-iterations": "maxIterations",
        "max-retries": "maxRetries"
      };
      if (!names[key]) fail(`unknown option ${arg}`);
      options[names[key]] = value;
    } else fail(`unexpected argument ${arg}`);
  }
  for (const key of ["backlog", "runDir", "implement", "check", "review"])
    if (!options[key]) fail(`--${key.replace(/[A-Z]/g, m => `-${m.toLowerCase()}`)} is required`);
  options.maxIterations = Number(options.maxIterations);
  options.maxRetries = Number(options.maxRetries);
  if (!Number.isInteger(options.maxIterations) || options.maxIterations < 1)
    fail("--max-iterations must be a positive integer");
  if (!Number.isInteger(options.maxRetries) || options.maxRetries < 0 || options.maxRetries > 2)
    fail("--max-retries must be an integer from 0 through 2");
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
    file, text
  };
  for (const key of ["status", "type", "blockersText", "commands", "constraints"])
    if (!issue[key]) throw new Error(`${file}: missing ${key}`);
  issue.blockers = issue.blockersText === "none" ? [] : issue.blockersText.split(",").map(v => v.trim());
  return issue;
}

function loadIssues(backlog) {
  const files = fs.readdirSync(backlog).filter(name => /^ISSUE-\d+\.md$/.test(name));
  return files.map(name => parseIssue(path.join(backlog, name))).sort((a, b) => idNumber(a.id) - idNumber(b.id));
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

function runAdapter(command, args, cwd, logFile) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", env: { ...process.env } });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  writeAtomic(logFile, output);
  return { code: result.status ?? 1, error: result.error?.message };
}

function verdict(file) {
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8").match(/^VERDICT:\s*(PASS|FAIL|BLOCKED)$/m)?.[1] || null;
}

function followUp(backlog, issue, reviewFile, attempt) {
  const existing = fs.readdirSync(backlog).filter(name => /^ISSUE-\d+\.md$/.test(name));
  const number = Math.max(0, ...existing.map(name => Number(name.match(/\d+/)[0]))) + 1;
  const id = `ISSUE-${String(number).padStart(3, "0")}`;
  const evidence = fs.readFileSync(reviewFile, "utf8").replace(/\s+/g, " ").trim();
  const body = `${id}: Resolve review findings for ${issue.id}\nSTATUS: blocked\nTYPE: afk\nBLOCKERS: ${issue.id}\nOUTCOME: ${issue.id} has no unresolved independent-review findings.\nACCEPTANCE:\n- The cited review findings are corrected and covered by deterministic tests.\nLAYERS: ${issue.id} changed surface\nMODULES: Same boundaries as ${issue.id}; human approval required for changes\nTESTS: Re-run ${issue.commands}\nCOMMANDS: ${issue.commands}\nCONSTRAINTS: Generated from attempt ${attempt}; review evidence: ${evidence}\nNON-GOALS: New features, merge, deployment, or acceptance of risk\n`;
  writeAtomic(path.join(backlog, `${id}.md`), body);
  return id;
}

function stop(runDir, state, reason, code = 0) {
  state.stopReason = reason;
  state.updatedAt = new Date().toISOString();
  saveState(runDir, state);
  appendEvent(runDir, "stop", { reason });
  process.exit(code);
}

const options = parseArgs(process.argv.slice(2));
if (!fs.existsSync(options.backlog) || !fs.statSync(options.backlog).isDirectory()) fail("backlog directory does not exist");

if (options.dryRun) {
  const issues = loadIssues(options.backlog);
  const done = new Set(issues.filter(i => i.status === "done").map(i => i.id));
  const ready = issues.filter(i => i.status === "ready" && i.type === "afk" && i.commands !== "UNKNOWN" && i.blockers.every(id => done.has(id))).sort((a, b) => idNumber(a.id) - idNumber(b.id));
  process.stdout.write(`${JSON.stringify({ stopReason: "dry_run", selected: ready[0]?.id || null, invokedAdapters: false })}\n`);
  process.exit(0);
}

fs.mkdirSync(options.runDir, { recursive: true });
const lock = path.join(options.runDir, "runner.lock");
let lockFd;
try { lockFd = fs.openSync(lock, "wx"); } catch { fail(`run lock exists: ${lock}`); }
process.on("exit", () => { try { fs.closeSync(lockFd); fs.unlinkSync(lock); } catch {} });

const stateFile = path.join(options.runDir, "state.json");
let state = { version: 1, completed: [], current: null, iterations: 0, maxRetries: options.maxRetries };
if (options.resume) {
  if (!fs.existsSync(stateFile)) fail("--resume requires existing state.json");
  state = JSON.parse(fs.readFileSync(stateFile, "utf8"));
  appendEvent(options.runDir, "resume", { issue: state.current?.issue || null, stage: state.current?.stage || null });
} else if (fs.existsSync(stateFile)) fail("existing run state requires --resume or a new --run-dir");

while (state.iterations < options.maxIterations) {
  let issues = loadIssues(options.backlog);
  let issue;
  if (state.current) {
    issue = issues.find(i => i.id === state.current.issue);
    if (!issue) stop(options.runDir, state, "current_issue_missing", 2);
  } else {
    const done = new Set(issues.filter(i => i.status === "done").map(i => i.id));
    const candidates = issues.filter(i => i.status === "ready" && i.type === "afk" && i.commands !== "UNKNOWN" && i.blockers.every(id => done.has(id))).sort((a, b) => idNumber(a.id) - idNumber(b.id));
    issue = candidates[0];
    if (!issue) {
      const hitl = issues.some(i => i.type === "hitl" && i.status !== "done");
      const blocked = issues.some(i => i.status === "blocked" || i.blockers.some(id => !done.has(id)));
      stop(options.runDir, state, hitl ? "human_required" : blocked ? "blocked_queue" : "empty_ready_queue");
    }
    setStatus(issue, "in_progress");
    state.current = { issue: issue.id, attempt: 1, stage: "implement" };
    saveState(options.runDir, state);
    appendEvent(options.runDir, "selected", { issue: issue.id });
    issue = parseIssue(issue.file);
  }

  const current = state.current;
  const attemptDir = path.join(options.runDir, issue.id, `attempt-${current.attempt}`);
  fs.mkdirSync(attemptDir, { recursive: true });
  const issueCopy = path.join(attemptDir, "issue.md");
  if (!fs.existsSync(issueCopy)) fs.copyFileSync(issue.file, issueCopy);
  writeAtomic(path.join(attemptDir, "input-manifest.json"), `${JSON.stringify({ issue: issue.id, attempt: current.attempt, priorEvidence: current.priorEvidence || null }, null, 2)}\n`);
  const implementation = path.join(attemptDir, "implementation-result.md");
  const checks = path.join(attemptDir, "checks.json");
  const review = path.join(attemptDir, "review.md");

  const stages = [
    { name: "implement", command: options.implement, args: ["implement", issueCopy, implementation, String(current.attempt), current.priorEvidence || ""], output: implementation },
    { name: "check", command: options.check, args: ["check", issueCopy, implementation, checks, String(current.attempt)], output: checks },
    { name: "review", command: options.review, args: ["review", issueCopy, implementation, checks, review, String(current.attempt)], output: review }
  ];
  let retry = false;
  for (const stage of stages.slice(stages.findIndex(s => s.name === current.stage))) {
    current.stage = stage.name;
    saveState(options.runDir, state);
    appendEvent(options.runDir, "stage_start", { issue: issue.id, attempt: current.attempt, stage: stage.name });
    const result = runAdapter(stage.command, stage.args, attemptDir, path.join(attemptDir, `${stage.name}.log`));
    appendEvent(options.runDir, "stage_end", { issue: issue.id, attempt: current.attempt, stage: stage.name, exitCode: result.code, evidence: stage.output });
    if (result.code === INTERRUPTED) stop(options.runDir, state, "interrupted", INTERRUPTED);
    const passed = result.code === 0 && fs.existsSync(stage.output) && (stage.name !== "review" || verdict(review) === "PASS");
    if (!passed) {
      let followUpId = null;
      if (stage.name === "review" && fs.existsSync(review)) followUpId = followUp(options.backlog, issue, review, current.attempt);
      const evidence = fs.existsSync(stage.output) ? stage.output : path.join(attemptDir, `${stage.name}.log`);
      if (current.attempt <= options.maxRetries) {
        current.attempt += 1;
        current.stage = "implement";
        current.priorEvidence = evidence;
        saveState(options.runDir, state);
        appendEvent(options.runDir, "retry", { issue: issue.id, nextAttempt: current.attempt, failedStage: stage.name, followUp: followUpId });
        retry = true;
        break;
      }
      setStatus(parseIssue(issue.file), "blocked");
      stop(options.runDir, state, "retries_exhausted", 1);
    }
    current.stage = stage.name === "implement" ? "check" : stage.name === "check" ? "review" : "complete";
    saveState(options.runDir, state);
  }
  if (retry) continue;

  setStatus(parseIssue(issue.file), "done");
  writeAtomic(path.join(attemptDir, "result.json"), `${JSON.stringify({ issue: issue.id, status: "done", gates: { implementation: "PASS", checks: "PASS", review: "PASS" }, humanAcceptance: false }, null, 2)}\n`);
  state.completed.push(issue.id);
  state.current = null;
  state.iterations += 1;
  saveState(options.runDir, state);
  appendEvent(options.runDir, "completed", { issue: issue.id, humanAcceptance: false });
}

stop(options.runDir, state, "iteration_limit");
