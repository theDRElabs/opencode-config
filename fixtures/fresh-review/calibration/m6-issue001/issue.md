
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

