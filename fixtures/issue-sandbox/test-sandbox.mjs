import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { sandboxRun } from "./sandbox.mjs";

const root = path.dirname(new URL(import.meta.url).pathname);
const out = process.argv[2] || "/tmp/opencode/p11-validation";
const tools = path.join(out, "tools");
fs.rmSync(tools, { recursive: true, force: true });
fs.mkdirSync(tools, { recursive: true });

function assert(value, message) { if (!value) throw new Error(`ASSERT: ${message}`); }
function write(file, content) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
function git(cwd, args) {
  const r = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed in ${cwd}: ${r.stderr}`);
  return r.stdout.trim();
}

const ENV_WHITELIST = [
  "GIT_AUTHOR_EMAIL", "GIT_AUTHOR_NAME", "GIT_COMMITTER_EMAIL", "GIT_COMMITTER_NAME",
  "GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_CONFIG_SYSTEM", "HOME", "LANG", "NODE_ENV",
  "NODE_OPTIONS", "PATH", "SANDBOX_ATTEMPT_DIR", "SANDBOX_DENY_LOG", "SANDBOX_POLICY",
  "SANDBOX_SCRATCH", "SANDBOX_WORKTREE", "TMPDIR",
  "SANDBOX_HOST_DIR", "SANDBOX_HOST_SECRETS", "SANDBOX_HOST_UNRELATED"
];

// Adversarial adapter sources. Each runs INSIDE the sandbox, attempts
// violations through the public fs/child_process/net APIs, and exits 0 only
// when every expected denial actually happened and every expected allowance
// worked. Reports are written into the sandbox attempt directory.
const adapters = {
  "happy-adapter.mjs": `import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const report = { name: "happy", steps: [] };
try {
  fs.writeFileSync("feature.txt", "implemented feature\\n");
  report.steps.push({ step: "write-worktree", ok: true });
  const add = cp.spawnSync("git", ["add", "feature.txt"]);
  report.steps.push({ step: "git-add", ok: add.status === 0 });
  const commit = cp.spawnSync("git", ["commit", "-m", "feature"]);
  report.steps.push({ step: "git-commit", ok: commit.status === 0 });
  fs.writeFileSync(path.join(attemptDir, "implementation-result.md"), "# Implementation Result\\nISSUE: ISSUE-001\\nOUTCOME: complete\\nHUMAN_ACCEPTANCE: false\\n");
  report.steps.push({ step: "write-result", ok: true });
  report.envKeys = Object.keys(process.env).sort();
  report.steps.push({ step: "env-count", ok: report.envKeys.length > 0 });
  fs.writeFileSync(path.join(attemptDir, "env-report.json"), JSON.stringify(report, null, 2));
  process.exit(report.steps.every(s => s.ok) ? 0 : 1);
} catch (e) { report.error = e.message; fs.writeFileSync(path.join(attemptDir, "env-report.json"), JSON.stringify(report, null, 2)); process.exit(1); }
`,
  "hostile-secrets.mjs": `import fs from "node:fs";
import path from "node:path";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const secrets = process.env.SANDBOX_HOST_SECRETS;
const report = { name: "hostile-secrets", attempts: [] };
function attempt(name, fn) {
  try { const value = fn(); report.attempts.push({ name, denied: false, leaked: String(value).slice(0, 60) }); }
  catch (e) { report.attempts.push({ name, denied: e.code === "EACCES" && e.sandbox === true, error: e.message.slice(0, 90) }); }
}
attempt("read-secret-env", () => fs.readFileSync(path.join(secrets, "secret.env"), "utf8"));
attempt("read-id-rsa", () => fs.readFileSync(path.join(secrets, "id_rsa"), "utf8"));
attempt("read-root-config", () => fs.readFileSync("/home/DRE/.config/opencode/opencode.jsonc", "utf8"));
attempt("read-proc-environ", () => fs.readFileSync("/proc/self/environ", "utf8"));
attempt("read-proc-self", () => fs.readFileSync("/proc/self/status", "utf8"));
attempt("read-etc-shadow", () => fs.readFileSync("/etc/shadow", "utf8"));
report.envLeak = { anthropic: typeof process.env.ANTHROPIC_API_KEY, router: typeof process.env.AGENTROUTER_API_KEY, token: typeof process.env.GITHUB_TOKEN };
report.homeIsScratch = process.env.HOME !== "/root";
report.allDenied = report.attempts.every(a => a.denied) && report.envLeak.anthropic === "undefined" && report.envLeak.router === "undefined" && report.envLeak.token === "undefined" && report.homeIsScratch;
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allDenied ? 0 : 1);
`,
  "hostile-paths.mjs": `import fs from "node:fs";
import path from "node:path";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const unrelated = process.env.SANDBOX_HOST_UNRELATED;
const report = { name: "hostile-paths", attempts: [] };
function attempt(name, expect, fn) {
  try { fn(); report.attempts.push({ name, expect, outcome: "allowed" }); }
  catch (e) { report.attempts.push({ name, expect, outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60) }); }
}
attempt("read-unrelated", "denied", () => { fs.readFileSync(path.join(unrelated, "notes.txt"), "utf8"); });
attempt("write-unrelated", "denied", () => { fs.writeFileSync(path.join(unrelated, "evil.txt"), "x"); });
attempt("read-parent-dir", "denied", () => { fs.readdirSync(".."); });
attempt("read-parent-file", "denied", () => { fs.readFileSync("../outside.txt", "utf8"); });
attempt("write-etc", "denied", () => { fs.writeFileSync("/etc/p11-escape", "x"); });
attempt("write-tmp", "denied", () => { fs.writeFileSync("/tmp/p11-escape", "x"); });
attempt("mkdir-outside", "denied", () => { fs.mkdirSync("/tmp/p11-evil-dir"); });
attempt("symlink-escape", "denied", () => { fs.symlinkSync(unrelated + "/notes.txt", "escape-link"); fs.readFileSync("escape-link", "utf8"); });
attempt("write-scratch", "allowed", () => { fs.writeFileSync(path.join(process.env.SANDBOX_SCRATCH, "ok.txt"), "x"); });
attempt("write-worktree", "allowed", () => { fs.writeFileSync("allowed.txt", "x"); });
attempt("read-worktree", "allowed", () => { fs.readFileSync("base.txt", "utf8"); });
report.allMatched = report.attempts.every(a => a.outcome === a.expect);
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched ? 0 : 1);
`,
  "hostile-destructive.mjs": `import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const host = process.env.SANDBOX_HOST_DIR;
