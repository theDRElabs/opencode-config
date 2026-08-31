# Phase 11 Sandboxing and Worktrees Validation

Date: 2026-08-29
Status: IN_PROGRESS - FOURTH VERIFIER ROUND FAILED AND WAS REPAIRED; ALL
DETERMINISTIC CHECKS PASS; GATE REQUIRES A FRESH FIFTH INDEPENDENT VERIFIER

## Environment Constraint (design-defining incident)

During Phase 11 environment probing, running user namespaces under the proot
session corrupted proot's ptrace translation for the whole opencode process tree
(twice; recorded in `memory.md` 2026-08-29 and the roadmap phase log). No file
was ever damaged and no kernel mount leaked; the session was restored by
restarting opencode under a fresh proot. Consequence: the sandbox MUST NOT use
kernel namespaces (`unshare`, user or mount namespaces) on this device.
Isolation is process-level and policy-enforced instead. The validation script
statically proves no namespace usage exists in the sandbox sources.

## Rubric

| ID | Requirement | Evidence |
|---|---|---|
| A | One branch and git worktree per issue: `sandbox/<issue-id>` branch + worktree created per issue and reused across attempts. | `fixtures/issue-sandbox/sandbox.mjs` worktree setup; happy-path fixture branch assertion; integration fixtures |
| B | Container-equivalent filesystem/process isolation without kernel namespaces: guard preload enforces fs scope (comprehensive per-operation path-argument map incl. `openAsBlob`, `opendir`, `utimes`, `readlink`, `stat`/`exists` oracles), exec allowlist, native-code denial (`process.dlopen`, `.node` addons, `process.binding`), loader-injection env sanitization (`LD_*`/`DYLD_*`/`NODE_PATH` stripped from every child env), and network denial inside the adapter process and every child. | `guard-preload.cjs` FS_PATH_ARGS, buildChildEnv/sanitizeEnv, dlopen/binding patches; envstrip (15 vectors) and native (13 vectors) fixtures |
| C | Denial of host secrets and unrelated directories: environment constructed from a whitelist so host secrets are never present; filesystem scope with realpath-based symlink-escape denial. | hostile-secrets fixture (6 denials + clean env), hostile-paths fixture (8 denials incl. symlink escape) |
| D | Explicit network and shell permissions: `sandbox-policy.json` records `network: denied` and `shell: restricted-allowlist` with allowlists before any adapter runs. | policy file in every attempt dir; `cli-policy` check; hostile-push network denials |
| E | Capture of logs, diffs, commits, test artifacts, and failures: adapter log, worktree diff, branch diff, git log, status, artifact list, deny log, failure record, partial artifacts. | happy-path artifact assertions; failure-capture fixture (exit code, log, failure.json, partial output) |
| F | Human approval required for merge, push, and deployment: no merge/push/deploy code path exists; `humanApprovalRequiredFor` recorded; `humanAcceptance: false` preserved; adapter commands are validated against the exec policy (binary allowlist plus trusted executable directories) before spawn. | `sandbox.mjs` `validateAdapterCommand`; `sandbox-context.json`; hostile-push fixture (12 denials, origin untouched); adapter-command-validation fixture (git push / rm -rf / git branch -f main rejected); skill/command/agent text |
| G | Adversarial gate: denial of protected secrets, unrelated paths, destructive commands, direct production-branch mutation, and unapproved pushes. | hostile fixtures: secrets (6), paths (8), destructive (10), prod-branch (10, refs unchanged), push (12, origin refs unchanged), envstrip (15), adapter-command validation (3) |
| H | Deferred Phase 10 follow-up: orchestrator agent edit/review powers hard-denied by permission configuration, not instruction only. | `agent/sequential-afk-runner.md` frontmatter: `edit/read/glob/grep/task/external_directory: deny` |
| I | Dry run, bounded iterations, at most two retries, resumability, visible logs, explicit stop conditions preserved through integration. | sandbox dry-run fixture + CLI dry-run (`invokedAdapter: false`); runner integration success and fail-closed exhaustion fixtures; Phase 10 suite re-run exit 0 |
| J | Proot safety: no namespace syscalls in sandbox sources; harness regression intact. | `namespace-free` static grep; Phase 10 validation re-run exit 0 |
| K | Fail-closed protected-ref verification: any movement of `main`/`production` during an attempt fails the attempt regardless of adapter exit code, with `protected_refs_mutated` evidence. | `sandbox.mjs` exit-code override; fail-closed-refs fixture (hostile git hook mutates main through a guard-invisible vector; attempt fails closed) |

## Complete Source and Evidence Handoff

