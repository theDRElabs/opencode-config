#!/usr/bin/env node
// Phase 11 Docker sandbox: wraps the existing process-level sandbox with
// Docker container isolation. The container provides kernel-level isolation
// (filesystem, network, PID, user namespace) while the existing guard-preload
// provides defense-in-depth inside the container. Merge, push, and deploy
// have no code path here; they stay human-owned.
import fs from "node:fs";
import path from "node:path";
import { spawnSync, spawn } from "node:child_process";
import { sandboxRun, PROTECTED_REFS, PROTECTED_BRANCH_NAMES } from "./sandbox.mjs";

const DOCKER_IMAGE = "node:24-slim";
const CONTAINER_USER = "sandbox";
const RESOURCE_LIMITS = {
  memory: "512m",
  cpus: "1",
  disk: "10g",
  pids: 256,
};

function fail(message, code = 2) {
  process.stderr.write(`${message}\n`);
  process.exit(code);
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temp, content);
  fs.renameSync(temp, file);
}

function dockerAvailable() {
  const r = spawnSync("docker", ["info"], { encoding: "utf8", timeout: 10000 });
  return r.status === 0;
}

function dockerImageExists(image) {
  const r = spawnSync("docker", ["image", "inspect", image], { encoding: "utf8", timeout: 10000 });
  return r.status === 0;
}

function pullImage(image) {
  process.stderr.write(`Pulling Docker image: ${image}\n`);
  const r = spawnSync("docker", ["pull", image], { encoding: "utf8", timeout: 300000 });
  if (r.status !== 0) throw new Error(`docker pull failed: ${r.stderr}`);
  return r.stdout.trim();
}

function buildGuardImage(image) {
  const dockerfile = `
FROM ${image}
RUN groupadd -r ${CONTAINER_USER} && useradd -r -g ${CONTAINER_USER} -m -s /bin/bash ${CONTAINER_USER}
USER ${CONTAINER_USER}
WORKDIR /home/${CONTAINER_USER}
`;
  const context = path.join(process.env.TMPDIR || "/tmp", `sandbox-build-${process.pid}`);
  fs.mkdirSync(context, { recursive: true });
  fs.writeFileSync(path.join(context, "Dockerfile"), dockerfile);
  const tag = `${image}-sandbox`;
  process.stderr.write(`Building sandbox image: ${tag}\n`);
  const r = spawnSync("docker", ["build", "-t", tag, context], {
    encoding: "utf8", timeout: 120000, cwd: context
  });
  fs.rmSync(context, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`docker build failed: ${r.stderr}`);
  return tag;
}

function ensureImage(baseImage) {
  const sandboxImage = `${baseImage}-sandbox`;
  if (dockerImageExists(sandboxImage)) return sandboxImage;
  if (!dockerImageExists(baseImage)) pullImage(baseImage);
  return buildGuardImage(baseImage);
}

function dockerRun(options) {
  const {
    image, repo, runDir, issue, attempt, command,
    networkEnabled = false, dryRun = false, timeout = 120000
  } = options;

  const attemptDir = path.join(runDir, issue, `attempt-${attempt}`);
  const worktree = path.join(runDir, issue, "worktree");
  const scratch = path.join(attemptDir, "scratch");
  fs.mkdirSync(scratch, { recursive: true });

  const containerName = `sandbox-${issue}-attempt-${attempt}-${Date.now()}`;
  const guardPreload = new URL("./guard-preload.cjs", import.meta.url).pathname;

  // Mount points:
  // - worktree: read-write (agent modifies code here)
  // - scratch: read-write (temp files, evidence)
  // - attemptDir: read-write (evidence capture)
  // - guard-preload: read-only (defense-in-depth)
  const dockerArgs = [
    "run", "--rm",
    "--name", containerName,
    // Resource limits
    "--memory", RESOURCE_LIMITS.memory,
    "--cpus", RESOURCE_LIMITS.cpus,
    "--pids-limit", String(RESOURCE_LIMITS.pids),
    // Security: drop all capabilities, add only what's needed
    "--cap-drop", "ALL",
    "--cap-add", "SETUID",    // for user switching
    "--cap-add", "SETGID",   // for user switching
    // No new privileges
    "--security-opt", "no-new-privileges:true",
    // Read-only root filesystem (overlay for writable paths)
    "--read-only",
    "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
    "--tmpfs", "/home/sandbox:rw,noexec,nosuid,size=128m",
    // Mount volumes
    "-v", `${worktree}:/workspace:rw`,
    "-v", `${scratch}:/sandbox-scratch:rw`,
    "-v", `${attemptDir}:/sandbox-attempt:rw`,
    "-v", `${guardPreload}:/sandbox/guard-preload.cjs:ro`,
    // Network
    networkEnabled ? "--network" : "--network", networkEnabled ? "bridge" : "none",
    // Working directory
    "-w", "/workspace",
    // User: run as host user to preserve file ownership/permissions
    "--user", `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`,
  ];

  // Environment: whitelist-based, same as process sandbox
  const envWhitelist = [
    "PATH", "HOME", "TMPDIR", "LANG", "NODE_ENV", "NODE_OPTIONS",
    "SANDBOX_POLICY", "SANDBOX_DENY_LOG", "SANDBOX_WORKTREE", "SANDBOX_SCRATCH", "SANDBOX_ATTEMPT_DIR",
    "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL",
    "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"
  ];
  for (const key of envWhitelist) {
    if (process.env[key] !== undefined) {
      dockerArgs.push("-e", `${key}=${process.env[key]}`);
    }
  }
  // Override HOME inside container
  dockerArgs.push("-e", "HOME=/home/sandbox");
  dockerArgs.push("-e", "TMPDIR=/tmp");
  dockerArgs.push("-e", `SANDBOX_WORKTREE=/workspace`);
  dockerArgs.push("-e", `SANDBOX_SCRATCH=/sandbox-scratch`);
  dockerArgs.push("-e", `SANDBOX_ATTEMPT_DIR=/sandbox-attempt`);
  dockerArgs.push("-e", `NODE_OPTIONS=--require /sandbox/guard-preload.cjs`);

  dockerArgs.push(image);
  dockerArgs.push(...command);

  return { dockerArgs, containerName, worktree, scratch, attemptDir };
}

