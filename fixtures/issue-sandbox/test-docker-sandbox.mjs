#!/usr/bin/env node
// Docker sandbox adversarial test suite. Tests container isolation,
// resource limits, network denial, and escape attempts.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { dockerSandboxRun } from "./sandbox-docker.mjs";

const root = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2] || "/tmp/opencode/p11-docker-validation";
const logs = path.join(out, "logs");
fs.mkdirSync(logs, { recursive: true });

let passed = 0, failed = 0, skipped = 0;
const results = [];

function assert(condition, message) {
  if (!condition) throw new Error(`ASSERT: ${message}`);
}

function log(name, status, detail) {
  results.push({ name, status, detail });
  const icon = status === "PASS" ? "✓" : status === "FAIL" ? "✗" : "○";
  process.stderr.write(`${icon} ${name}${detail ? `: ${detail}` : ""}\n`);
}

function dockerAvailable() {
  const r = spawnSync("docker", ["info"], { encoding: "utf8", timeout: 10000 });
  return r.status === 0;
}

function setupTestRepo(name) {
  const repoDir = path.join(out, `${name}-repo`);
  const runDir = path.join(out, `${name}-run`);
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.rmSync(runDir, { recursive: true, force: true });
  fs.mkdirSync(repoDir, { recursive: true });
  fs.mkdirSync(runDir, { recursive: true });
  spawnSync("git", ["init", "-q", "-b", "main", "."], { cwd: repoDir, encoding: "utf8" });
  spawnSync("git", ["config", "user.email", "test@test"], { cwd: repoDir });
  spawnSync("git", ["config", "user.name", "test"], { cwd: repoDir });
  fs.writeFileSync(path.join(repoDir, "base.txt"), "base content\n");
  spawnSync("git", ["add", "."], { cwd: repoDir });
  spawnSync("git", ["commit", "-qm", "init"], { cwd: repoDir });
  return { repoDir, runDir };
}

