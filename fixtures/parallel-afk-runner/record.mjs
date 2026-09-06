#!/usr/bin/env node
// Evidence recorder for Phase 12 validation. Runs a command, captures its
// combined output to a log file, and writes a complete per-command record
// (command array, cwd, environment provenance, started-at, duration, exit
// code, log path) next to the log. Replaces the buggy record-run.sh pattern:
// argv is parsed by scanning, never by assumed positions.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
let name = null;
let log = null;
const cmd = [];
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === "--name" && argv[i + 1] !== undefined) name = argv[++i];
  else if (argv[i] === "--log" && argv[i + 1] !== undefined) log = argv[++i];
  else if (argv[i] === "--") {
    for (let j = i + 1; j < argv.length; j += 1) cmd.push(argv[j]);
    break;
  } else {
    process.stderr.write(`record.mjs: unexpected argument ${argv[i]}\n`);
    process.exit(2);
  }
}
if (!name || !log || cmd.length === 0) {
  process.stderr.write("usage: record.mjs --name NAME --log PATH -- COMMAND [ARGS...]\n");
  process.exit(2);
}

const startedAt = new Date().toISOString();
const t0 = Date.now();
const result = spawnSync(cmd[0], cmd.slice(1), { encoding: "utf8", env: { ...process.env } });
const durationMs = Date.now() - t0;
fs.mkdirSync(path.dirname(log), { recursive: true });
fs.writeFileSync(log, `${result.stdout || ""}${result.stderr || ""}`);
const record = {
  name,
  command: cmd,
  cwd: process.cwd(),
  envProvenance: {
    node: process.execPath,
    nodeVersion: process.version,
    pathPrefix: (process.env.PATH || "").slice(0, 48),
    pathLength: (process.env.PATH || "").length,
    tmpdir: process.env.TMPDIR || "/tmp",
    nodeOptions: process.env.NODE_OPTIONS ? "set" : "unset",
    sandboxEnvPresent: Boolean(process.env.SANDBOX_POLICY || process.env.SANDBOX_WORKTREE)
  },
  startedAt,
  durationMs,
  exitCode: result.status ?? 1,
  error: result.error ? result.error.message : null,
  logPath: log
};
fs.writeFileSync(`${log}.record.json`, `${JSON.stringify(record, null, 2)}\n`);
process.stdout.write(`${name} exit=${record.exitCode} durationMs=${durationMs} log=${log}\n`);
process.exit(record.exitCode);
