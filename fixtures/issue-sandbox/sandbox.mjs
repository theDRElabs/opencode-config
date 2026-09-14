#!/usr/bin/env node
// Phase 11 issue sandbox: per-issue git worktree + branch, allowlist exec
// policy, constructed environment, in-process guard via NODE_OPTIONS preload,
// evidence capture, and dry run. Kernel namespaces are not used by design;
// isolation is process-level. Merge, push, and deploy have no code path here;
// they stay human-owned.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const PROTECTED_REFS = ["refs/heads/main", "refs/heads/production"];
export const PROTECTED_BRANCH_NAMES = ["main", "production", "master"];

const ALLOWED_BINARIES = ["node", "npm", "npx", "git"];
const GIT_ALLOWED = new Set(["status", "diff", "add", "commit", "log", "show", "rev-parse", "init", "config", "branch", "checkout", "--version", "--help"]);
const GIT_ALWAYS_DENIED = new Set(["push", "pull", "fetch", "remote", "reset", "merge", "rebase", "cherry-pick", "revert", "update-ref", "symbolic-ref", "worktree", "gc", "reflog", "filter-branch", "clone", "stash", "clean", "tag", "submodule", "am", "apply", "archive", "bundle", "describe"]);

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

function git(repo, args, extraEnv = {}) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", env: { ...process.env, ...extraEnv } });
  return { code: result.status ?? 1, stdout: result.stdout || "", stderr: result.stderr || "" };
}

function refSha(repo, ref) {
  const r = git(repo, ["rev-parse", "--verify", "--quiet", ref]);
  return r.code === 0 ? r.stdout.trim() : null;
}

function policyFor({ worktree, scratch, attemptDir, preload, denyLog, policyFile }) {
  return {
    network: "denied",
    shell: "restricted-allowlist",
    allowedBinaries: ALLOWED_BINARIES,
    gitAllowedSubcommands: [...GIT_ALLOWED],
    gitAlwaysDeniedSubcommands: [...GIT_ALWAYS_DENIED],
    protectedRefs: PROTECTED_REFS,
    protectedBranchNames: PROTECTED_BRANCH_NAMES,
    fsScope: [worktree, scratch, attemptDir],
    fsDenyPrefixes: ["/root", "/home", "/etc", "/proc", "/sys", "/dev/shm"],
    envWhitelist: [
      "PATH", "HOME", "TMPDIR", "LANG", "NODE_ENV", "NODE_OPTIONS",
      "SANDBOX_POLICY", "SANDBOX_DENY_LOG", "SANDBOX_WORKTREE", "SANDBOX_SCRATCH", "SANDBOX_ATTEMPT_DIR",
      "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL",
      "GIT_CONFIG_GLOBAL", "GIT_CONFIG_SYSTEM", "GIT_CONFIG_NOSYSTEM"
    ],
    denyLog, preload, worktree, scratch, attemptDir, policyFile
  };
}

function sandboxEnv(policy) {
  // Environment is constructed from a whitelist, never copied from the host:
  // host secrets cannot leak because they are never present. PATH is derived
  // from the running node executable so the sandbox stays portable.
  const env = {
    PATH: `${path.dirname(process.execPath)}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin`,
    HOME: policy.scratch,
    TMPDIR: policy.scratch,
    LANG: "C.UTF-8",
    NODE_ENV: "test",
    NODE_OPTIONS: `--require ${policy.preload}`,
    SANDBOX_POLICY: policy.policyFile,
    SANDBOX_DENY_LOG: policy.denyLog,
    SANDBOX_WORKTREE: policy.worktree,
    SANDBOX_SCRATCH: policy.scratch,
    SANDBOX_ATTEMPT_DIR: policy.attemptDir,
    GIT_AUTHOR_NAME: "issue-sandbox",
    GIT_AUTHOR_EMAIL: "issue-sandbox@example.invalid",
    GIT_COMMITTER_NAME: "issue-sandbox",
    GIT_COMMITTER_EMAIL: "issue-sandbox@example.invalid",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1"
  };
  return env;
}

function trustedExecDirs() {
  return new Set([path.dirname(process.execPath), "/usr/bin", "/bin", "/usr/local/bin", "/usr/sbin", "/sbin"].map(d => path.resolve(d)));
}

