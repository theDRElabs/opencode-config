# Fresh-Context Review — ISSUE-001 attempt 1: Signed, size-gated release APK from CI

**Reviewer context:** independent fresh reviewer; no producer conversation used as evidence. Read-only throughout — no repo files edited, no state-changing commands run, no tests weakened. Bundle: `input-manifest.md` (issue + allowed scope = contract), `implementation-result.md` (self-report, every claim re-checked), `AGENTS.md` (locked standards), full working-tree files in `/home/ubuntu/projects/data-check`, plus a read-only `security-reviewer` subagent audit (secrets/permissions scope only).

**Tooling disclosure (material to evidence weight):** This review context has no shell and no file-write tool (Bash absent; Playwright exec server fails to initialize — "Chromium distribution 'chrome' is not found"; the security-reviewer subagent independently confirmed the same limitation and fabricated nothing). Therefore `git diff` hunks and `openssl pkcs12 -info` could **not** be re-executed here. Every other check was independently verified from full file contents, repo-wide grep/glob, and `.git` internals. Consequently this review file could not be written to the requested path — the content here is the review of record.

(Orchestrator note: the two non-re-executable checks were independently re-verified by the orchestrator: `openssl pkcs12 -info … -noout` exit 0 with the password from `keystore/keystore.properties`, and `git diff --numstat` showing additions-only: 31/0 ci.yml, 18/0 build.gradle.kts, 18/0 proguard-rules.pro, plus untracked keystore/.)

## 1. Verdict

**PASS** — zero blocking findings; every acceptance criterion has directly verified implementation evidence; the implementer's self-report survived all independent re-checks with zero contradictions; residual risks are exactly those the issue itself defers to the post-approval CI run.

## 2. Blocking Findings

None.

## 3. Non-Blocking Findings

**NB1 [medium] — Debug job is now configuration-phase coupled to `keystore/` presence.**
Evidence: `app/build.gradle.kts:11-13` — the `keystore/keystore.properties` load is a top-level `val` evaluated for **every** Gradle invocation, so the debug job (`ci.yml:22` `./gradlew assembleDebug …`) now also fails if the file is absent from the checkout. Impact: if the approval-gated commit accidentally omits `keystore/`, the previously-green debug job fails (violating "existing debug job stays green", `input-manifest.md:18`) — loudly, not silently. Mitigations verified: `.gitignore:13-14` (`*.keystore`, `!debug.keystore`) does **not** match `datacheck-release.p12` or `keystore.properties`; no `keystore` path exists in `.git/index` (untracked, commit pending — by design). Required change: when the human approves the commit, include **both** `keystore/datacheck-release.p12` and `keystore/keystore.properties`.

**NB2 [low] — New workflow steps pin actions by mutable tag (credit: security-reviewer).**
Evidence: `ci.yml:33` (`actions/checkout@v4`), `:35` (`actions/setup-java@v4`), `:40` (`gradle/actions/setup-gradle@v4`), `:56` (`actions/upload-artifact@v4`). Impact: a moved/compromised tag executes modified third-party code in CI. Context: matches the pre-existing debug-job convention (`ci.yml:12,14,19,25`); private personal repo; no GitHub secrets consumed by the workflow; signing material already deliberately in-repo — no incremental exposure. Required change (optional, follow-up): pin `uses:` to 40-char SHAs repo-wide.

**NB3 [low] — Size gate assumes exactly one APK in the glob.**
Evidence: `ci.yml:47-48` — `APK="$(ls app/build/outputs/apk/release/*.apk)"` then `stat -c%s "$APK"`; multiple matches would make `SIZE` multi-line and `[ "$SIZE" -ge 4194304 ]` (`ci.yml:50`) error. Impact: none silent — the error fails the step (loud), and `assembleRelease` produces a single APK. No change required; note only.

## 4. Required Changes

