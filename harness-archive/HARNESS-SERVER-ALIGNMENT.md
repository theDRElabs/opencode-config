# Harness Server Alignment Plan

**Purpose**: Revalidate and optimize the opencode harness after migration from
Android/Termux/proot to AWS EC2 WSL2 Debian. Addresses audit findings from
2026-09-10.

**Status**: `[pending]` | `[in_progress]` | `[completed]`

---

## Session 1: Environment Foundation

Scope: Fix broken tooling, verify environment, audit context budget.
No harness phase revalidation yet — just make the system runnable.

### S1-T1: Install Vercel CLI [completed]
- Install `vercel` globally (`npm i -g vercel`)
- Verify `vercel --version` works
- Confirm local auth (`~/.vercel/auth.json`) exists and is valid
- Test: `vercel whoami` succeeds

### S1-T2: Verify Tool Paths [completed]
- Confirm all tools in PATH: `node`, `npm`, `python3`, `git`, `gh`, `docker`
- Fix `python` alias if needed (`sudo ln -s /usr/bin/python3 /usr/bin/python`)
- Verify WSL2-specific paths resolve correctly
- Check: no stale Termux paths (`/data/data/...`) in any config or script
- Test: run `pipeline-init --help` and confirm it finds its dependencies

### S1-T3: Context Budget Audit [completed]
- Load `context-budget` skill
- Measure token consumption of current config:
  - 24 skills (which are auto-loaded vs lazy?)
  - 12 agents (only loaded when invoked?)
  - 3 MCP servers (always running: Playwright, Excalidraw, Context7)
  - HARNESS-CONTRACT.md (118 lines) loaded every session
  - AGENTS.md (142 lines) loaded every session
  - memory.md plugin injection (~3KB)
  - hardened-rules plugin injection
- Identify: what can be deferred, what's redundant, what's too large
- Output: `HARNESS-CONTEXT-BUDGET.md` with findings and recommendations

### S1-S1 Verification: [completed]
- ~~`vercel whoami` exits 0~~ ✓
- ~~All tools respond to `--version`~~ ✓
- ~~Context budget report exists with actionable findings~~ ✓

**Session 1 dependencies**: None. Can run immediately.
**Estimated time**: 30-45 min

---

## Session 2: Playwright & Browser Setup

Scope: Ensure Playwright works on server (headless). Critical for QA and E2E.

### S2-T1: Install Playwright Browsers [completed]
- Run `npx playwright install chromium` (or full install)
- Verify headless Chromium launches: `npx playwright open --headless`
- Check: Playwright MCP server (`@playwright/mcp@0.0.79`) connects successfully
- Fix: any missing system deps (`libnss3`, `libatk`, etc.)

### S2-T2: Test manual-qa Skill [completed]
- Load `manual-qa-plan` skill
- Verify it can launch a browser, navigate, take screenshots
- Test against a real URL (e.g., a deployed project or localhost)

### S2-S2 Verification: [completed]
- Playwright headless Chromium launches without errors
- MCP Playwright server connects and can snapshot a page
- manual-qa skill produces a valid plan with browser evidence

**Session 2 dependencies**: S1-T2 (tool paths verified)
**Estimated time**: 20-30 min

---

## Session 3: Harness Phase Revalidation (Low-Risk Phases)

Scope: Revalidate text-only and reasoning-heavy phases. These should work
without environment changes.

### S3-T1: Phase 0-1 Revalidation [completed]
- Verify HARNESS-CONTRACT.md loads correctly in this session
- Verify HARNESS-AUDIT.md and HARNESS-CONTRACT-VALIDATION.md are accurate
- Check: any references to phone-specific paths or tools

### S3-T2: Phase 2-4 Revalidation [completed]
- Load `grill-me` skill, verify alignment agent permissions are correct
- Load `write-prd` skill, verify destination-writer agent config
- Load `prd-to-issues` skill, verify issue-writer agent config
- Check: agent definitions in `/home/ubuntu/.config/opencode/agent/` — no Termux artifacts

### S3-T3: Phase 5 Revalidation (Project Feedback) [completed]
- Load `project-feedback` skill
- Verify check commands work with Node 24 / npm 11
- Run against a fixture project if available
- Check: any hardcoded Node version assumptions

### S3-S3 Verification: [completed]
- All reasoning agents load without errors
- Project feedback skill can run checks on a fixture
- No phone-specific references found

**Session 3 dependencies**: S1-T2 (tool paths), S1-T3 (context budget known)
**Estimated time**: 30-45 min

---

## Session 4: Sandbox Redesign (Phase 11 — Docker)

Scope: Redesign sandboxing to use Docker containers. Highest-impact change.

### S4-T1: Docker Sandbox Prototype [completed]
- Read existing sandbox code: `fixtures/issue-sandbox/sandbox.mjs`
- Read existing guard: `fixtures/issue-sandbox/guard-preload.cjs`
- Design container-based sandbox:
  - Base image: `node:24-slim` (matches server Node version)
  - Mount: only target repo directory (not full filesystem)
  - Network: isolated by default, opt-in for `npm install`
  - Resources: 512MB RAM, 1 CPU, 10GB disk limit
  - User: non-root inside container
  - Temp dir: overlay filesystem for writes, discarded after run
- Create `sandbox-docker.mjs` alongside existing `sandbox.mjs`
- Keep existing file-path guards as defense-in-depth