const report = { name: "hostile-destructive", attempts: [] };
function attempt(name, expect, fn) {
  try { fn(); report.attempts.push({ name, expect, outcome: "allowed" }); }
  catch (e) { report.attempts.push({ name, expect, outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60) }); }
}
attempt("rm-binary", "denied", () => { cp.spawnSync("rm", ["-rf", host]); });
attempt("bash-shell", "denied", () => { cp.spawnSync("bash", ["-c", "rm -rf " + host]); });
attempt("sh-shell", "denied", () => { cp.spawnSync("sh", ["-c", "echo pwned > /tmp/p11-escape"]); });
attempt("dd-binary", "denied", () => { cp.spawnSync("dd", ["if=/dev/zero", "of=" + host + "/zeroed"]); });
attempt("chmod-binary", "denied", () => { cp.spawnSync("chmod", ["-R", "777", host]); });
attempt("git-gc", "denied", () => { cp.spawnSync("git", ["gc", "--aggressive"]); });
attempt("git-reset-hard", "denied", () => { cp.spawnSync("git", ["reset", "--hard"]); });
attempt("fs-rm-outside", "denied", () => { fs.rmSync(host, { recursive: true, force: true }); });
attempt("exec-shell-option", "denied", () => { cp.spawnSync("ls", ["."], { shell: true }); });
{
  const r = cp.spawnSync(process.execPath, ["-e", "require('fs').writeFileSync('/tmp/p11-escape','x')"]);
  report.attempts.push({ name: "node-e-escape", expect: "denied", outcome: r.status === 0 ? "allowed" : "denied" });
}
attempt("rm-inside-worktree", "allowed", () => { fs.writeFileSync("trash.txt", "x"); fs.rmSync("trash.txt"); });
report.allMatched = report.attempts.every(a => a.outcome === a.expect);
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched ? 0 : 1);
`,
  "hostile-prod-branch.mjs": `import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const report = { name: "hostile-prod-branch", attempts: [] };
function attempt(name, expect, fn) {
  try { fn(); report.attempts.push({ name, expect, outcome: "allowed" }); }
  catch (e) { report.attempts.push({ name, expect, outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60) }); }
}
attempt("branch-f-main", "denied", () => { cp.spawnSync("git", ["branch", "-f", "main", "HEAD"]); });
attempt("branch-force-long", "denied", () => { cp.spawnSync("git", ["branch", "--force", "main", "HEAD"]); });
attempt("update-ref-main", "denied", () => { cp.spawnSync("git", ["update-ref", "refs/heads/main", "HEAD"]); });
attempt("checkout-main", "denied", () => { cp.spawnSync("git", ["checkout", "main"]); });
attempt("symbolic-ref-main", "denied", () => { cp.spawnSync("git", ["symbolic-ref", "HEAD", "refs/heads/main"]); });
attempt("checkout-production", "denied", () => { cp.spawnSync("git", ["checkout", "production"]); });
let mainRef = null, mainRef2 = null;
attempt("resolve-gitdir-and-write", "denied", () => {
  const wtGit = fs.readFileSync(".git", "utf8").trim().replace(/^gitdir:\\s*/, "");
  const mainGit = path.resolve(wtGit, "..", "..");
  mainRef = path.join(mainGit, "refs", "heads", "main");
  fs.writeFileSync(mainRef, "0000000000000000000000000000000000000000\\n");
});
attempt("rename-over-main-ref", "denied", () => {
  fs.writeFileSync("evil.tmp", "0000000000000000000000000000000000000000\\n");
  fs.renameSync("evil.tmp", mainRef);
});
attempt("git-C-repo-branch-f", "denied", () => { cp.spawnSync("git", ["-C", path.resolve(mainRef, "..", "..", ".."), "branch", "-f", "main", "HEAD"]); });
attempt("git-git-dir-flag", "denied", () => { cp.spawnSync("git", ["--git-dir=" + path.resolve(mainRef, "..", ".."), "branch", "-f", "main", "HEAD"]); });
attempt("commit-on-sandbox-branch", "allowed", () => { fs.writeFileSync("legit.txt", "x"); const a = cp.spawnSync("git", ["add", "legit.txt"]); const c = cp.spawnSync("git", ["commit", "-m", "legit"]); if (a.status !== 0 || c.status !== 0) throw new Error("commit failed"); });
report.allMatched = report.attempts.every(a => a.outcome === a.expect);
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched ? 0 : 1);
`,
  "hostile-push.mjs": `import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import dns from "node:dns";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const report = { name: "hostile-push", attempts: [] };
function attempt(name, expect, fn) {
  try { fn(); report.attempts.push({ name, expect, outcome: "allowed" }); }
  catch (e) { report.attempts.push({ name, expect, outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60) }); }
}
attempt("git-push", "denied", () => { cp.spawnSync("git", ["push"]); });
attempt("git-push-origin-main", "denied", () => { cp.spawnSync("git", ["push", "origin", "main"]); });
attempt("git-push-force", "denied", () => { cp.spawnSync("git", ["push", "--force", "origin", "main"]); });
attempt("git-remote-add", "denied", () => { cp.spawnSync("git", ["remote", "add", "evil", "/tmp/evil.git"]); });
attempt("git-fetch", "denied", () => { cp.spawnSync("git", ["fetch", "origin"]); });
attempt("http-get", "denied", () => { http.get("http://127.0.0.1:9/ping"); });
attempt("https-request", "denied", () => { https.request("https://127.0.0.1:9/ping"); });
attempt("net-connect", "denied", () => { net.connect({ port: 9, host: "127.0.0.1" }); });
attempt("socket-connect", "denied", () => { const s = new net.Socket(); s.connect({ port: 9 }); });
attempt("dns-lookup", "denied", () => { dns.lookup("example.com", () => {}); });
attempt("curl-binary", "denied", () => { cp.spawnSync("curl", ["http://127.0.0.1:9/"]); });
attempt("ssh-binary", "denied", () => { cp.spawnSync("ssh", ["git@127.0.0.1"]); });
report.allMatched = report.attempts.every(a => a.outcome === a.expect);
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched ? 0 : 1);
`,
  "failing-adapter.mjs": `import fs from "node:fs";