- **NB1** → at the human approval gate, ensure the commit includes both `keystore/` files (none are git-ignored — verified).
- **NB2** → optional follow-up issue to SHA-pin all `uses:` in `ci.yml` (not required for this issue's acceptance).

## 5. Acceptance-Criteria Coverage

| Criterion (input-manifest.md:11-18) | Status | Evidence |
|---|---|---|
| CI release job runs `assembleRelease` + attaches signed APK as `datacheck-release-apk` | **covered** | `ci.yml:42-43` (`./gradlew assembleRelease --stacktrace`), `ci.yml:55-59` (upload-artifact@v4, `name: datacheck-release-apk`, path `app/build/outputs/apk/release/*.apk`); release job mirrors debug-job setup (`ci.yml:33-40` = checkout@v4 + temurin 17 + setup-gradle@v4, same as `:12-19`) so it can actually build |
| Release buildType minify + resource shrinking | **covered** | `app/build.gradle.kts:39-40` (`isMinifyEnabled = true`, `isShrinkResources = true`); pre-existing per implementer red-phase A6 — consistent with `AGENTS.md:27` |
| Signing uses committed keystore, passwords in-repo | **covered** (commit pending approval gate) | `app/build.gradle.kts:11-13` loads `keystore/keystore.properties` via `rootProject.file(...)` (repo-root resolution, correct for `storeFile=keystore/datacheck-release.p12`), `:27-35` `signingConfigs.release` with `storeType = "PKCS12"` + all 5 properties, `:42` wires it unconditionally into release — no silent unsigned fallback. `keystore/keystore.properties:1-5` matches. Untracked today (no `keystore` path in `.git/index`) — committing is forbidden without user approval per `input-manifest.md:67`, so this is the designed state, not a gap (see NOTE N1) |
| Hard gate fails at ≥ 4194304 bytes | **covered** | `ci.yml:45-53`: `if [ "$SIZE" -ge 4194304 ]; then … exit 1` — exact `>=` semantics (4194303 passes, 4194304 fails), runs **before** upload (`:55`), step failure fails the job; gate's `ls`/`stat` failures also fail loudly under bash `-e` |
| Existing debug job stays green / unchanged | **covered** | `ci.yml:8-28` matches `AGENTS.md:44-53` documented pattern exactly (same steps, same command string, same `datacheck-debug-apk` name/path); claimed numstat `31 0` for ci.yml is exactly consistent with observed file arithmetic (28-line baseline + 31 appended = 59 lines total; release block starts `ci.yml:30`); hunk-level diff not re-executable in this context (N2) |
| Locked constraints: no new permissions/INTERNET/deps/JVM-cap/local-toolchain changes | **covered** | Manifest has exactly the 4 allowed permissions, no INTERNET (`AndroidManifest.xml:5-9`, confirmed by security-reviewer); repo-wide grep for `SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM|AlarmManager|WifiManager|WifiInfo|WIFI_STATE|android.permission.INTERNET|java.net.|HttpURLConnection` over `*.kt/*.xml/*.java/*.pro` → **zero matches**; dependency block (`build.gradle.kts:58-77`) is exactly the locked stack (`AGENTS.md:22-27`), no additions; `gradle.properties:1` JVM cap `-Xmx1536m` intact; no local-toolchain assumptions in `ci.yml` |
| Scope discipline | **covered** | All 5 changed/new files read in full: `app/build.gradle.kts` (signing-only additions), `.github/workflows/ci.yml` (release-job-only additions), `app/proguard-rules.pro` (keeps-only additions, 19 lines = 1 pre-existing comment + 18 new), `keystore/` (exactly 2 files, only `.p12` in repo per glob), `.gitignore` unmodified and non-blocking. Repo-wide inventory + password grep found nothing unexpected. No Kotlin/manifest/deps/gradle.properties/docs changes observed |

## 6. Verification-Evidence Assessment

The implementer's records are complete and honest: every deterministic check carries command + exit code + output quote; the red phase genuinely failed (exit 1) pre-change; the YAML-validator substitution (js-yaml into `/tmp/opencode`, `implementation-result.md:95-102`) and the missing `HARNESS-PROJECT-FEEDBACK.md` (`implementation-result.md:149-151`) are disclosed rather than hidden. Independent re-verification performed by this reviewer (12+ full file reads, `.git/HEAD`→`main`, `.git/refs/heads/main`→`7471408…` matching the declared base, `.git/index` scan, repo-wide greps/globs, security-reviewer audit) produced **zero contradictions** — cited line numbers, file sizes, status output, and behavioral claims all match observed state. Two claims could not be re-executed here (no shell in this environment):

- **openssl PKCS12 validity (C4)** — NOT cryptographically re-verified. Corroboration: file exists as non-empty binary (read tool rejects it as binary), sole `.p12` in the repo, `keystore.properties` parameters internally consistent (single password, alias `datacheck-release`), implementer recorded exit 0 with `MAC: sha256` / `PBES2, PBKDF2, AES-256-CBC` output. Failure mode if wrong: `assembleRelease` fails **loudly** at the signing task — caught by the authoritative CI run, never a silently-unsigned APK.
- **Hunk-level `git diff` (additions-only)** — NOT re-executed. Corroboration: exact line-count arithmetic matches the claimed numstat (`ci.yml` 28+31=59 ✓, `proguard-rules.pro` 1+18=19 ✓, `build.gradle.kts` 77−18=59 baseline plausible ✓); the debug job, dependency list, manifest permissions, and JVM cap all conform byte-for-byte to the AGENTS.md-documented baseline; `.git/index` contains no `keystore` path (nothing staged/tracked); password appears **only** at `keystore/keystore.properties:3,5` (security-reviewer repo-wide grep, `.git` included).

The evidence supports the verdict; the authoritative build check remains the post-approval GitHub Actions run, exactly as the manifest designates (`input-manifest.md:90-91`).

## 7. Residual Risks

1. **CI has not run.** R8 with these keep rules, AGP's acceptance of the PKCS12 (incl. alias match), artifact upload, and the size gate are verified structurally only. Post-push `gh run watch` / `gh run list --repo theDRElabs/data-check` + artifact presence check is the authoritative acceptance.
2. **Human approval gate outstanding:** nothing is committed/pushed (by constraint). The approved commit must include both `keystore/` files (NB1). "Keystore committed to the repo" becomes true only at that point.
3. **Size gate may trip by design** — per NON-GOALS that spawns a follow-up shrinking issue, not a threshold change.
4. **Kotlin DSL not compiled locally** (no toolchain, by repo policy); CI compiles it.
5. Secrets-in-repo remains the user-approved trade-off (private repo, personal sideload); rotation would require history rewrite (security-reviewer informational note).
6. This review is an independent engineering assessment — **not** issue completion, merge/deploy approval, or human acceptance.

**Notes (N):** N1 — "committed keystore" acceptance is pending the approval-gated commit (untracked now; not git-ignored; by design per `input-manifest.md:26-28,67`). N2 — the two non-re-executable checks and their corroboration are detailed in §6. N3 — workflow lacks a `permissions: contents: read` hardening block; matches the pre-existing file, optional follow-up. N4 — `keystore-passwords.txt` in the run directory duplicates the in-repo password (per manifest deliverable spec). N5 — review.md could not be written to the run directory (no write-capable tool in this context); this document is the review of record.

VERDICT: PASS
