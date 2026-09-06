#!/usr/bin/env node
// Phase 12 fixture adapter. Runs INSIDE the Phase 11 issue sandbox with cwd
// = the per-issue worktree on branch sandbox/<issue-id>. Stage contract and
// argument positions mirror the Phase 10 fixture adapter:
//   implement: args = [implement, issueFile, implementationResult, attempt, priorEvidence]
//   check:     args = [check, issueFile, implementationResult, checksJson, attempt]
//   review:    args = [review, issueFile, implementationResult, checksJson, reviewMd, attempt]
// Scenario behavior is driven by CONSTRAINTS: SCENARIO=<name> [PAUSE=<ms>].
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const [stage, issueFile] = args;
const output = stage === "implement" ? args[2] : stage === "check" ? args[3] : args[4];
const attempt = Number(stage === "implement" ? args[3] : stage === "check" ? args[4] : args[5]);
if (!stage || !issueFile || !output || !Number.isInteger(attempt)) {
  process.stderr.write("parallel adapter requires stage, issue file, output, and attempt arguments\n");
  process.exit(2);
}
const issueText = fs.readFileSync(issueFile, "utf8");
const id = issueText.match(/^(ISSUE-\d+):/m)?.[1];
const constraints = issueText.match(/^CONSTRAINTS:\s*(.+)$/m)?.[1] || "";
const scenario = constraints.match(/SCENARIO=(\S+)/)?.[1] || "success";
const pause = Number(constraints.match(/PAUSE=(\d+)/)?.[1] || 0);
if (!id) {
  process.stderr.write("issue file is missing its header\n");
  process.exit(2);
}

const sharedFiles = new Set(["overlap", "coordinated-conflict"]);
function sourceFile() { return path.join("src", `${id}.mjs`); }
function validSource() {
  return `// ${id} implementation (attempt ${attempt})\nexport const id = "${id}";\nexport const attempt = ${attempt};\n`;
}
function brokenSource() {
  // Proven to fail `node --check` on an .mjs file (Node 24: .js files with
  // ESM syntax silently pass --check even when broken, so sources are .mjs).
  return `// ${id} broken first attempt (genuine red)\nexport const id = "${id}";\nexport const broken = ;\n`;
}
function sharedContent() {
  // Both coordinated-conflicting branches add src/shared.txt with different
  // content (add/add), which deterministically conflicts at merge time.
  return `shared-value: ${id}\n`;
}

function gitRun(gitArgs) {
  const r = spawnSync("git", gitArgs, { cwd: process.cwd(), encoding: "utf8" });
  return { code: r.status ?? 1, output: `${r.stdout || ""}${r.stderr || ""}` };
}

if (stage === "implement") {
  if (pause > 0) {
    // Deterministic wall-clock presence so the orchestrator can prove the two
    // sandboxed implementer processes actually ran concurrently.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pause);
  }
  fs.mkdirSync("src", { recursive: true });
  const files = [];
  if (scenario === "failed-tests" && attempt === 1) {
    fs.writeFileSync(sourceFile(), brokenSource());
  } else {
    fs.writeFileSync(sourceFile(), validSource());
  }
  files.push(sourceFile());
  if (sharedFiles.has(scenario)) {
    fs.writeFileSync(path.join("src", "shared.txt"), sharedContent());
    files.push("src/shared.txt");
  }
  const added = gitRun(["add", "-A", "."]);
  if (added.code !== 0) throw new Error(`git add failed: ${added.output}`);
  const committed = gitRun(["commit", "-m", `${id} implement attempt ${attempt}`]);
  if (committed.code !== 0) throw new Error(`git commit failed: ${committed.output}`);
  fs.writeFileSync(output, `# Implementation Result\nISSUE: ${id}\nATTEMPT: ${attempt}\nCONTEXT: sandbox-fresh-process-${process.pid}\nFILES: ${files.join(", ")}\nRED: ${scenario === "failed-tests" && attempt === 1 ? "exit 1 (broken source caught by node --check)" : "exit 1 behavior gap (fixture premise)"}\nGREEN: node --check src/${id}.js exit 0\nREFACTOR: not required for fixture\nHUMAN_ACCEPTANCE: false\n`);
  process.exit(0);
}

if (stage === "check") {
  if (scenario === "interrupt") {
    const marker = path.join(process.env.SANDBOX_ATTEMPT_DIR || ".", "interrupt.marker");
    if (!fs.existsSync(marker)) {
      fs.writeFileSync(marker, "interrupted\n");
      process.exit(75);
    }
  }
  const checks = [];
  const t0 = Date.now();
  const check = spawnSync(process.execPath, ["--check", sourceFile()], { cwd: process.cwd(), encoding: "utf8" });
  checks.push({
    name: `node --check ${sourceFile()}`,
    command: [process.execPath, "--check", sourceFile()],
    cwd: process.cwd(),
    environment: "issue-sandbox",
    duration_ms: Date.now() - t0,
    exit_code: check.status ?? 1,
    result: (check.status ?? 1) === 0 ? "PASS" : "FAIL",
    evidence: "adapter.log"
  });
  if (sharedFiles.has(scenario)) {
    const present = fs.existsSync(path.join("src", "shared.txt"));
    checks.push({
      name: "shared file present (src/shared.txt)",
      command: ["fs.existsSync", "src/shared.txt"],
      cwd: process.cwd(),
      environment: "issue-sandbox",
      duration_ms: 0,
      exit_code: present ? 0 : 1,
      result: present ? "PASS" : "FAIL",
      evidence: "adapter.log"
    });
  }
  const allPassed = checks.every(c => c.exit_code === 0);
  fs.writeFileSync(output, `${JSON.stringify({ issue: id, attempt, checks, allPassed }, null, 2)}\n`);
  process.exit(allPassed ? 0 : 1);
}

if (stage === "review") {
  const pass = !(scenario === "review-finding" && attempt === 1);
  fs.writeFileSync(output, `VERDICT: ${pass ? "PASS" : "FAIL"}\nBLOCKING_FINDINGS: ${pass ? "None" : `HIGH ${sourceFile()}:1 attempt ${attempt} seeded review defect requires correction before merge`}\nNON_BLOCKING_FINDINGS: None\nACCEPTANCE_COVERAGE: covered\nVERIFICATION_EVIDENCE: checks.json from attempt ${attempt}\nRESIDUAL_RISKS: Human acceptance, merge approval, and deploy remain human-owned\nREVIEW_CONTEXT: sandbox-fresh-process-${process.pid} (branch sandbox/${id})\n`);
  process.exit(pass ? 0 : 1);
}

process.stderr.write(`unknown adapter stage ${stage}\n`);
process.exit(2);
