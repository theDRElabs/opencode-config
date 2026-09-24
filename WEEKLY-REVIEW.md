# Weekly Transcript-Reading Ritual

**Phase**: 21 — Weekly transcript-reading ritual (fixes G6)
**Created**: 2026-09-16
**Owner**: human (the habit is HITL); artifacts and the dry-run entry are agent-produced

---

## Cadence

- Weekly, fixed slot. Put it in the calendar; do not wait for a trigger.
- Budget 30–60 minutes. Timebox hard.
- Skip only if there were no new runs since the last review — i.e.
  `find runs/ -newer runs/.last-weekly-review` is empty.
- A skipped week does not move the marker; the next review still starts from the
  previous marker.

---

## Inputs (in priority order)

1. **New agent-run transcripts** — `runs/<project>/<milestone>/ISSUE-*/attempt-*/`
   newer than `runs/.last-weekly-review`. Read `review.md`, `implementation-result.md`,
   `phase1-result.md` / `phase2-result.md`, and the milestone `events.jsonl`.
2. **Failed fixture cases from the week** — `fail` and `known_fail` rows in
   `harness-health.md` and `metrics/history.jsonl`.
3. **Trial flakes** — any non-100% row in the latest `metrics/trials-*.json`
   (Phase 17). Variance in a deterministic suite is an environmental flake to
   investigate, not an "agent" failure.
4. **Judge disagreements** — the disagreement list from the latest
   `metrics/judge-calibration-*.json` (Phase 19), once that phase has run.

---

## What to look for

- **Distraction** — the agent went off-track and did not self-correct inside the
  attempt: wasted tool calls, re-litigating settled decisions.
- **Context bloat** — the attempt carried unrelated history; a fresh context would
  have been cheaper and sharper.
- **Token spend outliers** — cross-check the week's attempts against
  `scripts/token-report.sh`. State whether an outlier is attributable to a specific
  issue or unattributable (see Known limits).
- **Unfair failures** — ask "was that on the agent?". If the environment caused the
  failure (missing tool, no shell, no GPU, stale path), it is an unfair failure and
  must not be scored against the agent. Convert it to a fixture through Phase 20
  intake.
- **New successful patterns** — a technique that worked and should be promoted into a
  skill, a fixture, or the harness contract.

---

## Output (required)

Append one dated entry to the **Improvement Log** in `HARNESS-METRICS.md`. The entry
is the review of record; a review with no entry did not happen.

Every entry must end with the audit line:

```
review: date=<YYYY-MM-DD> transcripts_read=<n paths or count> findings=<n> cases_created=<n> proposed=<n>
```

- `transcripts_read` — exact paths, or a count plus the glob, that were read.
- `findings` — number of findings written up in the entry.
- `cases_created` — fixture cases actually added via the Phase 20 intake in this
  session.
- `proposed` — fixture-case candidates handed to the Phase 20 pipeline but not yet
  created.

After the entry is written, refresh the marker:

```bash
touch runs/.last-weekly-review
```

---

## Known limits (do not re-discover each week)

- **`/runs/` is git-ignored except the durable record** (`.gitignore:6-13`). Negation
  patterns keep `runs/**/review.md`, `runs/**/events.jsonl`, and
  `runs/.last-weekly-review` tracked; every other transcript (`issue.md`,
  `input-manifest.md`, `phase*-result.md`, `implementation-result.md`,
  `full-diff.patch`, `commits.txt`) stays out of the repo. If a future review needs
  another artifact versioned, add a negation line for it — do not un-ignore all of
  `/runs/`.
- `runs/*/events.jsonl` carries no session IDs, so attempts cannot be joined to
  `opencode.db` sessions. Per-issue token cost is currently unattributable.
- The `harness_development` layer in `scripts/token-report.sh` is empty because
  session `directory` is not a harness/project discriminator. Harness spend is
  therefore invisible in the token report.
- Reviewer contexts have been observed without shell or file-write tools. When that
  happens, `git diff` / `git show` / CI re-execution are unavailable and the review
  rests on file contents, `.git` internals, and diffs embedded in the phase docs.
  Treat it as an environment limitation, not a reviewer failure — but record it,
  because the same task constrained differently across attempts is an unfair
  comparison.

---

## Command stub

`commands/weekly-review.md` opens this checklist and prints the week's new runs.