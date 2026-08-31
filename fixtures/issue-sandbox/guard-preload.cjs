// Phase 11 in-process sandbox guard, loaded via NODE_OPTIONS --require.
// Enforces the sandbox policy inside the adapter process and EVERY child it
// spawns: filesystem scope, protected git refs, allowlist exec policy, and
// network denial. Child containment does not rely on env inheritance: the
// guard environment (including NODE_OPTIONS and PATH) is captured at load
// time and force-injected into every spawned child, fork, and worker, so a
// hostile adapter cannot unload the guard by editing or deleting
// process.env. Every denial is appended to the deny log and throws EACCES
// with a SANDBOX_DENIED prefix.
"use strict";
const rawFs = require("node:fs");
const rawPath = require("node:path");
const rawCP = require("node:child_process");
const rawFileURLToPath = require("node:url").fileURLToPath;
const rawRealpathSync = rawFs.realpathSync.native;
const rawAppendFileSync = rawFs.appendFileSync;
const rawAccessSync = rawFs.accessSync;

const POLICY_FILE = process.env.SANDBOX_POLICY;
const DENY_LOG = process.env.SANDBOX_DENY_LOG;
if (POLICY_FILE && DENY_LOG) {
  const policy = JSON.parse(rawFs.readFileSync(POLICY_FILE, "utf8"));
  const EXEC_PATH = process.execPath;
  const scopes = (policy.fsScope || []).map(p => rawPath.resolve(p));
  const denyPrefixes = policy.fsDenyPrefixes || [];
  const protectedNames = policy.protectedBranchNames || [];
  const allowedBinaries = new Set(policy.allowedBinaries || []);
  const gitAllowed = new Set(policy.gitAllowedSubcommands || []);
  const gitDenied = new Set(policy.gitAlwaysDeniedSubcommands || []);
  const systemRead = ["/dev/null", "/dev/zero", "/dev/random", "/dev/urandom", "/dev/full"];
  const WRITE_FLAGS = new Set(["r+", "w", "w+", "wx", "w+x", "xw", "xw+", "a", "a+", "ax", "a+x", "xa", "xa+"]);
  const GUARD_ENV_KEYS = ["NODE_OPTIONS", "SANDBOX_POLICY", "SANDBOX_DENY_LOG", "SANDBOX_WORKTREE", "SANDBOX_SCRATCH", "SANDBOX_ATTEMPT_DIR", "PATH"];
  const FROZEN_GUARD_ENV = {};
  for (const key of GUARD_ENV_KEYS) if (process.env[key] !== undefined) FROZEN_GUARD_ENV[key] = process.env[key];
  const TRUSTED_DIRS = new Set([rawPath.dirname(EXEC_PATH), "/usr/bin", "/bin", "/usr/local/bin", "/usr/sbin", "/sbin"].map(d => rawPath.resolve(d)));

  function deny(kind, detail) {
    try { rawAppendFileSync.call(rawFs, DENY_LOG, `${JSON.stringify({ ts: new Date().toISOString(), kind, detail })}\n`); } catch {}
    const error = new Error(`SANDBOX_DENIED: ${kind}: ${detail}`);
    error.code = "EACCES";
    error.sandbox = true;
    throw error;
  }

  // Byte-preserving path text: Buffer paths can contain arbitrary bytes on
  // POSIX, and a Buffer that is not lossless UTF-8 cannot be checked as a
  // JS string without changing the bytes the original fs API will use
  // (Node re-encodes strings to UTF-8 at the native boundary). Such Buffers
  // fail closed. Lossless UTF-8 Buffers decode to a string that re-encodes
  // to the identical bytes, so validating the string is byte-equivalent to
  // validating the Buffer.
  function pathText(p) {
    if (!Buffer.isBuffer(p)) return String(p);
    const text = p.toString("utf8");
    if (Buffer.from(text, "utf8").equals(p)) return text;
    deny("fs-path", "buffer path is not lossless UTF-8 and cannot be safely validated");
  }

  function realPathBestEffort(p) {
    let target = rawPath.resolve(pathText(p));
    for (let i = 0; i < 64; i += 1) {
      try { return rawRealpathSync.call(rawFs, target); }
      catch (e) {
        if (e.code !== "ENOENT" && e.code !== "ENOTDIR") return target;
        const parent = rawPath.dirname(target);
        if (parent === target) return target;
        target = parent;
      }
    }
    return target;
  }

  function isProtectedWrite(resolved) {
    if (/(^|\/)\.git\/packed-refs(\.lock)?$/.test(resolved)) return true;
    if (/(^|\/)\.git\/HEAD(\.lock)?$/.test(resolved)) return true;
    for (const name of protectedNames) {
      if (resolved.endsWith(`/.git/refs/heads/${name}`) || resolved.endsWith(`/.git/refs/heads/${name}.lock`)) return true;
    }
    return false;
  }

  function inScope(resolved) {
    return scopes.some(scope => resolved === scope || resolved.startsWith(scope + rawPath.sep));
  }

  function checkPath(p, writing) {
    const text = pathText(p);
    const resolved = rawPath.resolve(text);
    const real = realPathBestEffort(text);
    if (writing && (isProtectedWrite(resolved) || isProtectedWrite(real))) deny("fs-write-protected-ref", resolved);
    for (const candidate of [resolved, real]) {
      if (denyPrefixes.some(prefix => candidate === prefix || candidate.startsWith(prefix + "/"))) {
        deny(writing ? "fs-write" : "fs-read", candidate);
      }
    }
    if (!writing && systemRead.includes(resolved)) return;
    if (!inScope(real)) deny(writing ? "fs-write" : "fs-read", resolved);
  }

  // Realm-independent URL detection: a URL created in another JavaScript
  // realm fails instanceof URL here, so brand-check via the spec's own
  // toStringTag instead. Only genuine WHATWG URL objects convert; forged
  // URL-like plain objects are rejected by the unsupported-representation
  // denial below.
  function normalizePathArgument(candidate) {
    if (typeof candidate === "string" || Buffer.isBuffer(candidate)) return candidate;
    if (candidate !== null && typeof candidate === "object"
        && Object.prototype.toString.call(candidate) === "[object URL]") {
      try { return rawFileURLToPath(candidate); }
      catch (error) { deny("fs-path", `invalid file URL: ${error.message}`); }
    }
    deny("fs-path", "unsupported filesystem path representation");
  }

  const FS_PATH_ARGS = new Map(Object.entries({
    open: [0], openSync: [0], readFile: [0], readFileSync: [0],
    writeFile: [0], writeFileSync: [0], appendFile: [0], appendFileSync: [0],
    truncate: [0], truncateSync: [0], chmod: [0], chmodSync: [0],
    unlink: [0], unlinkSync: [0], rmdir: [0], rmdirSync: [0], rm: [0], rmSync: [0],
    mkdir: [0], mkdirSync: [0], mkdtemp: [0], mkdtempSync: [0],
    readdir: [0], readdirSync: [0], realpath: [0], realpathSync: [0],
    createReadStream: [0], createWriteStream: [0],
    rename: [0, 1], renameSync: [0, 1], copyFile: [0, 1], copyFileSync: [0, 1],
    link: [0, 1], linkSync: [0, 1],
    symlink: [1], symlinkSync: [1],
    openAsBlob: [0], opendir: [0], opendirSync: [0],
    readlink: [0], readlinkSync: [0],
    utimes: [0], utimesSync: [0], lutimes: [0], lutimesSync: [0],
    access: [0], accessSync: [0], exists: [0], existsSync: [0],
    stat: [0], statSync: [0], lstat: [0], lstatSync: [0],
    statfs: [0], statfsSync: [0], glob: [0], globSync: [0],
    chown: [0], chownSync: [0], lchown: [0], lchownSync: [0],
    cp: [0, 1], cpSync: [0, 1],
    watch: [0], watchFile: [0]
  }));
  const WRITE_OPS = new Set(["writeFile", "writeFileSync", "appendFile", "appendFileSync",
    "rename", "renameSync", "copyFile", "copyFileSync", "truncate", "truncateSync",
    "chmod", "chmodSync", "rm", "rmSync", "unlink", "unlinkSync", "rmdir", "rmdirSync",
    "mkdir", "mkdirSync", "mkdtemp", "mkdtempSync", "link", "linkSync",
    "symlink", "symlinkSync", "createWriteStream", "open", "openSync",
    "utimes", "utimesSync", "lutimes", "lutimesSync", "cp", "cpSync",
    "chown", "chownSync", "lchown", "lchownSync"]);

  function patchFsTarget(target, name) {
    const original = target[name];
    if (typeof original !== "function") return;
    const pathArgs = FS_PATH_ARGS.get(name) || [0];
    target[name] = function wrapped(...args) {
      let writing = WRITE_OPS.has(name);
      if (name === "open" || name === "openSync") {
        const flag = args[1] === undefined ? "r" : String(args[1]);
        if (WRITE_FLAGS.has(flag) || /w|a|x/.test(flag)) writing = true;
      }
      for (const index of pathArgs) {
        const candidate = args[index];
        checkPath(normalizePathArgument(candidate), writing);
      }
      return original.apply(this, args);
    };
  }

  for (const name of FS_PATH_ARGS.keys()) patchFsTarget(rawFs, name);
  if (rawFs.promises) {
    for (const name of FS_PATH_ARGS.keys()) patchFsTarget(rawFs.promises, name);
  }

  function isAllowedExecutable(file) {
    const s = String(file);
    const base = rawPath.basename(s);
    if (!allowedBinaries.has(base)) return false;
    if (!s.includes("/")) return true; // bare name: resolved via the frozen PATH
    return TRUSTED_DIRS.has(rawPath.resolve(rawPath.dirname(s)));
  }

  function checkCommand(file, args, opts) {
    if (opts && opts.shell) deny("exec", "shell option is not allowed");
    if (!isAllowedExecutable(file)) deny("exec", `executable not allowed: ${file}`);
    const base = rawPath.basename(String(file));
    if (base === "git") {
      const argv = (args || []).map(String);
      const sub = argv.find(a => !a.startsWith("-"));
      if (sub === undefined || gitDenied.has(sub) || !gitAllowed.has(sub)) deny("exec", `git subcommand denied: ${sub}`);
      for (const arg of argv) {
        if (arg.startsWith("--git-dir") || arg.startsWith("--work-tree") || /^--output(=|$)/.test(arg))
          deny("exec", `git flag denied: ${arg}`);
      }
      const cIndex = argv.indexOf("-C");
      if (cIndex !== -1 && argv[cIndex + 1] !== undefined) {
        const target = rawPath.resolve(argv[cIndex + 1]);
        const real = realPathBestEffort(target);
        if (!inScope(target) && !inScope(real)) deny("exec", `git -C outside sandbox scope: ${argv[cIndex + 1]}`);
      }
      const plain = argv.filter(a => !a.startsWith("-") && a !== sub).map(a => a.replace(/^refs\/heads\//, ""));
      if (sub === "branch") {
        const flags = argv.filter(a => a.startsWith("-")).join("");
        if (/f|D|d/.test(flags)) deny("exec", `git branch force/mutation denied: ${argv.join(" ")}`);
        if (plain.some(a => protectedNames.includes(a))) deny("exec", `git branch operation on protected ref: ${argv.join(" ")}`);
      }
      if (sub === "checkout" && plain.some(a => protectedNames.includes(a)))
        deny("exec", `git checkout of protected branch: ${argv.join(" ")}`);
      if (sub === "config" && argv.some(a => /^--(global|system|edit)$/.test(a) || a === "-e"))
        deny("exec", `git config scope denied: ${argv.join(" ")}`);
    }
    return true;
  }

  function forcedGuardEnv() {
    return { ...FROZEN_GUARD_ENV };
  }

  const rawAccess = rawAccessSync;
  function resolveExecutable(file) {
    const s = String(file);
    if (s.includes("/")) return s;
    const pathEnv = FROZEN_GUARD_ENV.PATH || "/usr/bin:/bin";
    for (const dir of pathEnv.split(":")) {
      if (!dir) continue;
      const candidate = rawPath.join(dir, s);
      try { rawAccess.call(rawFs, candidate, rawFs.constants.X_OK); return candidate; }
      catch {}
    }
    return null;
  }

  // Dynamic-loader injection keys (LD_*, DYLD_*) and NODE_PATH are stripped
  // from every child environment: a hostile adapter must not be able to load
  // native code through an allowlisted child via LD_PRELOAD or redirect
  // module resolution outside the sandbox.
  const STRIP_ENV_RE = /^(LD_|DYLD_)/i;
  function sanitizeEnv(base) {
    const clean = {};
    for (const [key, value] of Object.entries(base)) {
      if (STRIP_ENV_RE.test(key)) continue;
      if (key === "NODE_PATH") continue;
      clean[key] = value;
    }
    return clean;
  }

  function buildChildEnv(base) {
    return { ...sanitizeEnv(base), ...forcedGuardEnv() };
  }

  function applyGuardEnv(opts) {
    if (opts.env === undefined || opts.env === null) opts.env = buildChildEnv(process.env);
    else if (typeof opts.env === "object" && !Array.isArray(opts.env)) opts.env = buildChildEnv(opts.env);
  }

  function wrapChildFn(original, isFork) {
    return function wrapped(...invoke) {
      const file = invoke[0];
      const args = invoke[1];
      let opts;
      if (invoke.length > 2 && invoke[2] !== null && typeof invoke[2] === "object" && !Array.isArray(invoke[2])) opts = invoke[2];
      else if (!Array.isArray(args) && args !== null && typeof args === "object") opts = args;
      const argv = Array.isArray(args) ? args : [];
      let checkFile = file;
      let checkArgs = argv;
      if (isFork) {
        checkFile = EXEC_PATH;
        checkArgs = [String(file), ...argv];
      } else {
        const resolved = resolveExecutable(file);
        if (resolved === null) deny("exec", `executable not resolvable via sandbox PATH: ${file}`);
        checkFile = resolved;
        invoke[0] = resolved;
      }
      checkCommand(checkFile, checkArgs, opts);
      if (opts) {
        applyGuardEnv(opts);
      } else {
        const insertAt = Array.isArray(invoke[1]) ? 2 : 1;
        invoke.splice(insertAt, 0, { env: buildChildEnv(process.env) });
      }
      return original.apply(this, invoke);
    };
  }

  for (const name of ["spawn", "spawnSync", "execFile", "execFileSync"]) {
    const original = rawCP[name];
    if (typeof original !== "function") continue;
    rawCP[name] = wrapChildFn(original, false);
  }
  const rawFork = rawCP.fork;
  if (typeof rawFork === "function") {
    rawCP.fork = wrapChildFn(rawFork, true);
  }
  for (const name of ["exec", "execSync"]) {
    rawCP[name] = function wrapped() { deny("exec", `shell execution is denied (${name})`); };
  }

  // In-process native code execution is denied: process.dlopen,
  // require("*.node") via Module._extensions, and the deprecated
  // process.binding/_linkedBinding internal escape hatches. Native code
  // would bypass every JS-level patch, so loading it at all is denied.
  try {
    if (typeof process.dlopen === "function") {
      process.dlopen = function guardedDlopen() { deny("exec", "process.dlopen native module loading is denied"); };
    }
  } catch {}
  try {
    const Module = require("node:module");
    if (Module && Module._extensions && Module._extensions[".node"]) {
      Module._extensions[".node"] = function deniedNodeAddon() {
        deny("exec", "native addon (.node) loading is denied");
      };
    }
  } catch {}
  for (const name of ["binding", "_linkedBinding"]) {
    try {
      if (typeof process[name] === "function") {
        process[name] = function deniedBinding() { deny("exec", `process.${name} is denied`); };
      }
    } catch {}
  }

  try {
    const rawWT = require("node:worker_threads");
    if (rawWT && typeof rawWT.Worker === "function") {
      const RawWorker = rawWT.Worker;
      const GuardedWorker = class extends RawWorker {
        constructor(filename, options) {
          const opts = options && typeof options === "object" ? { ...options } : {};
          const baseArgv = Array.isArray(opts.execArgv) ? opts.execArgv : process.execArgv;
          opts.execArgv = [...baseArgv, "--require", policy.preload];
          opts.env = buildChildEnv(opts.env && typeof opts.env === "object" ? opts.env : process.env);
          super(filename, opts);
        }
      };
      rawWT.Worker = GuardedWorker;
    }
  } catch {}

  const rawNet = require("node:net");
  const rawDns = require("node:dns");
  const rawTls = require("node:tls");
  const rawHttp = require("node:http");
  const rawHttps = require("node:https");
  const rawHttp2 = require("node:http2");
  const rawDgram = require("node:dgram");
  const netDeny = kind => deny("network", `${kind}: network access is denied by policy`);
  rawNet.Socket.prototype.connect = function () { netDeny("net.connect"); };
  rawNet.connect = () => { netDeny("net.connect"); };
  rawNet.createConnection = rawNet.connect;
  rawDns.lookup = () => { netDeny("dns.lookup"); };
  rawDns.resolve = () => { netDeny("dns.resolve"); };
  if (rawDns.promises) {
    rawDns.promises.lookup = async () => { netDeny("dns.lookup"); };
    rawDns.promises.resolve = async () => { netDeny("dns.resolve"); };
  }
  rawTls.connect = () => { netDeny("tls.connect"); };
  rawHttp.request = () => { netDeny("http.request"); };
  rawHttp.get = () => { netDeny("http.get"); };
  rawHttps.request = () => { netDeny("https.request"); };
  rawHttps.get = () => { netDeny("https.get"); };
  rawHttp2.connect = () => { netDeny("http2.connect"); };
  if (rawDgram && rawDgram.Socket) {
    rawDgram.Socket.prototype.send = function () { netDeny("dgram.send"); };
    rawDgram.Socket.prototype.connect = function () { netDeny("dgram.connect"); };
  }
}