### S4-T2: Integration with bounded-implementer [completed]
- Update `bounded-implementer` agent to optionally use Docker sandbox
- Verify: agent can still read project files (read-only mount)
- Verify: agent can write to project (writable mount or volume)
- Verify: agent can run tests inside container
- Verify: agent CANNOT escape container (test with adversarial commands)

### S4-T3: Adversarial Testing [completed]
- Run existing Phase 11 adversarial tests (7 rounds from verifier)
- Add new Docker-specific tests:
  - Container escape attempts (mount /proc, /sys, host fs)
  - Network escape (outbound connections when blocked)
  - Resource exhaustion (fork bomb, memory bomb)
  - Path traversal from inside container
- Update fixtures in `fixtures/issue-sandbox/`

### S4-S4 Verification: [completed]
- bounded-implementer runs successfully inside Docker container
- All 7 original Phase 11 adversarial tests pass
- New Docker adversarial tests pass
- No container escapes detected

**Session 4 dependencies**: S1-T2 (Docker verified), Session 3 (phase context)
**Estimated time**: 1-2 hours

---

## Session 5: Graph Memory & Pipeline Verification

Scope: Revive graph memory, test pipeline on this system.

### S5-T1: Graph Memory Update [completed]
- Run `scripts/graph-assemble.mjs` to verify it works
- Add new entities:
  - `ec2-server` (type: TOOL, env: WSL2)
  - `docker-sandbox` (type: CONCEPT)
  - `phone-to-server-migration` (type: EVENT)
- Update existing entities with server context
- Verify `scripts/graph-query.mjs` returns results

### S5-T2: Pipeline Verification [completed]
- Create a throwaway test project
- Run `pipeline-init.sh` against it
- Verify: `.github/workflows/pipeline.yml` created
- Verify: `vercel` secret set (if Vercel CLI installed)
- Verify: GitHub repo created
- Clean up: delete test repo

### S5-S5 Verification: [completed]
- Graph assemble + query work without errors
- Pipeline init completes successfully on a test project
- No Termux-specific references in pipeline scripts

**Session 5 dependencies**: S1-T1 (Vercel CLI), S1-T2 (tool paths)
**Estimated time**: 30-45 min

---

## Session 6: Parallel Execution Verification (Phase 12)

Scope: Verify or complete Phase 12 (parallel AFK runner).

### S6-T1: Orchestrator Review [completed]
- Read `fixtures/parallel-afk-runner/orchestrator.mjs`
- Read `fixtures/parallel-afk-runner/test-orchestrator` (15 adversarial groups)
- Assess: is the orchestrator complete or does it need work?
- Check: are there any blocking issues from the pending verifier?

### S6-T2: Test Against Real Code [completed]
- If orchestrator is ready: run against a small real project (not fixture)
- If not: identify gaps and fix
- Verify: parallel issues don't conflict (file locks, git state)
- Verify: context isolation between parallel runners

### S6-S6 Verification: [completed]
- Orchestrator passes adversarial tests
- Parallel execution works on real code (if tested)
- Independent verification complete (fresh-reviewer)

**Session 6 dependencies**: Session 4 (Docker sandbox), Session 3 (phase context)
**Estimated time**: 1-2 hours

---

## Session 7: Plugin Hardening & Final Check

Scope: Harden plugins, final alignment check, update memory.

### S7-T1: Plugin Path Validation [completed]
- Verify `memory.js` reads/writes to `/home/ubuntu/.config/opencode/memory.md` (not phone path)
- Verify `hardened-rules.js` injects correctly
- Add error logging: if plugin fails to inject, log warning
- Test: start fresh session, confirm both plugins fire

### S7-T2: Final Alignment Check [completed]
- Walk through HARNESS-CONTRACT.md lifecycle on this system
- Confirm every phase agent loads and has correct permissions
- Confirm every command works: `/grill-me`, `/write-prd`, `/prd-to-issues`,
  `/implement-issue`, `/review-issue`, `/project-check`, `/architecture-audit`,
  `/manual-qa-plan`, `/run-afk`
- Update `AGENTS.md` host context if needed (phone → server references)

### S7-T3: Update Memory & Documentation [completed]
- Update `memory.md` with session findings
- Update `HARNESS-ROADMAP.md` to reflect server alignment
- Update graph memory with migration completion

### S7-S7 Verification: [completed]
- Both plugins inject in fresh session
- All 9 commands respond without errors
- No stale phone references in any config file
- memory.md reflects completed alignment

**Session 7 dependencies**: All previous sessions
**Estimated time**: 30-45 min

---

## Dependency Graph

```
Session 1 (Foundation)
  ├── Session 2 (Playwright)
  └── Session 5 (Graph + Pipeline)
       │
Session 3 (Phase Revalidation) ← S1
  │
  └── Session 4 (Docker Sandbox) ← S1, S3
       │
       └── Session 6 (Parallel Execution) ← S4, S3
            │
            └── Session 7 (Final Check) ← All
```

**Parallelizable**: Sessions 2 and 5 can run simultaneously after Session 1.
**Critical path**: 1 → 3 → 4 → 6 → 7

---

## Progress Tracking

| Session | Status | Completed |
|---------|--------|-----------|
| S1: Environment Foundation | completed | 2026-09-10 |
| S2: Playwright & Browser | completed | 2026-09-10 |
| S3: Phase Revalidation (Low-Risk) | completed | 2026-09-10 |
| S4: Docker Sandbox (Phase 11) | completed | 2026-09-10 |
| S5: Graph & Pipeline | completed | 2026-09-10 |
| S6: Parallel Execution (Phase 12) | completed | 2026-09-10 |
| S7: Final Check | completed | 2026-09-10 |
