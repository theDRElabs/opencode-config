#!/usr/bin/env node
// Phase 12 sandbox stage adapter: wraps the Phase 12 fixture adapter in the
// Phase 11 issue sandbox so the sequential runner's implement/check/review
// stages execute inside the isolated worktree. Mirrors the Phase 11
// integration adapter, but the inner adapter path is taken from
// SANDBOX_STAGE_ADAPTER so the parallel orchestrator can supply it.
import fs from "node:fs";
import path from "node:path";
import { sandboxRun } from "../issue-sandbox/sandbox.mjs";

const args = process.argv.slice(2);
const [stage, issueFile] = args;
if (!stage || !issueFile) {
  process.stderr.write("sandbox stage adapter requires stage and issue file arguments\n");
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
const innerAdapter = process.env.SANDBOX_STAGE_ADAPTER;
if (!repo || !runDir || !innerAdapter) {
  process.stderr.write("SANDBOX_INTEGRATION_REPO, SANDBOX_INTEGRATION_RUN_DIR, and SANDBOX_STAGE_ADAPTER are required\n");
  process.exit(2);
}
try {
  // Copy the inner adapter into the sandbox filesystem scope before the run:
  // node's entry-script resolution uses the patched public fs API, so the
  // script must be readable inside the sandbox.
  const attemptDir = path.join(runDir, id, `attempt-${attempt}`);
  const toolsDir = path.join(attemptDir, "tools");
  fs.mkdirSync(toolsDir, { recursive: true });
  const inner = path.join(toolsDir, "parallel-adapter.mjs");
  fs.copyFileSync(innerAdapter, inner);
  const outcome = sandboxRun({ repo, runDir, issue: id, attempt, command: [process.execPath, inner, ...args] });
  process.exit(outcome.code);
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exit(2);
}
