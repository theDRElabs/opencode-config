# Fresh-Context Review — ISSUE-008 (F-01, totalsSince SUM NULL-safety)

**Reviewer note on method (honesty first):** This session had no shell tool (`git show`/`git diff` not executable; subagent also lacked shell). Commit-level facts were verified from primary evidence that could be read: the git reflog (`.git/logs/HEAD`), branch refs (`.git/refs/heads/main`, `origin/main` — both `b5b6b9c…` at review time), current working-tree file contents, and the complete diffs embedded in the phase result documents. CI runs (34625633777 / 34626521082 / 34627788176) are producer-reported and not re-executable (no local toolchain; AGENTS.md mandates CI-only verification); internal consistency was assessed.

## 1. Verdict

**PASS** — the SQL fix is present and correct, the aggregate audit is accurate, the corrected pin test genuinely discriminates guarded from unguarded SQL (independently traced, not taken from the docs), scope is confirmed minimal, and the defect narrative is disclosed honestly. No blocking findings.

## 2. Blocking Findings

**None.**

## 3. Non-Blocking Findings

- **NB-1 (note, evidence-discipline):** The "TDD red first" acceptance was only ever CI-executed with the *defective* reflection mechanism. No CI run ever executed the *corrected* source-pin against the unguarded SQL — commit b5b6b9c (corrected pin) was pushed only after 1b37cd4 (fix), so the corrected pin's red was proven statically, not by CI. The red-vs-green discriminating power is real (independently traced both SQL variants against the assertions — see §6), and the docs disclose the misattribution explicitly (phase2-result.md:137-188), so this is a documentation/honesty point, not a mechanism defect. Suggested fix: accept the documented static proof, or optionally run the corrected pin against reverted SQL in one scratch CI run; either is fine.
- **NB-2 (note, slightly imprecise prose):** phase2-result.md:18-21 claims call sites "already handle the nullable row and see identical results." Precise statement: user-visible outcomes are identical via the `?: 0L` fallbacks at every call site (TickWorker.kt:29, DashboardScreen.kt:294, 312); pre-fix the empty-match case could also have crashed (F-01's whole premise), which is exactly what the fix removes. Wording nuance only; no behavioral claim is wrong about the post-fix state.
- **NB-3 (note, vestigial nullability):** After IFNULL, the aggregate-always-returns-one-row property plus non-NULL columns means `totalsSince` (UsageLogDao.kt:40) can no longer return `null` from any input — the `TotalsRow?` return type is now an over-approximation. Retaining it is correct for this issue (call sites unchanged is an acceptance criterion; changing callers is an explicit non-goal). No action.
- **NB-4 (note, documented limitation):** The pin is structural, not behavioral (KDoc UsageLogDaoSqlGuardTest.kt:11-15 is explicit). Room's NULL-row→non-null-Long mapping remains unexecutable in JVM tests under the no-new-deps constraint; the real safety net is the IFNULL SQL itself plus Room's compile-time SQL validation (CI build step). On-device human QA of the empty-match dashboard path remains outstanding (also covers the F-01 crash hypothesis, which becomes moot).

## 4. Required Changes

**None** (blocking). NB-1's optional scratch-CI red run, if desired, maps to no required change.

## 5. Acceptance-Criteria Coverage

| Criterion | Status | Evidence |
|---|---|---|
| Both SUM columns guarded with IFNULL(..., 0) | **covered** | UsageLogDao.kt:38 — `IFNULL(SUM(rx + tx), 0) AS total, IFNULL(SUM(fgRx + fgTx), 0) AS fgTotal`; single-line diff in phase2-result.md:98-109 |
| Other aggregates audited & documented (topAppsSince, dailySince, latestTickTotal) | **covered** | phase2-result.md:31-84; independently re-verified below |
| Regression pin, structural, honestly labeled | **covered** | UsageLogDaoSqlGuardTest.kt:7-35 (KDoc explicitly "STRUCTURAL test, not behavioral"); failures show extracted block text (lines 62, 66, 71) |
| Call sites unchanged; no schema change; no new deps | **covered** | `totalsSince(sinceMs: Long): TotalsRow?` signature identical (UsageLogDao.kt:40); `TotalsRow` unchanged (line 10); no other `@Query`/`@Dao` touched; test imports only `java.io.File`/`junit` (test lines 3-5); no schema/migration/version change anywhere |
| Existing 40 tests green; TDD red first; CI green | **covered (with NB-1 caveat)** | Reported: 34625633777 red (1 fail, misattributed), 34626521082 red (same defective line), 34627788176 41/41 green with artifacts; reflog confirms commit sequence 517f04c→a853443→1b37cd4→b5b6b9c = current HEAD and origin/main |

**Independent audit re-verification (every `@Query` in the codebase):** 8 `@Query` usages, all in the single DAO (UsageLogDao.kt:27, 30, 37, 42, 48, 55, 62, 65); exactly one DAO file. Ground fact: UsageEntity.kt:11-14 declares rx/tx/fgRx/fgTx as non-null `Long` → Room generates NOT NULL columns, so `rx+tx`/`fgRx+fgTx` are non-NULL on every existing row and any SUM over ≥1 row is non-NULL; NULL aggregates arise only from empty input.

- **topAppsSince (30-35):** `GROUP BY pkg` — empty match → zero groups → zero rows → empty `List`; non-empty → per-group SUM over non-NULL values. Audit holds.
- **dailySince (42-46):** same GROUP BY semantics; empty → empty `List`. Audit holds.
- **latestTickTotal (48-53):** INNER JOIN filtered to `t.endMs = (SELECT MAX(endMs) FROM ticks)` + GROUP BY. Empty `ticks` → MAX is NULL → `= NULL` never true → zero rows → `null`, and the return type is already `TickTotal?`; latest tick with no usage rows → zero joined rows → zero groups → `null` (type-system-handled); latest tick with usage → one group of non-NULL SUM. Audit holds.
- **latestEndMs (27-28):** bare non-GROUP-BY `MAX` returns one NULL row on empty `ticks` — but return type is `Long?`, so NULL maps to `null` legitimately; no NULL-into-non-null hazard. Documented adjacent note (phase2-result.md:79-84), correctly zero-change.
- **exportRows (55-60) and both DELETEs (62-66):** no aggregates. No missed non-GROUP-BY aggregate exists. **Audit complete and accurate.**

**Call-site behavior equivalence (independently read):** TickWorker.kt:29 `?.total ?: 0L`; DashboardScreen.kt:294 `?.total ?: 0L`; DashboardScreen.kt:312 `totals?.total ?: 0L`. All treat `null` and `TotalsRow(0,0)` identically (0L). No caller distinguishes null from 0 in any user-visible way, including the bundle path (DashboardScreen.kt:292-297). The claimed "identical results" holds for the observable value; the fix additionally removes the F-01 crash window.

## 6. Pin-Test Robustness Analysis (traced)

- **Genuine red on guard removal?** Yes. With SQL reverted to bare `SELECT SUM(rx + tx) AS total, SUM(fgRx + fgTx) AS fgTotal FROM usage WHERE tickStart >= :sinceMs`, compact form fails assertion 1 (no `ifnull(sum(rx+tx),0)astotal`), with the extracted block printed in the failure message. The phase2-result.md "true-red check" claim (lines 183-188) is correct.
- **Missing file → loud, never silent?** Yes. `candidates.firstOrNull { it.isFile } ?: error(...)` (lines 44-50) fails the test with user.dir and the candidate paths in the message. A pin that cannot see its subject is red.
- **Extraction robustness / false-green on malformed slice?** Traced the anchors: `funIdx = indexOf("suspend fun totalsSince")` (line 53), both anchor asserts guard the prerequisites (54, 56). `lastIndexOf("@Query(", funIdx)` picks the totalsSince block (line 37) — the only `@Query(` between topAppsSince's (line 30) and the fun at line 40. A mis-slice is impossible structurally: the three assertions are totalsSince-specific, and every *other* @Query block in the file fails at least one of them (e.g. topAppsSince has the from/where text but bare SUMs without IFNULL → assertions 1-2 fail; latestEndMs has none). Even a wrong slice fails red; there is no path to a silent green. Multi-line @Query, `+`-concatenation, and inter-literal spacing: whitespace is compacted away (line 59) so formatting never matters; the current SQL is a single string literal so the `"` boundary characters sit outside all three asserted substrings. Conservative failure direction confirmed: a future refactor splitting the literal at an unlucky point breaks a substring → false red, never false green. A `0L` instead of `0` also fails assertions 1-2 → red (intended strictness).
- **Working-directory assumption:** AGP unit tests run with module dir (`app/`) as working dir — documented Gradle behavior; candidates `src/main/java/...` then `app/src/main/java/...` (lines 40-43) cover both module-relative and repo-root launches; failure mode is loud and informative. Correct.
- **KDoc honesty:** Lines 7-35 state exactly what the test proves (SQL as written in source), what it does not prove (Room runtime mapping), why (BINARY retention of `androidx.room.Query`, no-new-deps), the mechanism change (reflection → source-file), and the path-resolution/loud-failure contract. Honest and accurate; the reflection defect is corroborated by phase1-result.md:49-61 and the b5b6b9c commit message.

## 7. Verification-Evidence Assessment

- **Source evidence:** strong — current DAO and test read in full; reflog (`.git/logs/HEAD` lines 27-29) confirms commit sequence, messages, and hashes exactly as claimed; `refs/heads/main` and `refs/remotes/origin/main` both = b5b6b9c, matching "current HEAD = b5b6b9c".
- **Diff evidence:** `git show` was not runnable; the 1b37cd4 diff is embedded verbatim in phase2-result.md:98-109 and matches the current tree exactly (one SQL string line). a853443's original test content is quoted in phase1-result.md:49-61. Residual uncertainty is limited to uncommitted working-tree state — none suggested by tree contents (all files match expected post-b5b6b9c state) and HEAD/origin alignment.
- **CI evidence:** three runs reported with consistent, mutually corroborating outcomes matching the defect narrative (red at `assertNotNull` line 29 in both red runs; 41/41 + artifacts on the fix run). Not independently re-executable (CI-only verification is the project's stated contract). The Room BINARY-retention explanation matches known Room annotation retention and is corroborated by the reflection test empirically failing at the annotation-null assert in two CI runs.
- **Claim accuracy:** no misleading statements in the phase docs except the wording nuance in NB-2; the misattributed-red disclosure is exemplary and correctly cites the ISSUE-002 operand-defect precedent.

## 8. Residual Risks

- Behavioral (Room runtime mapping of the empty aggregate) remains unexecutable in JVM tests under the no-new-deps constraint; the fix makes the question moot by SQL construction, and Room's compile-time SQL validation covers syntax/column references. On-device QA of dashboard-midnight and post-save empty windows remains a human step.
- If Room were ever to change (version bump) so that an aggregate row maps differently, the pin only guards the SQL text — a future behavior change would need a new test strategy; low likelihood.
- The `0` literal inside IFNULL is typed as `Long` via Room's result mapping into `TotalsRow.total: Long` (UsageLogDao.kt:10) — no overflow/type hazard for SUM of non-negative counters; not a new risk.
- Commit-level blob diffs were verified via reflog + embedded diffs + tree contents rather than a live `git diff`; a reviewer with shell access could re-run `git show --stat` for the three commits as a final cross-check (no suspicion raised by any evidence).
- Human acceptance (release, on-device behavior) is not claimed by this review.

---

**Compact summary:** VERDICT **PASS** — blocking findings: **0** — non-blocking: **4** (NB-1 red-first-only-statically-proven for the corrected mechanism; NB-2 prose nuance; NB-3 vestigial nullability; NB-4 documented structural-test limitation).
