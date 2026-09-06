#!/usr/bin/env node
// Phase 12 full post-merge check adapter. Runs OUTSIDE the sandbox in the
// orchestrator's dedicated merge worktree (invoked only by the orchestrator
// between a recorded human-gated merge and its commit). Verifies the merged
// tree: every .js file must pass node --check and the merged issue's expected
// files must exist. SCENARIO=post-merge-failure simulates a full-suite
// regression that only the merged combination exposes, and fails closed.
// Usage: node full-check.mjs <issue-file>
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const issueFile = process.argv[2];
if (!issueFile) {
  process.stderr.write("full-check adapter requires the issue file argument\n");
  process.exit(2);
}
const issueText = fs.readFileSync(issueFile, "utf8");
const id = issueText.match(/^(ISSUE-\d+):/m)?.[1];
const constraints = issueText.match(/^CONSTRAINTS:\s*(.+)$/m)?.[1] || "";
const scenario = constraints.match(/SCENARIO=(\S+)/)?.[1] || "success";
if (!id) {
  process.stderr.write("issue file is missing its header\n");
  process.exit(2);
}

function collectJs(dir, acc = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) collectJs(p, acc);
    else if (entry.name.endsWith(".mjs") || entry.name.endsWith(".js")) acc.push(p);
  }
  return acc;
}

const checks = [];
for (const file of collectJs(process.cwd())) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ["--check", file], { cwd: process.cwd(), encoding: "utf8" });
  checks.push({
    name: `node --check ${path.relative(process.cwd(), file)}`,
    command: [process.execPath, "--check", path.relative(process.cwd(), file)],
    cwd: process.cwd(),
    environment: "merge-worktree",
    duration_ms: Date.now() - t0,
    exit_code: r.status ?? 1,
    result: (r.status ?? 1) === 0 ? "PASS" : "FAIL",
    evidence: "full-check.log"
  });
}
for (const expected of [`src/${id}.mjs`].concat(scenario === "overlap" || scenario === "coordinated-conflict" ? ["src/shared.txt"] : [])) {
  const present = fs.existsSync(expected);
  checks.push({
    name: `merged file present (${expected})`,
    command: ["fs.existsSync", expected],
    cwd: process.cwd(),
    environment: "merge-worktree",
    duration_ms: 0,
    exit_code: present ? 0 : 1,
    result: present ? "PASS" : "FAIL",
    evidence: "full-check.log"
  });
}
let reason = null;
if (scenario === "post-merge-failure") {
  reason = `simulated full-suite regression: merged combination of ${id} fails the full check set`;
  checks.push({
    name: "full-suite regression",
    command: ["fixture", scenario],
    cwd: process.cwd(),
    environment: "merge-worktree",
    duration_ms: 0,
    exit_code: 1,
    result: "FAIL",
    evidence: "full-check.log"
  });
}
const allPassed = checks.every(c => c.exit_code === 0);
process.stdout.write(`${JSON.stringify({ issue: id, scenario, checks, allPassed, reason }, null, 2)}\n`);
process.exit(allPassed ? 0 : 1);