export function validateAdapterCommand(command, policy) {
  if (!command || command.length === 0) return;
  const [file, ...args] = command;
  const base = path.basename(String(file));
  if (!policy.allowedBinaries.includes(base))
    throw new Error(`sandbox adapter command denied: binary not allowed: ${file}`);
  if (String(file).includes("/") && !trustedExecDirs().has(path.resolve(path.dirname(String(file)))))
    throw new Error(`sandbox adapter command denied: executable directory not trusted: ${file}`);
  if (base === "git") {
    const sub = args.find(a => !a.startsWith("-"));
    if (sub === undefined || policy.gitAlwaysDeniedSubcommands.includes(sub) || !policy.gitAllowedSubcommands.includes(sub))
      throw new Error(`sandbox adapter command denied: git subcommand: ${sub}`);
    for (const arg of args) {
      if (arg.startsWith("--git-dir") || arg.startsWith("--work-tree") || /^--output(=|$)/.test(arg))
        throw new Error(`sandbox adapter command denied: git flag: ${arg}`);
    }
    const plain = args.filter(a => !a.startsWith("-") && a !== sub).map(a => a.replace(/^refs\/heads\//, ""));
    if (sub === "branch") {
      const flags = args.filter(a => a.startsWith("-")).join("");
      if (/f|D|d/.test(flags)) throw new Error(`sandbox adapter command denied: git branch force/mutation: ${args.join(" ")}`);
      if (plain.some(a => policy.protectedBranchNames.includes(a))) throw new Error(`sandbox adapter command denied: git branch on protected ref: ${args.join(" ")}`);
    }
    if (sub === "checkout" && plain.some(a => policy.protectedBranchNames.includes(a)))
      throw new Error(`sandbox adapter command denied: git checkout of protected branch: ${args.join(" ")}`);
    if (sub === "config" && args.some(a => /^--(global|system|edit)$/.test(a) || a === "-e"))
      throw new Error(`sandbox adapter command denied: git config scope: ${args.join(" ")}`);
  }
}

export function sandboxRun(options) {
  const { repo, runDir, issue, attempt, command, dryRun = false } = options;
  if (!repo || !runDir || !issue || !command || !Array.isArray(command) || (command.length === 0 && !dryRun))
    throw new Error("sandboxRun requires repo, runDir, issue, and command array");
  if (!/^(ISSUE-)?\d[\w.-]*$/.test(issue)) throw new Error(`invalid issue id: ${issue}`);
  const attemptNumber = Number(attempt || 1);

  const attemptDir = path.join(runDir, issue, `attempt-${attemptNumber}`);
  const worktree = path.join(runDir, issue, "worktree");
  const scratch = path.join(attemptDir, "scratch");
  const preload = new URL("./guard-preload.cjs", import.meta.url).pathname;
  const policyFile = path.join(attemptDir, "sandbox-policy.json");
  const denyLog = path.join(attemptDir, "denied.jsonl");
  fs.mkdirSync(scratch, { recursive: true });

  const branch = `sandbox/${issue}`;
  const policy = policyFor({ worktree, scratch, attemptDir, preload, denyLog, policyFile });
  validateAdapterCommand(command, policy);
  const protectedBefore = Object.fromEntries(PROTECTED_REFS.map(ref => [ref, refSha(repo, ref)]));

  let created = false;
  if (refSha(repo, branch) === null) {
    const r = git(repo, ["worktree", "add", "-b", branch, worktree]);
    if (r.code !== 0) throw new Error(`worktree add failed: ${r.stderr}`);
    created = true;
  } else if (!fs.existsSync(path.join(worktree, ".git"))) {
    const r = git(repo, ["worktree", "add", branch, worktree]);
    if (r.code !== 0) throw new Error(`worktree attach failed: ${r.stderr}`);
  }

  writeAtomic(path.join(attemptDir, "sandbox-context.json"), `${JSON.stringify({
    issue, attempt: attemptNumber, branch, worktree, created, dryRun,
    protectedRefsBefore: protectedBefore, humanApprovalRequiredFor: ["merge", "push", "deploy"]
  }, null, 2)}\n`);
  writeAtomic(policyFile, `${JSON.stringify(policy, null, 2)}\n`);

  if (dryRun) {
    writeAtomic(path.join(attemptDir, "dry-run.json"), `${JSON.stringify({
      stopReason: "dry_run", wouldRun: command, invokedAdapter: false
    }, null, 2)}\n`);
    return { code: 0, dryRun: true, attemptDir, worktree, branch };
  }

  const started = Date.now();
  const result = spawnSync(command[0], command.slice(1), {
    cwd: worktree, encoding: "utf8", env: sandboxEnv(policy), timeout: 120000
  });
  const durationMs = Date.now() - started;
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  writeAtomic(path.join(attemptDir, "adapter.log"), output);

  // Evidence capture: status, diff, branch diff, log, artifacts, denials, protected refs.
  const statusR = git(worktree, ["status", "--porcelain"]);
  const diffR = git(worktree, ["diff", "HEAD"]);
  const logR = git(worktree, ["log", "--oneline", "-20"]);
  const baseRef = PROTECTED_REFS[0];
  const branchDiffR = protectedBefore[baseRef] !== null ? git(worktree, ["diff", `${baseRef}...HEAD`]) : { stdout: "" };
  writeAtomic(path.join(attemptDir, "diff.patch"), diffR.stdout);
  writeAtomic(path.join(attemptDir, "branch-diff.patch"), branchDiffR.stdout);
  writeAtomic(path.join(attemptDir, "git-log.txt"), logR.stdout);
  writeAtomic(path.join(attemptDir, "git-status.txt"), statusR.stdout);
  const protectedAfter = Object.fromEntries(PROTECTED_REFS.map(ref => [ref, refSha(repo, ref)]));
  const protectedRefsUnchanged = JSON.stringify(protectedBefore) === JSON.stringify(protectedAfter);
  const artifacts = fs.readdirSync(attemptDir).filter(n => !n.startsWith("sandbox-") && n !== "dry-run.json").sort();
  const denials = fs.existsSync(denyLog) ? fs.readFileSync(denyLog, "utf8").trim().split("\n").filter(Boolean).length : 0;
  const adapterExitCode = result.status ?? 1;
  // Fail closed: if a protected ref moved at all, the attempt is a failure
  // regardless of the adapter's own exit code.
  const exitCode = protectedRefsUnchanged ? adapterExitCode : 1;
  const run = {
    issue, attempt: attemptNumber, branch, command,
    exitCode,
    adapterExitCode,
    protectedRefsMutated: !protectedRefsUnchanged,
    timedOut: result.signal === "SIGTERM" || result.error?.code === "ETIMEDOUT",
    durationMs, denialCount: denials,
    protectedRefsBefore: protectedBefore, protectedRefsAfter: protectedAfter,
    protectedRefsUnchanged,
    artifacts, evidence: { adapterLog: path.join(attemptDir, "adapter.log"), diff: path.join(attemptDir, "diff.patch") },
    mergePushDeploy: "denied-by-construction: no code path performs merge, push, or deploy; human approval required"
  };
  writeAtomic(path.join(attemptDir, "sandbox-run.json"), `${JSON.stringify(run, null, 2)}\n`);
  if (run.exitCode !== 0) writeAtomic(path.join(attemptDir, "failure.json"), `${JSON.stringify({
    issue, attempt: attemptNumber, exitCode: run.exitCode, adapterExitCode,
    protectedRefsMutated: run.protectedRefsMutated,
    denialCount: denials,
    stopReason: protectedRefsUnchanged ? "adapter_failed" : "protected_refs_mutated"
  }, null, 2)}\n`);
  return { code: run.exitCode, dryRun: false, attemptDir, worktree, branch, run };
}

function parseArgs(argv) {
  const options = { attempt: 1, dryRun: false };
  const command = [];
  let sawSeparator = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (sawSeparator) { command.push(arg); continue; }
    if (arg === "--") { sawSeparator = true; continue; }
    if (arg === "--dry-run") options.dryRun = true;
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
    const outcome = sandboxRun({ ...options, command });
    process.stdout.write(`${JSON.stringify({ exitCode: outcome.code, dryRun: outcome.dryRun, attemptDir: outcome.attemptDir, branch: outcome.branch })}\n`);
    process.exit(outcome.code);
  } catch (error) {
    fail(error.message, 2);
  }
}
