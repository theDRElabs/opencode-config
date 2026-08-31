import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2];
const runner = path.join(root, "runner.mjs");
const adapter = path.join(root, "adapter.mjs");

const issue = (id, status, type, blockers, scenario) => `${id}: Exercise ${scenario}\nSTATUS: ${status}\nTYPE: ${type}\nBLOCKERS: ${blockers}\nOUTCOME: The ${scenario} fixture is handled.\nACCEPTANCE:\n- The observable fixture result is recorded.\nLAYERS: fixture\nMODULES: fixture only\nTESTS: fixture test\nCOMMANDS: fixture test\nCONSTRAINTS: SCENARIO=${scenario}\nNON-GOALS: Human acceptance, merge, deploy, isolation\n`;

function setup(name, issues) {
  const base = path.join(out, name);
  const backlog = path.join(base, "backlog");
  fs.mkdirSync(backlog, { recursive: true });
  for (const [id, body] of issues) fs.writeFileSync(path.join(backlog, `${id}.md`), body);
  return { base, backlog, run: path.join(base, "run") };
}

function invoke(fixture, extras = [], expected = 0) {
  const args = [runner, "--backlog", fixture.backlog, "--run-dir", fixture.run,
    "--implement", adapter, "--check", adapter, "--review", adapter,
    "--max-iterations", "10", "--max-retries", "2", ...extras];
  const result = spawnSync(process.execPath, args, { encoding: "utf8", env: { ...process.env, INTERRUPT_MARKERS: path.join(fixture.base, "markers") } });
  if (result.status !== expected) throw new Error(`${fixture.base}: expected ${expected}, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function status(fixture, id) {
  return fs.readFileSync(path.join(fixture.backlog, `${id}.md`), "utf8").match(/^STATUS:\s*(\S+)/m)[1];
}

function state(fixture) { return JSON.parse(fs.readFileSync(path.join(fixture.run, "state.json"), "utf8")); }
function assert(value, message) { if (!value) throw new Error(message); }

const success = setup("success", [["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "success")]]);
invoke(success);
assert(status(success, "ISSUE-001") === "done", "success was not completed");
assert(state(success).completed[0] === "ISSUE-001" && state(success).stopReason === "empty_ready_queue", "success result is incomplete");
const result = JSON.parse(fs.readFileSync(path.join(success.run, "ISSUE-001/attempt-1/result.json"), "utf8"));
assert(result.gates.review === "PASS" && result.humanAcceptance === false, "completion gates or ownership are wrong");

const blockers = setup("blockers", [
  ["ISSUE-001", issue("ISSUE-001", "blocked", "afk", "ISSUE-999", "success")],
  ["ISSUE-002", issue("ISSUE-002", "ready", "afk", "ISSUE-001", "success")]
]);
invoke(blockers);
assert(state(blockers).stopReason === "blocked_queue" && status(blockers, "ISSUE-002") === "ready", "blocked queue was mishandled");

const failed = setup("failed-tests", [["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "failed-tests")]]);
invoke(failed);
assert(status(failed, "ISSUE-001") === "done" && fs.existsSync(path.join(failed.run, "ISSUE-001/attempt-2/checks.json")), "failed test retry did not recover");

const review = setup("review-findings", [["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "review-finding")]]);
invoke(review);
assert(status(review, "ISSUE-001") === "done", "review retry did not recover");
const followups = fs.readdirSync(review.backlog).filter(name => name !== "ISSUE-001.md");
assert(followups.length === 1 && fs.readFileSync(path.join(review.backlog, followups[0]), "utf8").includes("STATUS: blocked"), "review follow-up was not created");

const hitl = setup("hitl", [["ISSUE-001", issue("ISSUE-001", "ready", "hitl", "none", "success")]]);
invoke(hitl);
assert(state(hitl).stopReason === "human_required" && status(hitl, "ISSUE-001") === "ready", "HITL work was selected or hidden");

const interrupted = setup("interruption", [["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "interrupt")]]);
invoke(interrupted, [], 75);
assert(state(interrupted).stopReason === "interrupted" && state(interrupted).current.stage === "check", "interruption state was not preserved");
invoke(interrupted, ["--resume"]);
assert(status(interrupted, "ISSUE-001") === "done" && state(interrupted).completed.includes("ISSUE-001"), "resume did not finish the exact issue");

const empty = setup("empty", [["ISSUE-001", issue("ISSUE-001", "done", "afk", "none", "success")]]);
invoke(empty);
assert(state(empty).stopReason === "empty_ready_queue", "empty queue stop was wrong");

const dry = setup("dry-run", [["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "success")]]);
const dryResult = invoke(dry, ["--dry-run"]);
assert(status(dry, "ISSUE-001") === "ready" && !fs.existsSync(dry.run) && dryResult.stdout.includes('"selected":"ISSUE-001"'), "dry run mutated state or missed selection");

const bounded = setup("bounded", [
  ["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "success")],
  ["ISSUE-002", issue("ISSUE-002", "ready", "afk", "none", "success")]
]);
invoke(bounded, ["--max-iterations", "1"]);
assert(status(bounded, "ISSUE-001") === "done" && status(bounded, "ISSUE-002") === "ready" && state(bounded).stopReason === "iteration_limit", "iteration bound failed");

const exhausted = setup("retry-exhaustion", [["ISSUE-001", issue("ISSUE-001", "ready", "afk", "none", "failed-tests")]]);
invoke(exhausted, ["--max-retries", "0"], 1);
assert(status(exhausted, "ISSUE-001") === "blocked" && state(exhausted).stopReason === "retries_exhausted", "retry exhaustion failed closed incorrectly");

const malformedBody = "ISSUE-001: Truncated fixture issue\nSTATUS: ready\n";
const malformed = setup("malformed-input", [["ISSUE-001", malformedBody]]);
invoke(malformed, [], 1);
assert(!fs.existsSync(path.join(malformed.run, "state.json")), "malformed input produced run state");
assert(fs.readFileSync(path.join(malformed.backlog, "ISSUE-001.md"), "utf8") === malformedBody, "malformed input mutated the backlog");

const ordering = setup("numeric-ordering", [
  ["ISSUE-10", issue("ISSUE-10", "ready", "afk", "none", "success")],
  ["ISSUE-2", issue("ISSUE-2", "ready", "afk", "none", "success")]
]);
invoke(ordering);
assert(state(ordering).completed[0] === "ISSUE-2" && state(ordering).completed[1] === "ISSUE-10", "numeric ID ordering failed");
assert(status(ordering, "ISSUE-2") === "done" && status(ordering, "ISSUE-10") === "done", "numeric ordering fixture did not complete both issues");

console.log("success, blockers, failed tests, review findings, HITL, interruption/resumption, empty queue, dry run, bounds, retry exhaustion, malformed input, and numeric ordering passed");