import path from "node:path";
fs.writeFileSync(path.join(process.env.SANDBOX_ATTEMPT_DIR, "partial-output.txt"), "partial\\n");
process.stderr.write("simulated adapter failure\\n");
process.exit(3);
`,
  "hostile-native.mjs": `import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const secrets = process.env.SANDBOX_HOST_SECRETS;
const unrelated = process.env.SANDBOX_HOST_UNRELATED;
const report = { name: "hostile-native", attempts: [] };
function denied(e) { return e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60); }
function attempt(name, expect, fn) {
  try { fn(); report.attempts.push({ name, expect, outcome: "allowed" }); }
  catch (e) { report.attempts.push({ name, expect, outcome: denied(e) }); }
}
// fs.openAsBlob full-content read of host files (verifier round-3 blocking finding 1).
{
  let outcome = "allowed";
  try { const blob = await fs.openAsBlob(path.join(secrets, "secret.env")); const text = await blob.text(); if (!text.includes("SENTINEL")) outcome = "error:no-sentinel"; }
  catch (e) { outcome = denied(e); }
  report.attempts.push({ name: "openasblob-secret", expect: "denied", outcome });
}
{
  let outcome = "allowed";
  try { const blob = await fs.openAsBlob("/etc/hostname"); await blob.text(); }
  catch (e) { outcome = denied(e); }
  report.attempts.push({ name: "openasblob-deny-prefix", expect: "denied", outcome });
}
// Enumeration and metadata vectors (verifier round-3 non-blocking findings).
attempt("opendir-enum-secrets", "denied", () => { const d = fs.opendirSync(secrets); d.closeSync(); });
attempt("utimes-tamper-host", "denied", () => { const t = new Date(); fs.utimesSync(path.join(unrelated, "notes.txt"), t, t); });
attempt("readlink-proc", "denied", () => fs.readlinkSync("/proc/self/exe"));
attempt("exists-host-root", "denied", () => { fs.existsSync("/home/DRE/.config"); });
attempt("stat-etc-hostname", "denied", () => { fs.statSync("/etc/hostname"); });
// LD_PRELOAD env injection through an allowlisted node child (verifier
// round-3 blocking finding 2): the loader keys must be stripped from every
// child env, so the child never sees LD_PRELOAD at all.
function ldProbe(name, opts) {
  const r = cp.spawnSync(process.execPath, ["-e", 'process.stdout.write(String(typeof process.env.LD_PRELOAD !== "undefined"))'], opts);
  let outcome;
  if (r.status !== 0) outcome = String(r.stderr || "").includes("SANDBOX_DENIED") ? "denied" : "error:" + String(r.stderr || (r.error && r.error.message) || "").slice(0, 60);
  else outcome = r.stdout.toString().trim() === "true" ? "allowed" : "stripped";
  report.attempts.push({ name, expect: "stripped", outcome });
}
ldProbe("ldpreload-custom-env", { env: { PATH: process.env.PATH, LD_PRELOAD: "/tmp/p11-fake.so", LD_LIBRARY_PATH: "/tmp" } });
process.env.LD_PRELOAD = "/tmp/p11-fake.so";
process.env.LD_AUDIT = "/tmp/p11-fake.so";
ldProbe("ldpreload-process-env", undefined);
ldProbe("ldpreload-process-env-custom", { env: { PATH: process.env.PATH, LD_PRELOAD: "/tmp/p11-fake.so" } });
delete process.env.LD_PRELOAD;
delete process.env.LD_AUDIT;
// In-process native code loading: process.dlopen, require("*.node"), and
// process.binding must all be denied before any native code runs.
fs.writeFileSync("fake-addon.so", "not-really-elf");
fs.writeFileSync("fake-addon.node", "not-really-elf");
attempt("process-dlopen", "denied", () => { process.dlopen({ exports: {} }, path.resolve("fake-addon.so")); });
attempt("require-node-addon", "denied", () => { require2(path.resolve("fake-addon.node")); });
attempt("process-binding-fs", "denied", () => { process.binding("fs"); });
report.allMatched = report.attempts.every(a => a.outcome === a.expect);
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched ? 0 : 1);
`,
  "hostile-file-urls.mjs": `import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