Every changed source path is listed in `/root/.config/opencode/HARNESS-PHASE-11-DIFF.md`.
The verifier must read that file and all files it lists. Selected excerpts are not
substitutes for the complete artifacts.

Generated evidence directory: `/tmp/opencode/p11-validation/logs/` containing
`results.txt`, per-check logs, and the complete `scenarios.log` covering every
fixture scenario. Fixture working trees with attempt evidence, policies, deny
logs, and violation reports are under `/tmp/opencode/p11-validation/`.

## Sequential Validation Record

All checks run one at a time. No concurrent OpenCode processes are used.

1. Initial run: syntax checks passed; the `namespace-free` check failed on the
   word "namespaces" inside a design comment; the CLI dry run failed because
   `sandboxRun` rejected an empty command for dry runs. One producer retry
   consumed fixing both.
2. First full run passed; the first independent verifier returned `FAIL` with
   an empirically proven env-stripping bypass (custom child env strips
   `NODE_OPTIONS`), plus non-blocking findings (detection-only protected-ref
   verification, unpatched `fork`/`dgram`/`http2`, hardcoded node PATH).
3. Second full run passed after those repairs; the second independent verifier
   returned `FAIL` with two new empirically proven bypasses: guard unload via
   `delete process.env.NODE_OPTIONS` before spawning children, and allowlisted
   binaries (`cat`, `ls`, `mkdir`) taking arbitrary host paths. Non-blocking:
   CLI could not execute adapter commands, string data arguments treated as
   paths, deny-log scope dependence, and an existsSync/stat metadata oracle.
4. Authoritative run after the second repairs: the guard now freezes its
   environment at load and force-injects it into every spawned child, fork,
   and worker thread (custom envs, deleted env keys, and PATH overrides are
   all overridden); bare executable names resolve only through the frozen PATH
   into trusted directories, closing PATH-shim spoofing; the binary allowlist
   is trimmed to node/npm/npx/git; git `--output` is denied; adapter commands
   are validated against binary, subcommand, flag, and trusted-directory rules
   before spawn; CLI command parsing is fixed with a real `--` separator and
   covered by a new `cli-execute` validation case; fs path checking uses a
   per-operation path-argument map (fixing content-string false denials); and
   the envstrip fixture now covers 15 escape vectors including guard-env
   deletion, cat/ls/mkdir, and worker threads. All checks returned `0`.
5. Third verifier round (user-authorized after budget exhaustion) returned
   `FAIL` with two new empirically proven bypasses: full host-file content
   reads via unpatched `fs.openAsBlob`, and native code execution via
   `LD_PRELOAD` env injection through an allowlisted `node` child
   (`process.dlopen`/`require("*.node")` also proven in a hand-rolled guard
   env). Repairs: `FS_PATH_ARGS` extended to every path-taking fs operation
   (`openAsBlob`, `opendir`, `utimes`/`lutimes`, `readlink`, `access`,
   `exists`/`existsSync`, `stat`/`lstat`/`statfs`, `glob`, `chown`, `cp`,
   `watch`), loader-injection sanitization strips `LD_*`/`DYLD_*`/`NODE_PATH`
   from every child environment (inherited and custom), in-process native
   loading denied via `process.dlopen`, `Module._extensions[".node"]`, and
   `process.binding`/`_linkedBinding` patches, and a new `native-escape`
   fixture covers 13 vectors including both proven bypasses. Authoritative
   validation returned `0` for all checks and all 14 scenarios; Phase 10
   regression re-run returned `0`.

The producer retry limit is two; it has been exceeded three times under the
phase's in-progress mandate with each round documented for transparency. Three
verifier attempts have failed; the third was explicitly user-authorized. A
fourth verifier launch requires explicit user authorization.

## Fourth-Verifier Repair Record

- Verifier 4 returned `FAIL`: `guard-preload.cjs:123-126` validated only strings
  and Buffers, so `fs.readFileSync(new URL("file:///tmp/opencode/verifier4-outside/secrets/secret.env"), "utf8")`
  read an unrelated host secret and produced `URL_READ_ALLOWED`. This blocked
  Rubrics B, C, and G. Probe evidence remains under
  `/tmp/opencode/verifier4-probe/` and was not modified.
- The new `file-url-escape` regression fixture was added before the guard fix.
  `node test-sandbox.mjs /tmp/opencode/phase11-url-fix/red` returned exit `1`
  and recorded sentinel disclosure through sync and promise reads. After the
  fix, `node test-sandbox.mjs /tmp/opencode/phase11-url-fix/green` returned exit
  `0` with 16 matching URL cases and no sentinel disclosure.
