# ISSUE-001 Input Manifest — attempt 1

## Issue (from docs/BACKLOG-M6.md)

ISSUE-001: Ship a signed, size-gated release APK from CI
STATUS: ready
TYPE: afk
BLOCKERS: none
OUTCOME: every green CI run attaches a signed, minified release APK (< 4 MB)
  as a downloadable artifact
ACCEPTANCE:
- CI release job runs `assembleRelease` and attaches the signed APK as an
  artifact (name: `datacheck-release-apk`)
- Release buildType has minify + resource shrinking enabled
- Release signing uses the self-signed keystore committed to the repo
  (passwords stored alongside in-repo)
- CI release job fails when the release APK is >= 4 MB (hard gate step)
- Existing debug job (`assembleDebug testDebugUnitTest lint`) stays green
LAYERS: build+ci
MODULES: app release buildType + signing config; .github/workflows/ci.yml
  release job; keystore file location is an implementation choice
TESTS: green CI run with release artifact present; size-gate step present in
  workflow and fails the job at threshold
COMMANDS: `gh run watch` / `gh run list --repo theDRElabs/data-check`;
  artifact presence check via `gh api` or run page
CONSTRAINTS: CI-only builds (no local toolchain); keystore + passwords
  committed to private repo (user-approved trade-off); git commit/push
  requires user approval per repo AGENTS.md — batch for approval at issue
  completion; no new dependencies or permissions; keep the existing
  debug-apk artifact flow unchanged
NON-GOALS: Play-signing, .aab bundles, keystore-as-CI-secret, size shrinking
  work (only if the gate trips does shrinking become a follow-up issue)

## Repo facts (verified by orchestrator)

- Repo: /home/ubuntu/projects/data-check, branch `main`, base commit `7471408`,
  working tree clean except untracked `docs/` (PRD + backlog — do not touch).
- Build files: Gradle Kotlin DSL likely (`app/build.gradle.kts`) — verify.
- Existing CI: `.github/workflows/ci.yml` (single job; pattern per repo
  AGENTS.md: setup-java temurin 17 + gradle/actions/setup-gradle@v4 +
  `./gradlew assembleDebug testDebugUnitTest lint --stacktrace`).
  Read it and follow its existing structure/conventions.
- Debug artifact name in use: `datacheck-debug-apk`.

## Environment facts (verified by orchestrator)

- NO local JDK, NO keytool, NO Android SDK. Never invoke gradle/java locally.
- `openssl` IS available at /usr/bin/openssl — use it to generate the signing
  key + self-signed cert + PKCS12 keystore (`openssl pkcs12 -export`).
  Android Gradle signing accepts storeType "PKCS12" (.p12).
- python3 available for YAML syntax validation.

## Allowed scope (hard boundary)

May create/modify ONLY:
- `app/build.gradle.kts` (release buildType: minifyEnabled, shrinkResources,
  proguard files, signingConfigs.release reading keystore + passwords)
- new keystore directory/file (e.g. `keystore/` or under `app/`) + a passwords
  file committed alongside (e.g. `keystore.properties`)
- `app/proguard-rules.pro` (only if conservative keep rules are needed for
  Compose/Room/WorkManager under R8)
- `.github/workflows/ci.yml` (add release job + 4 MB size gate + artifact)
- `.gitignore` (only to ensure the keystore/passwords are NOT ignored)
- your attempt artifacts under the run directory

Must NOT:
- git commit, git push, or stage anything (human approval gate)
- modify any Kotlin/Java source, manifest, permissions, dependencies,
  gradle.properties JVM args, or the existing debug job's behavior
- run ./gradlew or any java/keytool command (unavailable + forbidden)
- touch `docs/` (untracked, belongs to other work)
- add anything network/INTERNET related

## Deterministic checks to run and record (in lieu of local builds)

1. YAML syntax validation of the modified `.github/workflows/ci.yml`
   (e.g. `python3 -c "import yaml,sys; yaml.safe_load(open(sys.argv[1]))" ...`
   — if the yaml module is missing, use any available validator and say so).
2. Structural assertions, each verified by grep/read and quoted in the result:
   - release job contains an `assembleRelease` step
   - size-gate step fails (exit nonzero) when APK >= 4194304 bytes
   - artifact upload step named `datacheck-release-apk` for the release APK
   - debug job steps unchanged (compare against git diff — debug job must
     show no diff)
   - keystore file exists, is non-empty, and is a valid PKCS12
     (`openssl pkcs12 -info -in <file> -passin pass:<pw> -noout` exit 0)
   - release signingConfig resolves to the committed keystore path + passwords
3. `git status --short` and `git diff --stat` captured as evidence.

The authoritative build check is the GitHub Actions run AFTER the user
approves the push — that happens outside this implementation attempt.

## Deliverables

Write to /home/ubuntu/.config/opencode/runs/data-check/M6/ISSUE-001/attempt-1/:
- `implementation-result.md`: files changed, every decision made (keystore
  path, passwords, gate threshold implementation), each deterministic check
  with the exact command + exit code + relevant output quote, and known risks.
- `keystore-passwords.txt`: the generated keystore passwords (also going
  in-repo per issue constraints).

Return in your final message: a compact summary — files touched, check
results (pass/fail each), risks. Do not claim CI-green; it has not run.
