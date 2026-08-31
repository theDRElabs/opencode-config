---
name: listen
description: >
  Mine opencode session transcripts for post-worthy ideas and turn them into
  X posts. Use when the user says "listen", "/listen", "mine my sessions for
  post ideas", "content ideas from my work", "brainstorm posts", "what should
  I post", or wants short-form post drafts from dev sessions. Two modes:
  extraction (default) and brainstorm.
---

# Listen

Turns work sessions into content. Data dir: `~/.config/opencode/listen/`
(`state.json`, `ideas/*.md`, transient `dump.md`). Source:
`~/.local/share/opencode/opencode.db` (opencode only, always read-only).

## Mode 1: extract (default)

1. Run:
   ```bash
   ~/.config/opencode/skills/listen/scripts/extract.sh
   ```
   Flags: `--since <ms>` (override state), `--all` (ignore state), `--limit N`
   (max 15). First-ever run defaults to a 3-day lookback.
2. Read the summary. If `sessions_dumped: 0` → say "nothing new since <date>",
   stop. Never touch the backlog.
3. Read `dump.md` (in chunks if large).
4. Extract AT MOST 5 ideas per run, matching the gold criteria:
   - **lesson** — clever fixes, gotchas, tooling opinions, hard-won lessons
   - **take** — opinions, contrarian takes, tooling/AI philosophy
   - **story** — surprising, funny, or story-like moments
5. Dedup FIRST: `ls ~/.config/opencode/listen/ideas/`, read near-matching
   files. Same insight → append `**resurfaced:** YYYY-MM-DD` to the existing
   file; never fork a duplicate.
6. Write each idea to `ideas/YYYY-MM-DD-<slug>.md` (template below).
7. Only after idea files are written, update state (use `max_time_updated_ms`
   and `session_ids` from the script summary):
   ```bash
   cd ~/.config/opencode/listen && jq --argjson ms <MAX_MS> \
     --argjson ids '["ses_a","ses_b"]' \
     '.last_scan_ms = $ms | .scanned_sessions += $ids' \
     state.json > state.tmp && mv state.tmp state.json
   ```
   If state.json is missing, create `{"last_scan_ms": 0, "scanned_sessions": []}`
   first.
8. Report: N sessions scanned, M ideas written, K dupes linked — then one line
   per new idea: title (type) + hook.

## Mode 2: brainstorm (`/listen brainstorm`)

1. List backlog: idea files with `status: idea`, grouped by type.
2. Empty backlog → offer to run extraction first.
3. Walk ONE idea at a time: show title, insight, hook. User picks:
   **draft now** / **must-write** / **skip** / **archive**.
   - **must-write** → draft immediately, no further questions.
4. Voice — terse lowercase:
   - all lowercase, short sentences, no emojis, no hashtags
   - line 1 = hook, then payoff, optional 1 line of context
   - threads: numbered posts, each ≤280 chars, each stands alone
   - one idea per post; concrete beats abstract
5. Accepted draft → append a `## draft` section to the idea file and set
   `status: drafted`.
6. Dead idea → `status: archived`. Never delete files.
7. Close with counts: drafted / archived / still ideas.

## Idea file template

```markdown
---
status: idea
type: lesson
date: YYYY-MM-DD
source_session: ses_...
title: short title
---
the insight, paraphrased, 1-3 sentences.

**why post-worthy:** ...
**hook:** rough first line
```

## Security (hard rules)

- Idea files NEVER contain: secrets, API keys, tokens, real usernames/emails,
  wallet addresses, private paths, or code quoted verbatim. Paraphrase.
- The DB is opened read-only (`mode=ro`). Never write to it.
- `dump.md` stays local; never paste large raw chunks into chat.
- No auto-posting anywhere, ever.

## Edge cases

- state.json missing → extractor defaults to 3-day lookback (not `--all`)
- dump hit byte cap → summary reports skipped sessions; they return next run
- DB locked/missing → script exits cleanly with an error; tell the user to retry
- session with no text parts → skipped silently by the script
- duplicate insight on rescan → `resurfaced` line, no fork