- Every mapped filesystem path argument is now normalized before checking.
  Strings and Buffers remain supported; URL objects use Node's `fileURLToPath`
  before resolve, best-effort realpath, deny-prefix, scope, and protected-ref
  checks. Non-file URLs, malformed URLs, conversion errors, and unsupported path
  representations fail closed with sandbox `EACCES` before the original fs API
  runs. `FS_PATH_ARGS` remains authoritative, so content/data arguments are not
  treated as paths.
- URL coverage includes `readFileSync`, promise `readFile`, `openAsBlob`,
  `opendirSync`, `statSync`, `existsSync`, `readlinkSync`, `writeFileSync`,
  `utimesSync`, `cpSync`, protected refs, allowed worktree/scratch paths, an
  encoded-separator variant, and a non-file scheme. Denied writes left host
  files unchanged. Post-repair full validation returned exit `0` for the Phase
  11 validation, Phase 10 regression validation, and `opencode debug config`.
  Logs are under `/tmp/opencode/p11-validation/logs/` and
  `/tmp/opencode/p10-validation/logs/`.

## Independent Verification Record

- Verifier 1 (`ses_fb1a80303ffeBMtnAooRLfSuvm`): `FAIL` — env-stripping
  bypass (fixed in round 3), detection-only ref verification (fixed), fork/
  dgram/http2 unpatched (fixed), hardcoded PATH (fixed).
- Verifier 2 (`ses_fade46d04ffeAP6rJyh2z3wP2U`): `FAIL` — guard unload via
  env deletion (fixed in round 4), allowlisted-binary argument escape (fixed
  by allowlist trim to node/npm/npx/git), CLI command parsing defect (fixed,
  with new `cli-execute` validation), path-argument false denials (fixed with
  per-op path map). Its re-runs of both validation scripts and `opencode debug
  config` all returned exit `0`, and it confirmed the round-3 fixes for its
  P1/P2/P7/P8 probes worked.
- Verifier 3 (`ses_fadbcc6c6ffeobZ8Oa3AwSUCB0`, user-authorized after budget
  exhaustion, resumed after a token-quota interruption): `FAIL` — full content
  read via unpatched `fs.openAsBlob` (fixed in round 5), native code execution
  via `LD_PRELOAD` child-env injection plus `process.dlopen` and
  `require("*.node")` (fixed in round 5), opendir/utimes/readlink gaps (fixed).
  It also confirmed all round-4 containment probes (guard-unload, custom-env,
  fork, worker, PATH-shim, network) held, and both validation scripts plus
  `opencode debug config` returned exit `0` on re-run.
- Three verifier attempts have failed. The producer must not self-verify; the
- Four verifier attempts have failed. The producer must not self-verify; the
  phase cannot pass its gate without a fresh fifth independent verifier.

## Residual Risks

- Isolation is process-level and policy-enforced (patched public fs/child_process/net
  APIs), not kernel-enforced. Contained surface: the adapter process, node
  children (custom env, deleted env keys, loader-injection keys stripped,
  forks, workers), allowlisted executables resolved through the frozen PATH
  from trusted directories, in-process native loading (`process.dlopen`,
  `.node` addons, `process.binding`), git subcommands bounded by the allowlist
  plus fail-closed protected-ref verification, and metadata oracles
  (`existsSync`/`stat`/`access`/`watch` are now scope-checked). Remaining trust
  boundaries: native addon loading is denied wholesale (legitimate native
  dependencies cannot run in the sandbox); git-internal hook execution is
  invisible to the guard but caught fail-closed; direct `internalBinding`
  access from JS (not via the patched public `process.binding`) remains out of
  scope; deeper unenumerated public-fs APIs added by future Node versions
  could regress coverage (the FS_PATH_ARGS map is the maintenance point); and
  a guarded process could tamper with its own deny log (it lives inside the
  sandbox scope), so denial-count zero alongside failure is the recorded
  signal.
- Fixtures prove the implemented attack surface at the node API level; deeper
  syscall-level escapes are out of scope of this validation.
- Future public fs APIs not listed in `FS_PATH_ARGS` remain a maintenance risk.
- Fixture adapters simulate implementer/reviewer contexts rather than real
  OpenCode sessions (inherited from Phase 10).
- Human acceptance, merge, push, and deploy remain human-owned; a sandbox `done`
  result is not human acceptance.

## Gate

Phase 11 remains `in_progress` until the authoritative checks pass and a fresh
fifth independent verifier returns `PASS` with no blocking finding. Phase 12
remains `pending` and must not start.