async function runTests() {
  if (!dockerAvailable()) {
    log("docker-availability", "SKIP", "Docker not available");
    process.exit(0);
  }

  // Test 1: Happy path - adapter runs inside container
  try {
    const { repoDir, runDir } = setupTestRepo("happy");
    const adapter = `import fs from "node:fs";\nfs.writeFileSync("docker-ok.txt", "ok\\n");\nprocess.exit(0);\n`;
    const worktree = path.join(runDir, "ISSUE-001", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-001", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"]
    });
    assert(result.code === 0, `exit code ${result.code}`);
    assert(result.run?.docker?.image, "docker image recorded");
    log("happy-path", "PASS", `exit=${result.code}`);
    passed++;
  } catch (e) {
    log("happy-path", "FAIL", e.message);
    failed++;
  }

  // Test 2: Container filesystem isolation - cannot read /etc/shadow
  try {
    const { repoDir, runDir } = setupTestRepo("fs-isolation");
    const adapter = `import fs from "node:fs";\ntry { fs.readFileSync("/etc/shadow", "utf8"); process.exit(0); } catch(e) { process.exit(1); }\n`;
    const worktree = path.join(runDir, "ISSUE-002", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-002", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"]
    });
    assert(result.code === 1, "should fail when reading /etc/shadow");
    log("fs-isolation-etc-shadow", "PASS", "denied as expected");
    passed++;
  } catch (e) {
    log("fs-isolation-etc-shadow", "FAIL", e.message);
    failed++;
  }

  // Test 3: Container filesystem isolation - cannot read host /home
  try {
    const { repoDir, runDir } = setupTestRepo("fs-isolation-home");
    const adapter = `import fs from "node:fs";\ntry { fs.readFileSync("/home/DRE/.config/opencode/opencode.jsonc", "utf8"); process.exit(0); } catch(e) { process.exit(1); }\n`;
    const worktree = path.join(runDir, "ISSUE-003", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-003", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"]
    });
    assert(result.code === 1, "should fail when reading host /home");
    log("fs-isolation-home", "PASS", "denied as expected");
    passed++;
  } catch (e) {
    log("fs-isolation-home", "FAIL", e.message);
    failed++;
  }

  // Test 4: Network isolation - no outbound connections
  try {
    const { repoDir, runDir } = setupTestRepo("network-isolation");
    const adapter = `import http from "node:http";\nconst req = http.get("http://example.com", (res) => { process.exit(0); });\nreq.on("error", () => process.exit(1));\nsetTimeout(() => process.exit(1), 3000);\n`;
    const worktree = path.join(runDir, "ISSUE-004", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-004", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"], networkEnabled: false
    });
    assert(result.code === 1, "should fail when making network request");
    log("network-isolation", "PASS", "denied as expected");
    passed++;
  } catch (e) {
    log("network-isolation", "FAIL", e.message);
    failed++;
  }

  // Test 5: Resource limits - memory
  try {
    const { repoDir, runDir } = setupTestRepo("resource-memory");
    const adapter = `const arr = [];\nwhile(true) arr.push(Buffer.alloc(1024 * 1024));\n`;
    const worktree = path.join(runDir, "ISSUE-005", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-005", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"]
    });
    assert(result.code !== 0, "should fail on memory exhaustion");
    log("resource-memory", "PASS", "killed as expected");
    passed++;
  } catch (e) {
    log("resource-memory", "FAIL", e.message);
    failed++;
  }

  // Test 6: Cannot modify host filesystem from container
  try {
    const { repoDir, runDir } = setupTestRepo("host-fs-write");
    const adapter = `import fs from "node:fs";\ntry { fs.writeFileSync("/tmp/host-escape.txt", "escaped"); process.exit(0); } catch(e) { process.exit(1); }\n`;
    const worktree = path.join(runDir, "ISSUE-006", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-006", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"]
    });
    // Container writes to /tmp inside container, not host /tmp
    const hostFile = "/tmp/host-escape.txt";
    assert(!fs.existsSync(hostFile), "host file should not exist");
    log("host-fs-write", "PASS", "host filesystem unchanged");
    passed++;
  } catch (e) {
    log("host-fs-write", "FAIL", e.message);
    failed++;
  }

  // Test 7: Protected refs mutation detection
  try {
    const { repoDir, runDir } = setupTestRepo("protected-refs");
    const adapter = `import { spawnSync } from "node:child_process";\nspawnSync("git", ["branch", "-f", "main", "HEAD~0"], { cwd: "/workspace" });\nprocess.exit(0);\n`;
    const worktree = path.join(runDir, "ISSUE-007", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-007", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"]
    });
    // Protected refs should be unchanged regardless of adapter exit code
    const refsUnchanged = result.run?.protectedRefsUnchanged !== false;
    log("protected-refs", refsUnchanged ? "PASS" : "FAIL",
      `exit=${result.code}, refs-unchanged=${refsUnchanged}`);
    if (refsUnchanged) passed++; else failed++;
  } catch (e) {
    log("protected-refs", "FAIL", e.message);
    failed++;
  }

  // Test 8: Dry run does not execute adapter
  try {
    const { repoDir, runDir } = setupTestRepo("dry-run");
    const adapter = `process.exit(42);\n`;
    const worktree = path.join(runDir, "ISSUE-008", "worktree");
    fs.mkdirSync(worktree, { recursive: true });
    fs.writeFileSync(path.join(worktree, "adapter.mjs"), adapter);
    const result = dockerSandboxRun({
      repo: repoDir, runDir, issue: "ISSUE-008", attempt: 1,
      command: ["node", "/workspace/adapter.mjs"], dryRun: true
    });
    assert(result.code === 0, "dry run should exit 0");
    assert(result.dryRun === true, "should be dry run");
    log("dry-run", "PASS", "adapter not invoked");
    passed++;
  } catch (e) {
    log("dry-run", "FAIL", e.message);
    failed++;
  }

  // Summary
  process.stderr.write(`\n${passed} passed, ${failed} failed, ${skipped} skipped\n`);
  const summary = { passed, failed, skipped, results };
  fs.writeFileSync(path.join(out, "docker-test-summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(e => {
  process.stderr.write(`Fatal: ${e.message}\n`);
  process.exit(1);
});
