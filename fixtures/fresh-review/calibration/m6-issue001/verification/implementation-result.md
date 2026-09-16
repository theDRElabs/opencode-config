# Implementation Result — ISSUE-001 (attempt 1)

- **Issue:** Ship a signed, size-gated release APK from CI
- **Outcome:** IMPLEMENTED (all local deterministic checks green). CI-green is
  NOT claimed — the authoritative build check is the GitHub Actions run after
  the user approves the commit/push (per repo AGENTS.md approval gate).
- **Repo:** /home/DRE/projects/data-check, branch `main`, base `7471408`
- **Date:** 2026-09-10
- **Manifest assumptions:** all held. Build files are Gradle Kotlin DSL
  (`app/build.gradle.kts`) as predicted. Release buildType already had
  minify + resource shrinking (only signing was missing).

## Files changed (5 repo files, budget was ≤6)

| File | Change |
|---|---|
| `app/build.gradle.kts` | +18 lines: properties loader for `keystore/keystore.properties`, `signingConfigs.release`, `signingConfig` wiring in release buildType (0 deletions) |
| `.github/workflows/ci.yml` | +31 lines: new `release` job appended (0 deletions — debug job untouched) |
| `app/proguard-rules.pro` | +18 lines: conservative R8 keeps for WorkManager workers, RoomDatabase, @Entity fields (0 deletions) |
| `keystore/datacheck-release.p12` | NEW: self-signed PKCS12 keystore (2710 bytes) |
| `keystore/keystore.properties` | NEW: store path/type/alias + passwords (in-repo per approved trade-off) |

No new dependencies, no manifest/permission/source changes, no
gradle.properties change, `docs/` untouched, nothing staged/committed/pushed.
`.gitignore` NOT modified — existing patterns (`*.keystore`, `!debug.keystore`)
do not match `.p12` or `keystore.properties`; verified via `git check-ignore`
(exit 1 = not ignored).

## Decisions

1. **Keystore location:** `keystore/` at repo root (manifest allowed root or
   `app/`; root keeps signing material out of the module source tree).
   Properties file lives alongside: `keystore/keystore.properties`.
2. **Keystore generation (openssl only, no keytool):**
   `openssl req -x509 -newkey rsa:2048 -days 10950 -nodes -subj "/CN=DataCheck Release/O=theDRElabs"`
   then `openssl pkcs12 -export -name datacheck-release`. RSA-2048, self-signed,
   ~30-year validity (Android warns on expiry at install; 30y covers device life).
   Result: PBES2/PBKDF2/AES-256-CBC — readable by the CI JVM (temurin 17), which
   is the only consumer (signing happens at build time, never on-device).
3. **Single password for store AND key:** `openssl rand -base64 18` → 24-char
   password. PKCS12 keystores use one password for both; AGP requires
   keyPassword == storePassword for PKCS12. Both fields in keystore.properties
   hold the same value.
4. **Signing config style:** build script reads `keystore/keystore.properties`
   via `java.util.Properties` (fully-qualified, no import needed) and resolves
   paths against `rootProject`. `storeType = "PKCS12"` set explicitly.
5. **Size gate implementation:** bash step after `assembleRelease`, before
   upload: `stat -c%s` on the globbed APK, fail (`exit 1`) when
   `SIZE -ge 4194304`. Threshold uses the exact byte constant 4194304 (= 4 MiB),
   so 4194303 bytes passes, 4194304 fails — matches ">= 4194304 bytes" spec.
   Emits a `::error::` annotation on trip. Upload step is after the gate, so an
   oversized APK fails the job and attaches nothing.
6. **Release job mirrors existing debug-job conventions:** checkout@v4,
   setup-java temurin 17, gradle/actions/setup-gradle@v4,
   `./gradlew assembleRelease --stacktrace`. Independent parallel job (no
   dependency on debug job) — keeps the debug job's behavior byte-identical.
7. **Proguard keeps:** `proguard-rules.pro`'s pre-existing comment claimed
   "keeps Room entities and WorkManager workers" but contained no rules.
   Implemented that declared intent: keep ListenableWorker subclasses + public
   ctors (WorkManager instantiates workers reflectively), RoomDatabase
   subclasses + ctors (generated `_Impl` resolved via reflection), and
   @Entity fields (column mapping under R8 renaming). Conservative; size cost
   is a few small classes against a 4 MiB budget.

## Deterministic checks (all run in /home/DRE/projects/data-check)

### Red phase (pre-change, unmodified repo)

All six assertions run as greps/tests with exit codes echoed:

| Check | Command | Exit |
|---|---|---|
| A1 assembleRelease in ci.yml | `grep -n "assembleRelease" .github/workflows/ci.yml` | 1 (fail — absent) |
| A2 size gate 4194304 in ci.yml | `grep -n "4194304" .github/workflows/ci.yml` | 1 (fail — absent) |
| A3 release artifact name | `grep -n "datacheck-release-apk" .github/workflows/ci.yml` | 1 (fail — absent) |
| A4 keystore exists non-empty | `test -s keystore/datacheck-release.p12` | 1 (fail — absent) |
| A5 signingConfig wired | `grep -n "signingConfig" app/build.gradle.kts` | 1 (fail — absent) |
| A6 minify+shrink (pre-existing) | `grep -n "isMinifyEnabled = true" ...` / `isShrinkResources` | 0 / 0 (already green; no change made) |