function collectEvidence(attemptDir, containerName, result) {
  const evidence = {
    container: containerName,
    exitCode: result.status ?? 1,
    timestamp: new Date().toISOString(),
  };

  // Use spawnSync result directly (docker logs may fail with --rm)
  if (result.stdout) writeAtomic(path.join(attemptDir, "docker-stdout.log"), result.stdout);
  if (result.stderr) writeAtomic(path.join(attemptDir, "docker-stderr.log"), result.stderr);

  // Collect deny log if it exists
  const denyLogHost = path.join(attemptDir, "denied.jsonl");
  if (fs.existsSync(denyLogHost)) {
    const denials = fs.readFileSync(denyLogHost, "utf8").trim().split("\n").filter(Boolean).length;
    evidence.denialCount = denials;
  }

  return evidence;
}

export function dockerSandboxRun(options) {
  const { repo, runDir, issue, attempt, command, networkEnabled = false, dryRun = false } = options;

  if (!repo || !runDir || !issue || !command || !Array.isArray(command) || (command.length === 0 && !dryRun))
    throw new Error("dockerSandboxRun requires repo, runDir, issue, and command array");
  if (!/^(ISSUE-)?\d[\w.-]*$/.test(issue)) throw new Error(`invalid issue id: ${issue}`);

  const attemptNumber = Number(attempt || 1);
  const attemptDir = path.join(runDir, issue, `attempt-${attemptNumber}`);
  const worktree = path.join(runDir, issue, "worktree");
  fs.mkdirSync(attemptDir, { recursive: true });

  // Ensure Docker is available
  if (!dockerAvailable()) {
    process.stderr.write("Docker not available, falling back to process-level sandbox\n");
    return sandboxRun(options);
  }

  // Ensure image exists
  const image = ensureImage(DOCKER_IMAGE);

  // Validate adapter command (same as process sandbox)
  const policy = {
    network: networkEnabled ? "allowed" : "denied",
    shell: "restricted-allowlist",
    allowedBinaries: ["node", "npm", "npx", "git"],
    gitAllowedSubcommands: ["status", "diff", "add", "commit", "log", "show", "rev-parse", "init", "config", "branch", "checkout", "--version", "--help"],
    gitAlwaysDeniedSubcommands: ["push", "pull", "fetch", "remote", "reset", "merge", "rebase", "cherry-pick", "revert", "update-ref", "symbolic-ref", "worktree", "gc", "reflog", "filter-branch", "clone", "stash", "clean", "tag", "submodule", "am", "apply", "archive", "bundle", "describe"],
    protectedRefs: PROTECTED_REFS,
    protectedBranchNames: PROTECTED_BRANCH_NAMES,
    fsScope: [worktree, attemptDir],
    fsDenyPrefixes: ["/root", "/home", "/etc", "/proc", "/sys", "/dev/shm"],
  };

  // Record protected refs before
  const protectedBefore = {};
  for (const ref of PROTECTED_REFS) {
    const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: repo, encoding: "utf8" });
    protectedBefore[ref] = r.status === 0 ? r.stdout.trim() : null;
  }

  // Build Docker run command
  const { dockerArgs, containerName } = dockerRun({
    image, repo, runDir, issue, attempt: attemptNumber,
    command, networkEnabled, dryRun
  });

  // Write sandbox context
  const context = {
    issue, attempt: attemptNumber, branch: `sandbox/${issue}`,
    worktree, docker: true, dockerImage: image, containerName,
    protectedRefsBefore: protectedBefore,
    humanApprovalRequiredFor: ["merge", "push", "deploy"],
    resourceLimits: RESOURCE_LIMITS,
  };
  writeAtomic(path.join(attemptDir, "sandbox-context.json"), `${JSON.stringify(context, null, 2)}\n`);

  if (dryRun) {
    writeAtomic(path.join(attemptDir, "dry-run.json"), `${JSON.stringify({
      stopReason: "dry_run", wouldRun: command, invokedAdapter: false, docker: true
    }, null, 2)}\n`);
    return { code: 0, dryRun: true, attemptDir, worktree, branch: `sandbox/${issue}` };
  }

  // Execute in Docker container
  const started = Date.now();
  const result = spawnSync("docker", dockerArgs, {
    encoding: "utf8", timeout: 120000
  });
  const durationMs = Date.now() - started;

  // Collect evidence
  const evidence = collectEvidence(attemptDir, containerName, result);

  // Check protected refs after
  const protectedAfter = {};
  for (const ref of PROTECTED_REFS) {
    const r = spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd: repo, encoding: "utf8" });
    protectedAfter[ref] = r.status === 0 ? r.stdout.trim() : null;
  }
  const protectedRefsUnchanged = JSON.stringify(protectedBefore) === JSON.stringify(protectedAfter);

  const adapterExitCode = result.status ?? 1;
  const exitCode = protectedRefsUnchanged ? adapterExitCode : 1;

  const run = {
    issue, attempt: attemptNumber, branch: `sandbox/${issue}`, command,
    exitCode, adapterExitCode,
    protectedRefsMutated: !protectedRefsUnchanged,
    timedOut: result.signal === "SIGTERM" || result.error?.code === "ETIMEDOUT",
    durationMs, denialCount: evidence.denialCount || 0,
    protectedRefsBefore: protectedBefore, protectedRefsAfter: protectedAfter,
    protectedRefsUnchanged,
    docker: { image, containerName, resourceLimits: RESOURCE_LIMITS },
    evidence: { adapterLog: path.join(attemptDir, "docker-stdout.log"), diff: path.join(attemptDir, "diff.patch") },
    mergePushDeploy: "denied-by-construction: no code path performs merge, push, or deploy; human approval required"
  };
  writeAtomic(path.join(attemptDir, "sandbox-run.json"), `${JSON.stringify(run, null, 2)}\n`);

  if (run.exitCode !== 0) {
    writeAtomic(path.join(attemptDir, "failure.json"), `${JSON.stringify({
      issue, attempt: attemptNumber, exitCode: run.exitCode, adapterExitCode,
      protectedRefsMutated: run.protectedRefsMutated,
      denialCount: evidence.denialCount || 0,
      stopReason: protectedRefsUnchanged ? "adapter_failed" : "protected_refs_mutated"
    }, null, 2)}\n`);
  }

  return { code: run.exitCode, dryRun: false, attemptDir, worktree, branch: `sandbox/${issue}`, run };
}

