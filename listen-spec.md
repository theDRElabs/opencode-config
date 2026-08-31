# Build Spec: `/listen` skill for opencode

Status: READY TO BUILD — awaiting user go
Alignment record: confirmed 2026-08-30 (grill-me interview, same day)
Implementer: any fresh session; this file is self-contained.

## 1. What this is

A skill at `~/.config/opencode/skills/listen/` with two manual modes:

- `/listen` — **extraction**: scan opencode session transcripts since the last
  scan, pull out post-worthy ideas, write them as markdown idea files.
- `/listen brainstorm` — **evening session**: walk the idea backlog one idea at
  a time, draft X posts interactively; auto-draft anything flagged must-write.

There is no separate cheap model — extraction runs on the main model on demand.

## 2. Verified environment facts (research spike, 2026-08-30)

All of the following was confirmed by direct query this session:

- DB: `~/.local/share/opencode/opencode.db` (SQLite, WAL).
  Always open read-only: `sqlite3 "file:$HOME/.local/share/opencode/opencode.db?mode=ro"`
- Tables (relevant): `session`, `message`, `part`.
  - `session`: `id`, `title`, `directory`, `time_created`, `time_updated`, ...
  - `message`: `id`, `session_id`, `time_created`, `time_updated`, `data` (JSON with `$.role`)
  - `part`: `id`, `message_id`, `session_id`, `time_created`, `time_updated`, `data` (JSON with `$.type`, `$.text`)
- **Timestamps are MILLISECONDS epoch** — divide by 1000 for `datetime(x,'unixepoch')`.
- 275 sessions exist; text parts of user/assistant messages extract cleanly via:

```sql
select s.id, s.title, json_extract(m.data,'$.role'), json_extract(p.data,'$.text')
from part p
join message m on m.id = p.message_id
join session s on s.id = m.session_id
where json_extract(p.data,'$.type') = 'text'
  and json_extract(m.data,'$.role') in ('user','assistant')
order by p.time_created desc;
```

- Tools present: `sqlite3`, `jq`, `node`, `bash`.
- Part types seen: `text`, `reasoning`, `step-start` (filter to `text` only).

## 3. Files to create

1. `~/.config/opencode/skills/listen/SKILL.md`
   Frontmatter: `name: listen`, description with triggers: "listen", "mine my
   sessions for post ideas", "content ideas from my work", "brainstorm posts".
   Body: mode dispatch + workflows per §5–§7 + voice guide + security rules +
   edge cases.
2. `~/.config/opencode/skills/listen/scripts/extract.sh` (bash + sqlite3; no deps)
   - Args: `--since <ms-epoch>` (default: from state.json), `--all`, `--limit N`
   - Writes a readable dump to `~/.config/opencode/listen/dump.md`
   - Prints summary: sessions scanned, time range, dump size
   - Caps: max 15 sessions per run, max 6000 chars per part (truncate), max
     ~200KB total dump (take most recent sessions within cap, report skipped)
   - Does NOT update state.json — the agent does after idea files are written
3. Data dir `~/.config/opencode/listen/`:
   - `state.json` — `{"last_scan_ms": <int>, "scanned_sessions": ["ses_...", ...]}`
   - `ideas/YYYY-MM-DD-<slug>.md` — one file per idea (format §4)
   - `dump.md` — transient, overwritten each extraction run

## 4. Idea file format

```markdown
---
status: idea   # idea | drafted | posted | archived
type: lesson   # lesson | take | story
date: YYYY-MM-DD
source_session: ses_...
title: short slug-ish title
---
the insight, paraphrased, 1–3 sentences.

**why post-worthy:** ...
**hook:** rough first line

<!-- appended when drafted -->
## draft
<the post / thread>
```

## 5. Extraction workflow (SKILL.md core)

1. Run `scripts/extract.sh` → dump.md + summary.
2. No new sessions → say "nothing new since <date>", stop. Never touch backlog.
3. Read dump.md.
4. Extract **max 5 ideas** per run matching the gold criteria (all three count):
   - **lesson** — practical dev lessons: clever fixes, gotchas, tooling
     opinions, hard-won lessons another dev would find useful
   - **take** — opinions/contrarian takes, tooling/AI philosophy from sessions
   - **story** — anything surprising, funny, or story-like
5. Dedup: before writing, check existing `ideas/*.md` for the same insight.
   Same idea → append `**resurfaced:** YYYY-MM-DD` line to the existing file;
   never fork a duplicate.
6. Write idea files. Security rules (§7) apply — paraphrase everything.
7. Update `state.json`: `last_scan_ms` = max `time_updated` of scanned
   sessions; append scanned session ids.
8. Report: N sessions scanned, M ideas written, K dupes linked.

## 6. Brainstorm workflow (`/listen brainstorm`)

1. List backlog: idea files with `status: idea`, grouped by type, titles + counts.
2. Empty backlog → offer to run extraction first.
3. Walk one idea at a time: show insight + hook, ask the user to choose:
   **draft now** / **must-write** / **skip** / **archive**.
   - **must-write** = auto-draft immediately, no further back-and-forth.
4. Voice for all drafts — terse lowercase:
   - lowercase throughout, short sentences, no emojis, no hashtag spam
   - first line = hook, then payoff, optional 1-line context
   - thread format when needed: numbered tweets, each ≤280 chars, each stands
     alone; one idea per post; concrete beats abstract
5. Accepted draft → append `## draft` to the idea file, flip status to `drafted`.
6. Dead idea → flip status to `archived`; never delete files.
7. Close with summary: drafted / archived / still-idea counts.

## 7. Security rules (hard)

- Idea files NEVER contain: verbatim secrets, API keys, tokens, real
  usernames/emails, raw code longer than one line, or private paths (genericize).
  Paraphrase everything.
- DB access is read-only (`mode=ro`) — mandatory in script and any ad-hoc query.
- `dump.md` is transient and local: never commit it, never paste large raw
  chunks into chat output beyond what extraction needs.
- No auto-posting anywhere, ever.

## 8. Edge cases

- `state.json` missing → first run: default lookback = last 3 days (not
  `--all`) unless the user passes `--all`.
- Dump exceeds caps → take most recent sessions within cap, report skipped count.
- DB locked or missing → report, don't crash, suggest retry.
- Duplicate insight on rescan → link per §5.5, no fork.
- Empty dump sections (tool-heavy session with no text parts) → skip silently.

## 9. Acceptance (manual QA on this device)

1. `/listen` → dump + ≥0 idea files written, `state.json` updated; immediate
   rerun → "nothing new".
2. Rerun with `--all` over same sessions → no forked duplicates (dupes linked).
3. `/listen brainstorm` → walks backlog, produces ≥1 draft in voice, status flips.
4. Skill appears in opencode's available skills list.
5. `grep -riE '(sk-|token|password|api[_-]?key)' ideas/` → no hits.

## 10. Non-goals

- No Claude Code / Codex transcripts (opencode DB only).
- No cron / background / session-end automation.
- No auto-posting to X; no posting integration.
- No separate cheap model.
- Posts in English.

## 11. Implementation order

1. `scripts/extract.sh` — verify against live DB with a 1-session `--limit 1` run.
2. `SKILL.md` — write per §5–§8.
3. Manual QA per §9, report evidence.