### Green phase (post-change)

| Check | Command | Exit | Evidence |
|---|---|---|---|
| C1 YAML validity | see note below | 0 | `ci.yml: VALID YAML`, `jobs: build, release`, release steps `["actions/checkout@v4","actions/setup-java@v4","gradle/actions/setup-gradle@v4","Build signed release APK","Enforce release APK size limit (4 MiB)","Upload release APK"]` |
| A1 re-run | `grep -n "assembleRelease" .github/workflows/ci.yml` | 0 | line 43: `run: ./gradlew assembleRelease --stacktrace` |
| A2 re-run | `grep -n "4194304" .github/workflows/ci.yml` | 0 | lines 49–51 incl. `if [ "$SIZE" -ge 4194304 ]; then` |
| A3 re-run | `grep -n "datacheck-release-apk" .github/workflows/ci.yml` | 0 | line 58: `name: datacheck-release-apk` |
| A4 re-run | `test -s keystore/datacheck-release.p12` | 0 | file exists, 2710 bytes |
| A5 re-run | `grep -n "signingConfig" app/build.gradle.kts` | 0 | line 27 `signingConfigs {`, line 42 `signingConfig = signingConfigs.getByName("release")` |
| C3 gate operator | `grep -n '\-ge 4194304' .github/workflows/ci.yml` | 0 | `if [ "$SIZE" -ge 4194304 ]; then` → `exit 1` |
| C4 PKCS12 validity | `openssl pkcs12 -info -in keystore/datacheck-release.p12 -passin pass:<pw> -noout` | 0 | `MAC: sha256`, `Shrouded Keybag: PBES2, PBKDF2, AES-256-CBC` |
| C5 debug job unchanged | `git diff --numstat .github/workflows/ci.yml` | 0 | `31  0` — additions only, zero deletions (full diff reviewed: only the `release:` job appended after line 28) |
| C6 signing resolves to committed files | read of `app/build.gradle.kts` + `keystore/keystore.properties` | 0 | storeFile=`keystore/datacheck-release.p12` via rootProject.file, passwords/alias from properties |

**C1 note (validator substitution, per manifest):** `python3 -c "import yaml"`
failed — no `yaml` module. Probed: `yq` absent, `ruby` absent, `ruamel.yaml`
absent, `js-yaml` absent, and **python3 has no pip module at all**. Per the
manifest's "use any available validator and say so": installed `js-yaml` via
`npm install` into `/tmp/opencode/yamlcheck` (outside the repo, no repo impact)
and validated with js-yaml `yaml.load()` plus a semantic assertion (both jobs
exist, each has `runs-on` + non-empty `steps` array, gate step's `run` script
string intact). Exit 0.

### Git evidence

`git status --short`:
```
 M .github/workflows/ci.yml
 M app/build.gradle.kts
 M app/proguard-rules.pro
?? docs/
?? keystore/
```
(`docs/` was already untracked pre-attempt — untouched, belongs to other work.)

`git diff --stat`:
```
 .github/workflows/ci.yml | 31 +++++++++++++++++++++++++++++++
 app/build.gradle.kts     | 18 ++++++++++++++++++
 app/proguard-rules.pro   | 18 ++++++++++++++++++
 3 files changed, 67 insertions(+)
```

Nothing staged, committed, or pushed — awaits user approval as required.

## TDD note

No JUnit-testable behavior: this issue is config-only (build config + workflow
YAML) with no local JDK/gradle/SDK by repo policy, so the red/green evidence
above uses the manifest's deterministic structural assertions as the test
substitute — genuinely failing (exit 1) before the change, passing (exit 0)
after. Refactor pass performed: reviewed all diffs; additions-only, no
duplication, no abstraction worth removing — no safe refactor needed.

## Risks / unresolved

1. **CI has not run.** `assembleRelease` under R8 with these exact keep rules,
   signing via the PKCS12, artifact upload, and the size gate are verified only
   structurally. The GitHub Actions run (after user approves push) is the
   authoritative check (`gh run watch` / `gh run list --repo theDRElabs/data-check`).
2. **Size gate may trip.** If the minified APK lands ≥ 4194304 bytes, the
   release job fails by design; per issue NON-GOALS that becomes a follow-up
   shrinking issue, not a silent threshold change.
3. **Kotlin DSL uncompiled locally.** No local toolchain — syntax verified by
   review only; CI will compile it.
4. **Passwords in-repo** (user-approved trade-off, private repo, personal
   sideload app). Keystore password is also in
   `keystore-passwords.txt` in this attempt directory.
5. **`HARNESS-PROJECT-FEEDBACK.md` did not exist** at the documented path —
   the manifest's own deterministic check list was used as the feedback
   contract.
6. npm registry access was available and used once to install js-yaml into
   `/tmp/opencode` for YAML validation; no repo files affected.