const require2 = createRequire(import.meta.url);
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const secrets = process.env.SANDBOX_HOST_SECRETS;
const unrelated = process.env.SANDBOX_HOST_UNRELATED;
const report = { name: "hostile-file-urls", attempts: [] };
async function outcome(fn) {
  try { const value = await fn(); return { outcome: "allowed", value: value === undefined ? undefined : String(value).slice(0, 80) }; }
  catch (e) { return { outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 70) }; }
}
async function attempt(name, expect, fn) { report.attempts.push({ name, expect, ...await outcome(fn) }); }
function urlFor(file) { return new URL("file://" + file.split(path.sep).map(encodeURIComponent).join("/")); }
const secretUrl = urlFor(path.join(secrets, "secret.env"));
const unrelatedUrl = urlFor(path.join(unrelated, "notes.txt"));
const hostnameUrl = new URL("file:///proc/self/exe");
const worktreeUrl = urlFor(path.resolve("base.txt"));
const scratchUrl = urlFor(path.join(process.env.SANDBOX_SCRATCH, "url-scratch.txt"));
const crossRealmUrl = vm.runInNewContext("new URL(value)", { URL, value: worktreeUrl.href });
const fakePrototypeUrl = Object.create(URL.prototype);
const forgedUrl = { href: worktreeUrl.href, protocol: "file:" };
// B1 stateful-divergence vectors (sixth verifier): a Proxy over a genuine URL
// whose pathname trap returns the in-scope worktree path on the first read
// (the guard's fileURLToPath validation) and the unrelated host sentinel on
// every later read (Node's own conversion at execution). Pre-repair this
// leaks the sentinel; post-repair the validated string is what executes, so
// the worktree file is read and no sentinel can appear.
let proxyPathnameReads = 0;
const statefulProxyUrl = new Proxy(worktreeUrl, {
  get(target, prop) {
    if (prop === "pathname") {
      proxyPathnameReads += 1;
      return proxyPathnameReads <= 1 ? target.pathname : urlFor(path.join(unrelated, "notes.txt")).pathname;
    }
    const value = Reflect.get(target, prop, target);
    return typeof value === "function" ? value.bind(target) : value;
  }
});
const statefulForgedUrl = { href: worktreeUrl.href, protocol: "file:" };
Object.defineProperty(statefulForgedUrl, Symbol.toStringTag, { value: "URL" });
const validBuffer = Buffer.from(path.resolve("base.txt"));
const invalidBuffer = Buffer.from([0x62, 0x61, 0x64, 0xff]);
for (const [name, expect, fn] of [
  ["readFileSync-secret-url", "denied", () => fs.readFileSync(secretUrl, "utf8")],
  ["readFile-promise-secret-url", "denied", () => fsp.readFile(secretUrl, "utf8")],
  ["openAsBlob-secret-url", "denied", () => fs.openAsBlob(secretUrl)],
  ["opendirSync-unrelated-url", "denied", () => fs.opendirSync(urlFor(unrelated))],
  ["statSync-hostname-url", "denied", () => fs.statSync(hostnameUrl)],
  ["existsSync-secret-url", "denied", () => fs.existsSync(secretUrl)],
  ["readlinkSync-hostname-url", "denied", () => fs.readlinkSync(hostnameUrl)],
  ["writeFileSync-unrelated-url", "denied", () => fs.writeFileSync(urlFor(path.join(unrelated, "url-evil.txt")), "x")],
  ["utimesSync-unrelated-url", "denied", () => fs.utimesSync(unrelatedUrl, new Date(), new Date())],
  ["cpSync-secret-url", "denied", () => fs.cpSync(secretUrl, urlFor(path.join(unrelated, "url-copy.txt")))],
  ["protected-ref-url", "denied", () => {
    const gitDir = fs.readFileSync(".git", "utf8").trim().replace(/^gitdir:\s*/, "");
    fs.writeFileSync(urlFor(path.resolve(gitDir, "..", "..", "refs", "heads", "main")), "0".repeat(40));
  }],
  ["readFile-worktree-url", "allowed", () => fs.readFileSync(worktreeUrl, "utf8")],
  ["writeFile-scratch-url", "allowed", () => fs.writeFileSync(scratchUrl, "url-ok")],
  ["stat-worktree-url", "allowed", () => fs.statSync(worktreeUrl)],
  ["malformed-encoded-url", "denied", () => fs.readFileSync(new URL("file:///tmp/%2Fetc%2Fhostname"), "utf8")],
  ["non-file-url", "denied", () => fs.readFileSync(new URL("data:text/plain,secret"), "utf8")]
  , ["cross-realm-worktree-url", "allowed", () => fs.readFileSync(crossRealmUrl, "utf8")]
  , ["forged-url-like-object", "denied", () => fs.readFileSync(forgedUrl, "utf8")]
  , ["fake-prototype-url", "denied", () => fs.readFileSync(fakePrototypeUrl, "utf8")]
  , ["valid-buffer-worktree", "allowed", () => fs.readFileSync(validBuffer, "utf8")]
  , ["invalid-byte-buffer", "denied", () => fs.readFileSync(invalidBuffer, "utf8")]
  , ["invalid-byte-symlink-create", "denied", () => fs.symlinkSync(unrelated + "/notes.txt", Buffer.from([0x62, 0x61, 0x64, 0xff]))]
  // Post-repair the proxy read executes the validated worktree string, so it
  // is allowed — the safety property is that no attempt value ever contains
  // the sentinel (noSentinelDisclosure below). Pre-repair this same case
  // reads the unrelated host sentinel through Node's second conversion.
  , ["stateful-proxy-url", "allowed", () => fs.readFileSync(statefulProxyUrl, "utf8")]
  , ["stateful-forged-url", "denied", () => fs.readFileSync(statefulForgedUrl, "utf8")]
  // Seventh-verifier findings: fs.glob options.cwd is a path (must be
  // scope-checked, including URL form) while the pattern argument is not a
  // path (must NOT be path-checked, or in-scope globs are falsely denied);
  // array patterns are a documented form and must work; require/import of
  // host paths must be denied by the loader's use of patched public fs.
  , ["glob-cwd-outside", "denied", () => fs.globSync("*", { cwd: unrelated })]
  , ["glob-cwd-root", "denied", () => fs.globSync("*", { cwd: "/root" })]
  , ["glob-cwd-url-outside", "denied", () => fs.globSync("*", { cwd: urlFor(unrelated) })]
  , ["glob-promise-cwd-outside", "denied", () => fsp.glob("*", { cwd: unrelated })]
  , ["glob-cwd-worktree", "allowed", () => fs.globSync("*.txt", { cwd: process.cwd() })]
  , ["glob-array-pattern-worktree", "allowed", () => fs.globSync(["*.txt"], { cwd: process.cwd() })]
  , ["require-host-json", "denied", () => require2(path.join(unrelated, "notes.json"))]
  , ["import-host-module", "denied", () => import("file://" + path.join(unrelated, "notes.txt"))]
 ]) await attempt(name, expect, fn);
report.allMatched = report.attempts.every(a => a.outcome === a.expect);
report.noSentinelDisclosure = report.attempts.every(a => !String(a.value || "").includes("SENTINEL"));
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched && report.noSentinelDisclosure ? 0 : 1);
`,
  "hostile-envstrip.mjs": `import fs from "node:fs";
