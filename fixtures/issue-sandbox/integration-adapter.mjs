#!/usr/bin/env node
// Phase 11 integration adapter: wraps the Phase 10 fixture adapter in the
// issue sandbox so the sequential runner's implement/check/review stages all
// execute inside the isolated worktree with the sandbox policy.
import fs from "node:fs";
import path from "node:path";
import { sandboxRun } from "./sandbox.mjs";

const args = process.argv.slice(2);
const [stage, issueFile] = args;
if (!stage || !issueFile) {
  process.stderr.write("integration adapter requires stage and issue file arguments\n");
  process.exit(2);
}
const issueText = fs.readFileSync(issueFile, "utf8");
const id = issueText.match(/^(ISSUE-\d+):/m)?.[1];
if (!id) {
  process.stderr.write("issue file is missing its header\n");
  process.exit(2);
}
const attempt = Number(stage === "implement" ? args[3] : stage === "check" ? args[4] : args[5]);
const repo = process.env.SANDBOX_INTEGRATION_REPO;
const runDir = process.env.SANDBOX_INTEGRATION_RUN_DIR;
if (!repo || !runDir) {
  process.stderr.write("SANDBOX_INTEGRATION_REPO and SANDBOX_INTEGRATION_RUN_DIR are required\n");
  process.exit(2);
}
const phase10Adapter = new URL("../sequential-afk-runner/adapter.mjs", import.meta.url).pathname;
try {
  // Copy the adapter into the sandbox filesystem scope: node's main-path
  // resolution uses the patched public fs API, so the entry script must be
  // readable inside the sandbox.
  const attemptDir = path.join(runDir, id, `attempt-${attempt}`);
  const toolsDir = path.join(attemptDir, "tools");
  fs.mkdirSync(toolsDir, { recursive: true });
  const innerAdapter = path.join(toolsDir, "phase10-adapter.mjs");
  fs.copyFileSync(phase10Adapter, innerAdapter);
  const outcome = sandboxRun({ repo, runDir, issue: id, attempt, command: [process.execPath, innerAdapter, ...args] });
  process.exit(outcome.code);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(2);
}
