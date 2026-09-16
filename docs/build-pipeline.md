# Global build pipeline

Detail for `pipeline-init`. Referenced from `AGENTS.md`; the always-on
rule there is only the one-line pointer.


For ANY new or existing heavy project (app or site) on this device that will be
pushed to GitHub and/or deployed, wire it into the global pipeline WITHOUT the
user asking. Use it when the project needs CI, E2E tests, or a production
deployment. This is the default, not the exception.

Pipeline = project dev → GitHub CI (typecheck/lint/test/build) → Playwright E2E
→ Vercel deploy. Reusable workflows live in `theDRElabs/pipeline`; projects just
call them.

## How to apply (one command, no manual steps)

From the project directory (or with the project name):

```bash
pipeline-init <project-name>
```

`pipeline-init` (at `~/bin/pipeline-init`, source in
`~/projects/pipeline/pipeline-init.sh`) does all of this automatically:
- `git init` + noreply git email (avoids GH007 push rejection)
- adds `.github/workflows/pipeline.yml` caller that invokes the reusable
  `ci` / `e2e` / `deploy` workflows from `theDRElabs/pipeline`
- adds `typecheck` / `test` / `e2e` scripts + playwright/wait-on devDeps
- adds .gitignore entries (node_modules, .next, .env*, db files)
- creates the private GitHub repo and pushes
- sets the `VERCEL_TOKEN` secret from the local vercel auth.json

## Important environment rules (from BUILD-LESSONS.md)

- Git email for GitHub pushes MUST be `144799227+theDRElabs@users.noreply.github.com`
  (personal email is blocked by GH007).
- Verify deploys on the PRODUCTION alias domain, not the ephemeral
  `*-<hash>-*.vercel.app` URL (those are auth-protected).
- Do not use `vercel tokens create`/`add` (403). Reuse the login token.
- Use generous timeouts; large installs can take several minutes.
- Private reusable workflows need the `pipeline` repo's Actions access set to
  `user` (`gh api -X PUT repos/theDRElabs/pipeline/actions/permissions/access -f access_level=user`).
- Vercel CLI login tokens EXPIRE and are useless as a GitHub secret. Use a
  personal access token from https://vercel.com/account/settings/tokens
  (full-account scope). Set it via `gh secret set VERCEL_TOKEN` (pipe via stdin).
- Historical phone build lessons live in `~/projects/termux-setup/BUILD-LESSONS.md`.
  They document the Termux/proot phone environment — informational only, do NOT
  apply phone procedures (pkg, proot-distro, memory caps, Android sideloading)
  on this server.

## Exceptions (do NOT apply the pipeline)

- Tiny scripts/single-file experiments with no repo or deployment intent.
- Projects the user explicitly keeps local-only.

## Android / iOS apps (pipeline-init now handles these — no manual wiring)

`pipeline-init <project-name>` detects the platform (Gradle → Android,
`project.yml`/xcodeproj → iOS, else web) and wires a **repo-local
self-contained** `.github/workflows/ci.yml` instead of the npm pipeline:

- **Android** → `android-ci-template.yml`: build (`assembleDebug
  testDebugUnitTest lint`) + a separate `ui-test` emulator job (ReactiveCircus
  emulator-runner @v2, api-level 30, `MAESTRO_DRIVER_STARTUP_TIMEOUT`=90000,
  `hide_error_dialogs 1`) that runs Maestro flows in `.maestro/`. APK +
  lint results + Maestro screenshots uploaded as artifacts. No local JDK/SDK is
  assumed; the proven version matrix lives in BUILD-LESSONS.md § "Android /
  Gradle CI Lessons", and the `data-check` ci.yml remains the reference build.
- **iOS** → `ios-ci-template.yml`: macOS runner, setup-xcode latest-stable,
  XcodeGen from `project.yml`, `build-for-testing` +
  `test-without-building` (XCUITest), then Maestro flows on the booted
  simulator. The simulator is **resolved dynamically** (device + explicit OS
  from `simctl`), never hardcoded — Apple renames the lineup every Xcode.
- After CI is green, run `pipeline-bughunt <project>` to download the run's
  artifacts and file a report + issues.

`pipeline-init` no longer injects npm junk into mobile repos, and it will not
overwrite an existing `ci.yml` (no-clobber). Known lint/compile traps
(WorkManager init removal, API-level guards) remain in BUILD-LESSONS.md.