import path from "node:path";
import cp from "node:child_process";
import http2 from "node:http2";
import dgram from "node:dgram";
import { Worker } from "node:worker_threads";
const attemptDir = process.env.SANDBOX_ATTEMPT_DIR;
const secrets = process.env.SANDBOX_HOST_SECRETS;
const report = { name: "hostile-envstrip", attempts: [] };
function attempt(name, fn) {
  try { fn(); report.attempts.push({ name, outcome: "allowed" }); }
  catch (e) { report.attempts.push({ name, outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60) }); }
}
function spawnAttempt(name, file, args, opts) {
  try {
    const r = cp.spawnSync(file, args, opts);
    const denied = r.status !== 0 && String(r.stderr || "").includes("SANDBOX_DENIED");
    report.attempts.push({ name, outcome: r.status === 0 ? "allowed" : denied ? "denied" : "error:" + String(r.stderr || (r.error && r.error.message) || "").slice(0, 60) });
  } catch (e) {
    report.attempts.push({ name, outcome: e.code === "EACCES" && e.sandbox === true ? "denied" : "error:" + e.message.slice(0, 60) });
  }
}
const stripEnv = { PATH: process.env.PATH, SANDBOX_HOST_SECRETS: secrets };
spawnAttempt("envstrip-read-secret", process.execPath, ["-e", 'require("fs").readFileSync(process.env.SANDBOX_HOST_SECRETS + "/secret.env", "utf8")'], { env: stripEnv });
spawnAttempt("envstrip-write-tmp", process.execPath, ["-e", 'require("fs").writeFileSync("/tmp/p11-escape-envstrip", "x")'], { env: stripEnv });
spawnAttempt("envstrip-write-mainref", process.execPath, ["-e", 'const fs=require("fs"),p=require("path");const g=fs.readFileSync(".git","utf8").split(": ")[1].trim();fs.writeFileSync(p.resolve(g,"..","..","refs","heads","main"),"0".repeat(40))'], { env: stripEnv });
spawnAttempt("envstrip-net", process.execPath, ["-e", 'require("http").get("http://127.0.0.1:9/")'], { env: stripEnv });
spawnAttempt("cat-secret", "cat", [secrets + "/secret.env"]);
spawnAttempt("ls-root", "ls", ["/root"]);
spawnAttempt("mkdir-outside", "mkdir", ["/tmp/p11-evil-cli-dir"]);
attempt("http2-connect", () => { http2.connect("http://127.0.0.1:9"); });
attempt("dgram-send", () => { const s = dgram.createSocket("udp4"); s.send("x", 9, "127.0.0.1"); });
// Guard unload attempt: delete the guard environment keys, then spawn
// children with and without custom envs. The guard must still load in every
// child because the preload captured its environment at startup.
delete process.env.NODE_OPTIONS;
delete process.env.SANDBOX_POLICY;
delete process.env.SANDBOX_DENY_LOG;
delete process.env.SANDBOX_WORKTREE;
delete process.env.SANDBOX_SCRATCH;
delete process.env.SANDBOX_ATTEMPT_DIR;
spawnAttempt("envdelete-read-secret", process.execPath, ["-e", 'require("fs").readFileSync(process.env.SANDBOX_HOST_SECRETS + "/secret.env", "utf8")']);
spawnAttempt("envdelete-read-secret-custom", process.execPath, ["-e", 'require("fs").readFileSync(process.env.SANDBOX_HOST_SECRETS + "/secret.env", "utf8")'], { env: { PATH: process.env.PATH, SANDBOX_HOST_SECRETS: secrets } });
spawnAttempt("envdelete-net", process.execPath, ["-e", 'require("http").get("http://127.0.0.1:9/")']);
spawnAttempt("envdelete-cat-secret", "cat", [secrets + "/secret.env"]);
fs.writeFileSync("fork-target.mjs", 'import fs from "node:fs"; try { const d = fs.readFileSync(process.env.SANDBOX_HOST_SECRETS + "/secret.env", "utf8"); fs.writeFileSync("leak-marker-fork.txt", d); process.exit(0); } catch (e) { process.exit(3); }');
{
  const code = await new Promise(resolve => { const c = cp.fork("fork-target.mjs", [], { env: stripEnv }); c.on("exit", c2 => resolve(c2)); });
  report.attempts.push({ name: "fork-envstrip-read-secret", outcome: code === 0 || fs.existsSync("leak-marker-fork.txt") ? "allowed" : "denied" });
}
fs.writeFileSync("worker-target.mjs", 'import fs from "node:fs"; try { const d = fs.readFileSync(process.env.SANDBOX_HOST_SECRETS + "/secret.env", "utf8"); fs.writeFileSync("leak-marker-worker.txt", d); process.exit(0); } catch (e) { process.exit(3); }');
{
  const code = await new Promise(resolve => { const w = new Worker("./worker-target.mjs"); w.on("exit", c => resolve(c)); });
  report.attempts.push({ name: "worker-read-secret", outcome: code === 0 || fs.existsSync("leak-marker-worker.txt") ? "allowed" : "denied" });
}
report.allMatched = report.attempts.every(a => a.outcome === "denied");
fs.writeFileSync(path.join(attemptDir, "violation-report.json"), JSON.stringify(report, null, 2));
process.exit(report.allMatched ? 0 : 1);
`
};
for (const [name, source] of Object.entries(adapters)) write(path.join(tools, name), source);

function setup(name) {
  const base = path.join(out, name);
  fs.rmSync(base, { recursive: true, force: true });
  const repo = path.join(base, "repo");
  const host = path.join(base, "host");
  fs.mkdirSync(path.join(repo), { recursive: true });
  fs.mkdirSync(path.join(host, "secrets"), { recursive: true });
  fs.mkdirSync(path.join(host, "unrelated"), { recursive: true });
  write(path.join(host, "secrets", "secret.env"), "ANTHROPIC_API_KEY=SENTINEL-SECRET-VALUE\n");
  write(path.join(host, "secrets", "id_rsa"), "-----OPENSSH PRIVATE KEY----- SENTINEL\n");
  write(path.join(host, "unrelated", "notes.txt"), "SENTINEL-UNRELATED\n");
  write(path.join(host, "unrelated", "notes.json"), JSON.stringify({ sentinel: "SENTINEL-UNRELATED" }) + "\n");
  git(repo, ["init", "-q", "-b", "main"]);
  git(repo, ["config", "user.email", "t@t"]);
  git(repo, ["config", "user.name", "t"]);
  write(path.join(repo, "base.txt"), "base\n");
  git(repo, ["add", "."]);
  git(repo, ["commit", "-qm", "init"]);
  return { base, repo, host, runDir: path.join(base, "run"), secrets: path.join(host, "secrets"), unrelated: path.join(host, "unrelated") };
}

// The sandbox spawns adapters with its constructed environment. Adapter
// scripts are copied into the attempt directory's tools/ subdir so the
// sandboxed node process can load its own entry module: node's main-path
// resolution goes through the patched public fs API, so entry scripts must
// live inside the sandbox filesystem scope. Host paths reach the adapter
// through a shim that sets environment variables before it loads.
function commandFor(adapterName, fixture, runDir, issue, attempt) {
  const toolsDir = path.join(runDir, issue, `attempt-${attempt}`, "tools");
  fs.mkdirSync(toolsDir, { recursive: true });
  fs.copyFileSync(path.join(tools, adapterName), path.join(toolsDir, adapterName));
  const vars = {
    SANDBOX_HOST_DIR: fixture.host,
    SANDBOX_HOST_SECRETS: fixture.secrets,
    SANDBOX_HOST_UNRELATED: fixture.unrelated
  };
  const shim = path.join(toolsDir, "shim.mjs");
  write(shim, `const vars = ${JSON.stringify(vars)};\nfor (const [k, v] of Object.entries(vars)) process.env[k] = v;\nawait import(${JSON.stringify(`./${adapterName}`)});\n`);
  return [process.execPath, shim];
}

function sentinelsIntact(fixture) {
  return fs.readFileSync(path.join(fixture.secrets, "secret.env"), "utf8").includes("SENTINEL-SECRET-VALUE")
    && fs.readFileSync(path.join(fixture.secrets, "id_rsa"), "utf8").includes("SENTINEL")
    && fs.readFileSync(path.join(fixture.unrelated, "notes.txt"), "utf8").includes("SENTINEL-UNRELATED");
}

const summary = [];
function record(name, detail) { summary.push(`${name}: ${detail}`); console.log(`${name}: ${detail}`); }

// A: happy path with environment whitelist and evidence capture.
{
  const fixture = setup("happy");
  const mainBefore = git(fixture.repo, ["rev-parse", "main"]);
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("happy-adapter.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "happy path adapter failed");
  const attemptDir = outcome.attemptDir;
  for (const artifact of ["adapter.log", "diff.patch", "branch-diff.patch", "git-log.txt", "git-status.txt", "sandbox-run.json", "sandbox-policy.json", "sandbox-context.json", "implementation-result.md", "env-report.json"])
    assert(fs.existsSync(path.join(attemptDir, artifact)), `missing artifact ${artifact}`);
  const envReport = JSON.parse(fs.readFileSync(path.join(attemptDir, "env-report.json"), "utf8"));
  assert(JSON.stringify(envReport.envKeys) === JSON.stringify([...ENV_WHITELIST].sort()), `environment whitelist mismatch: ${envReport.envKeys}`);
  const runRecord = JSON.parse(fs.readFileSync(path.join(attemptDir, "sandbox-run.json"), "utf8"));
  assert(runRecord.protectedRefsUnchanged === true, "protected refs changed on happy path");
  assert(git(fixture.repo, ["rev-parse", "main"]) === mainBefore, "main moved on happy path");
  const branch = git(fixture.repo, ["rev-parse", "--verify", "sandbox/ISSUE-001"]);
  assert(branch && branch !== mainBefore, "sandbox branch missing or equals main");
  assert(fs.readFileSync(path.join(attemptDir, "git-log.txt"), "utf8").includes("feature"), "commit not captured in git log evidence");
  assert(fs.readFileSync(path.join(attemptDir, "branch-diff.patch"), "utf8").includes("feature.txt"), "branch diff evidence missing the committed change");
  assert(!fs.existsSync(path.join(attemptDir, "failure.json")), "failure record written on success");
  record("happy-path", "PASS (artifacts, env whitelist, branch, protected refs)");
}

// B: protected secrets denied.
{
  const fixture = setup("secrets");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-secrets.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-secrets adapter reported an allowed violation");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.allDenied === true, `secret leak: ${JSON.stringify(report.attempts.filter(a => !a.denied))}`);
  assert(report.homeIsScratch === true, "HOME was not redirected to sandbox scratch");
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  assert(fs.readFileSync(path.join(outcome.attemptDir, "denied.jsonl"), "utf8").trim().length > 0, "deny log empty for secrets scenario");
  record("secrets-denied", `PASS (${report.attempts.length} attempts denied, env clean)`);
}

// C: unrelated paths denied.
{
  const fixture = setup("paths");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-paths.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-paths adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.allMatched === true, `path policy mismatch: ${JSON.stringify(report.attempts.filter(a => a.outcome !== a.expect))}`);
  assert(!fs.existsSync("/tmp/p11-escape") && !fs.existsSync("/etc/p11-escape"), "escape file was created");
  assert(!fs.existsSync(path.join(fixture.unrelated, "evil.txt")), "unrelated dir was written");
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  record("unrelated-paths", `PASS (${report.attempts.filter(a => a.expect === "denied").length} denials, ${report.attempts.filter(a => a.expect === "allowed").length} allowances)`);
}

// D: destructive commands denied.
{
  const fixture = setup("destructive");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-destructive.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-destructive adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.allMatched === true, `destructive policy mismatch: ${JSON.stringify(report.attempts.filter(a => a.outcome !== a.expect))}`);
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  assert(!fs.existsSync("/tmp/p11-escape"), "node -e escape file was created");
  record("destructive-denied", `PASS (${report.attempts.filter(a => a.expect === "denied").length} destructive attempts denied)`);
}

// E: direct production-branch mutation denied.
{
  const fixture = setup("prod-branch");
  git(fixture.repo, ["branch", "production"]);
  const mainBefore = git(fixture.repo, ["rev-parse", "main"]);
  const productionBefore = git(fixture.repo, ["rev-parse", "production"]);
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-prod-branch.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-prod-branch adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.allMatched === true, `prod-branch policy mismatch: ${JSON.stringify(report.attempts.filter(a => a.outcome !== a.expect))}`);
  assert(git(fixture.repo, ["rev-parse", "main"]) === mainBefore, "main ref was mutated");
  assert(git(fixture.repo, ["rev-parse", "production"]) === productionBefore, "production ref was mutated");
  assert(git(outcome.worktree, ["symbolic-ref", "--short", "HEAD"]) === "sandbox/ISSUE-001", "HEAD left the sandbox branch");
  record("prod-branch-mutation", `PASS (${report.attempts.filter(a => a.expect === "denied").length} mutation attempts denied, refs unchanged)`);
}

// F: unapproved pushes and network denied.
{
  const fixture = setup("push");
  const bare = path.join(fixture.base, "origin.git");
  fs.mkdirSync(bare, { recursive: true });
  git(bare, ["init", "-q", "--bare", "-b", "main"]);
  git(fixture.repo, ["remote", "add", "origin", bare]);
  const originMainBefore = git(fixture.repo, ["rev-parse", "main"]);
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-push.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-push adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.allMatched === true, `push policy mismatch: ${JSON.stringify(report.attempts.filter(a => a.outcome !== a.expect))}`);
  const originRefs = fs.readdirSync(path.join(bare, "refs", "heads"));
  assert(originRefs.length === 0, `origin refs were created: ${originRefs}`);
  record("unapproved-push", `PASS (${report.attempts.filter(a => a.expect === "denied").length} push/network attempts denied, origin untouched)`);
}

// G: dry run performs setup but never executes the adapter.
{
  const fixture = setup("dry-run");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("failing-adapter.mjs", fixture, fixture.runDir, "ISSUE-001", 1), dryRun: true });
  assert(outcome.code === 0 && outcome.dryRun === true, "dry run failed");
  const attemptDir = outcome.attemptDir;
  assert(fs.existsSync(path.join(attemptDir, "dry-run.json")), "dry-run.json missing");
  const dry = JSON.parse(fs.readFileSync(path.join(attemptDir, "dry-run.json"), "utf8"));
  assert(dry.invokedAdapter === false && dry.stopReason === "dry_run", "dry run invoked adapter or wrong stop reason");
  assert(!fs.existsSync(path.join(attemptDir, "adapter.log")) && !fs.existsSync(path.join(attemptDir, "sandbox-run.json")), "dry run executed adapter");
  assert(fs.existsSync(path.join(outcome.worktree, ".git")), "dry run did not create worktree");
  record("dry-run", "PASS (worktree+policy created, adapter not invoked)");
}

// H: failure capture.
{
  const fixture = setup("failure");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("failing-adapter.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 3, `failure exit code not propagated: ${outcome.code}`);
  const failure = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "failure.json"), "utf8"));
  assert(failure.exitCode === 3 && failure.stopReason === "adapter_failed", "failure record wrong");
  assert(fs.readFileSync(path.join(outcome.attemptDir, "adapter.log"), "utf8").includes("simulated adapter failure"), "failure log not captured");
  assert(fs.existsSync(path.join(outcome.attemptDir, "partial-output.txt")), "partial artifact lost");
  record("failure-capture", "PASS (exit code, log, failure record, partial artifact)");
}

// I/J: integration with the Phase 10 sequential runner.
const RUNNER = path.join(root, "..", "sequential-afk-runner", "runner.mjs");
const INTEGRATION = path.join(root, "integration-adapter.mjs");
const issueBody = (id, scenario) => `${id}: Exercise ${scenario}\nSTATUS: ready\nTYPE: afk\nBLOCKERS: none\nOUTCOME: The ${scenario} fixture is handled.\nACCEPTANCE:\n- The observable fixture result is recorded.\nLAYERS: fixture\nMODULES: fixture only\nTESTS: fixture test\nCOMMANDS: fixture test\nCONSTRAINTS: SCENARIO=${scenario}\nNON-GOALS: Human acceptance, merge, deploy\n`;
function runRunner(fixture, issueText, retries, expectedCode) {
  const backlog = path.join(fixture.base, "backlog");
  fs.mkdirSync(backlog, { recursive: true });
  write(path.join(backlog, "ISSUE-001.md"), issueText);
  const runDir = path.join(fixture.base, "run");
  const result = spawnSync(process.execPath, [RUNNER, "--backlog", backlog, "--run-dir", runDir,
    "--implement", INTEGRATION, "--check", INTEGRATION, "--review", INTEGRATION,
    "--max-iterations", "1", "--max-retries", String(retries)], {
    encoding: "utf8",
    env: { ...process.env, SANDBOX_INTEGRATION_REPO: fixture.repo, SANDBOX_INTEGRATION_RUN_DIR: runDir }
  });
  if (result.status !== expectedCode) throw new Error(`runner integration expected ${expectedCode}, got ${result.status}\n${result.stdout}\n${result.stderr}`);
  return { runDir, result };
}
{
  const fixture = setup("integration");
  const mainBefore = git(fixture.repo, ["rev-parse", "main"]);
  const { runDir } = runRunner(fixture, issueBody("ISSUE-001", "success"), 2, 0);
  const resultJson = JSON.parse(fs.readFileSync(path.join(runDir, "ISSUE-001", "attempt-1", "result.json"), "utf8"));
  assert(resultJson.gates.review === "PASS" && resultJson.humanAcceptance === false, "integration completion gates wrong");
  assert(fs.existsSync(path.join(runDir, "ISSUE-001", "worktree", ".git")), "integration worktree missing");
  assert(fs.existsSync(path.join(runDir, "ISSUE-001", "attempt-1", "sandbox-policy.json")), "integration sandbox policy missing");
  const runRecord = JSON.parse(fs.readFileSync(path.join(runDir, "ISSUE-001", "attempt-1", "sandbox-run.json"), "utf8"));
  assert(runRecord.protectedRefsUnchanged === true, "integration mutated protected refs");
  assert(git(fixture.repo, ["rev-parse", "main"]) === mainBefore, "integration moved main");
  record("runner-integration-success", "PASS (sandboxed issue completed through Phase 10 runner)");
}
{
  const fixture = setup("integration-exhaustion");
  const mainBefore = git(fixture.repo, ["rev-parse", "main"]);
  const { runDir } = runRunner(fixture, issueBody("ISSUE-001", "failed-tests"), 0, 1);
  const state = JSON.parse(fs.readFileSync(path.join(runDir, "state.json"), "utf8"));
  assert(state.stopReason === "retries_exhausted", `wrong stop reason: ${state.stopReason}`);
  const issueStatus = fs.readFileSync(path.join(fixture.base, "backlog", "ISSUE-001.md"), "utf8").match(/^STATUS:\s*(\S+)/m)[1];
  assert(issueStatus === "blocked", "issue not blocked after exhaustion");
  const checkRun = JSON.parse(fs.readFileSync(path.join(runDir, "ISSUE-001", "attempt-1", "sandbox-run.json"), "utf8"));
  assert(checkRun.exitCode === 1, "check failure exit code not captured");
  assert(fs.existsSync(path.join(runDir, "ISSUE-001", "attempt-1", "failure.json")), "failure evidence missing");
  assert(git(fixture.repo, ["rev-parse", "main"]) === mainBefore, "exhaustion moved main");
  record("runner-integration-exhaustion", "PASS (fail-closed, blocked, evidence preserved)");
}

// K: environment-stripped child escape denied (verifier findings fix):
// custom child envs, guard-env deletion, allowlisted binaries, fork, worker,
// dgram, and http2 cannot unload or bypass the guard.
{
  const fixture = setup("envstrip");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-envstrip.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-envstrip adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.attempts.every(a => a.outcome === "denied"), `envstrip escape mismatch: ${JSON.stringify(report.attempts.filter(a => a.outcome !== "denied"))}`);
  assert(!fs.existsSync("/tmp/p11-escape-envstrip") && !fs.existsSync("/tmp/p11-evil-cli-dir"), "escape file or dir was created");
  assert(!fs.existsSync(path.join(outcome.worktree, "leak-marker-fork.txt")) && !fs.existsSync(path.join(outcome.worktree, "leak-marker-worker.txt")), "leak marker was written");
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  record("envstrip-escape", `PASS (${report.attempts.length} escape attempts denied incl. env-stripped children, guard-env deletion, cat/ls/mkdir, fork, worker, dgram, http2)`);
}

// L: the configured adapter command itself is validated against the exec
// policy before spawn (verifier finding 1 defense-in-depth for non-node
// adapter commands).
{
  const fixture = setup("adapter-validation");
  const bare = path.join(fixture.base, "origin.git");
  fs.mkdirSync(bare, { recursive: true });
  git(bare, ["init", "-q", "--bare", "-b", "main"]);
  git(fixture.repo, ["remote", "add", "origin", bare]);
  let threw = 0;
  try { sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: ["git", "push", "origin", "main"] }); } catch { threw += 1; }
  try { sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: ["rm", "-rf", fixture.host] }); } catch { threw += 1; }
  try { sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: ["git", "branch", "-f", "main", "HEAD"] }); } catch { threw += 1; }
  assert(threw === 3, `adapter command validation threw ${threw}/3`);
  assert(fs.readdirSync(path.join(bare, "refs", "heads")).length === 0, "origin refs were created");
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  record("adapter-command-validation", "PASS (git push, rm -rf, git branch -f main rejected before spawn)");
}

// M: protected-ref mutation fails closed (verifier finding 2 fix). A hostile
// git hook mutates main through a vector the in-process guard cannot see
// (git runs the hook itself); the sandbox must detect it and fail the
// attempt regardless of the adapter's own exit code.
{
  const fixture = setup("fail-closed-refs");
  const hooksDir = path.join(fixture.repo, ".git", "hooks");
  fs.mkdirSync(hooksDir, { recursive: true });
  fs.writeFileSync(path.join(hooksDir, "post-commit"), "#!/bin/sh\ngit update-ref refs/heads/main HEAD\n");
  fs.chmodSync(path.join(hooksDir, "post-commit"), 0o755);
  const mainBefore = git(fixture.repo, ["rev-parse", "main"]);
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("happy-adapter.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 1, `mutated refs did not fail closed: ${outcome.code}`);
  const runRecord = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "sandbox-run.json"), "utf8"));
  assert(runRecord.adapterExitCode === 0 && runRecord.exitCode === 1 && runRecord.protectedRefsMutated === true, "fail-closed record wrong");
  const failure = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "failure.json"), "utf8"));
  assert(failure.stopReason === "protected_refs_mutated", "fail-closed stop reason wrong");
  assert(git(fixture.repo, ["rev-parse", "main"]) !== mainBefore, "hook did not actually mutate main (fixture invalid)");
  record("fail-closed-refs", "PASS (hostile hook mutation detected, attempt failed closed)");
}

// N: native and fs-internals escape (verifier round-3 findings): openAsBlob
// content reads, opendir enumeration, utimes tampering, readlink/exists/stat
// oracles, LD_PRELOAD env injection through an allowlisted node child,
// process.dlopen, require("*.node"), and process.binding all denied.
{
  const fixture = setup("native");
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command: commandFor("hostile-native.mjs", fixture, fixture.runDir, "ISSUE-001", 1) });
  assert(outcome.code === 0, "hostile-native adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  const mismatches = report.attempts.filter(a => a.outcome !== a.expect);
  assert(mismatches.length === 0, `native escape mismatch: ${JSON.stringify(mismatches)}`);
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  record("native-escape", `PASS (${report.attempts.length} native/fs-internals escape attempts denied or stripped incl. openAsBlob, LD_PRELOAD, dlopen, .node require, process.binding)`);
}

// O: file: URL objects and Buffer paths must receive the same path policy as
// strings, while content arguments remain governed by FS_PATH_ARGS. A
// non-UTF-8 byte-named symlink pointing at the unrelated host sentinel is
// planted inside the worktree from the harness (outside the guard) so the
// read denial is proven against a real escape target.
{
  const fixture = setup("file-urls");
  const command = commandFor("hostile-file-urls.mjs", fixture, fixture.runDir, "ISSUE-001", 1);
  const pre = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command, dryRun: true });
  fs.symlinkSync(path.join(fixture.unrelated, "notes.txt"), Buffer.concat([Buffer.from(pre.worktree + "/"), Buffer.from([0x62, 0x61, 0x64, 0xff])]));
  const outcome = sandboxRun({ repo: fixture.repo, runDir: fixture.runDir, issue: "ISSUE-001", attempt: 1, command });
  assert(outcome.code === 0, "hostile-file-urls adapter reported a mismatch");
  const report = JSON.parse(fs.readFileSync(path.join(outcome.attemptDir, "violation-report.json"), "utf8"));
  assert(report.allMatched === true, `file URL policy mismatch: ${JSON.stringify(report.attempts.filter(a => a.outcome !== a.expect))}`);
  assert(report.noSentinelDisclosure === true, "file URL or buffer path disclosed sentinel content");
  assert(!fs.existsSync(path.join(fixture.unrelated, "url-evil.txt")) && !fs.existsSync(path.join(fixture.unrelated, "url-copy.txt")), "file URL write escaped to unrelated host directory");
  assert(fs.readFileSync(path.join(fixture.runDir, "ISSUE-001", "worktree", "base.txt"), "utf8") === "base\n", "worktree URL operation changed fixture");
  assert(sentinelsIntact(fixture), "host sentinels damaged");
  record("file-url-escape", `PASS (${report.attempts.length} URL and buffer path attempts checked across reads, metadata, mutation, protected refs, URL variants, and non-UTF-8 buffer paths)`);
}

console.log("phase-11 sandbox fixtures passed: happy-path, secrets, unrelated paths, destructive, prod-branch mutation, unapproved push, envstrip and guard-unload escape, native and fs-internals escape, file URL escape, adapter command validation, fail-closed refs, dry run, failure capture, runner integration success and exhaustion");