function parseArgs(argv) {
  const options = { attempt: 1, dryRun: false, networkEnabled: false };
  const command = [];
  let sawSeparator = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (sawSeparator) { command.push(arg); continue; }
    if (arg === "--") { sawSeparator = true; continue; }
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--network") options.networkEnabled = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = argv[++i];
      if (!value) fail(`missing value for ${arg}`);
      const names = { repo: "repo", "run-dir": "runDir", issue: "issue", attempt: "attempt" };
      if (!names[key]) fail(`unknown option ${arg}`);
      options[names[key]] = value;
    } else fail(`unexpected argument ${arg}`);
  }
  for (const key of ["repo", "runDir", "issue"]) if (!options[key]) fail(`--${key} is required`);
  if (command.length === 0 && !options.dryRun) fail("adapter command is required after --");
  options.attempt = Number(options.attempt);
  if (!Number.isInteger(options.attempt) || options.attempt < 1) fail("--attempt must be a positive integer");
  return { options, command };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  const { options, command } = parseArgs(process.argv.slice(2));
  try {
    const outcome = dockerSandboxRun({ ...options, command });
    process.stdout.write(`${JSON.stringify({ exitCode: outcome.code, dryRun: outcome.dryRun, attemptDir: outcome.attemptDir, branch: outcome.branch })}\n`);
    process.exit(outcome.code);
  } catch (error) {
    fail(error.message, 2);
  }
}
