#!/usr/bin/env bash
# listen extract — dump recent opencode session transcripts to a readable file.
# Read-only against the DB. Never touches state.json (the agent updates it
# after writing idea files).
set -euo pipefail

DB="file:$HOME/.local/share/opencode/opencode.db?mode=ro"
LISTEN_DIR="$HOME/.config/opencode/listen"
DUMP="$LISTEN_DIR/dump.md"
STATE="$LISTEN_DIR/state.json"

MAX_SESSIONS=15
MAX_PART_CHARS=6000
MAX_DUMP_BYTES=204800

SINCE=""
ALL=0
LIMIT=$MAX_SESSIONS

while [[ $# -gt 0 ]]; do
  case $1 in
    --since) SINCE=$2; shift 2 ;;
    --all)   ALL=1; shift ;;
    --limit) LIMIT=$2; shift 2 ;;
    *) echo "usage: extract.sh [--since <ms>] [--all] [--limit N]" >&2; exit 2 ;;
  esac
done

if (( LIMIT > MAX_SESSIONS )); then LIMIT=$MAX_SESSIONS; fi
if (( LIMIT < 1 )); then LIMIT=1; fi

if [[ -z "$SINCE" && "$ALL" -eq 0 ]]; then
  if [[ -f "$STATE" ]]; then
    SINCE=$(jq -r '.last_scan_ms // empty' "$STATE" 2>/dev/null || true)
  fi
  if [[ -z "$SINCE" ]]; then
    now_ms=$(date +%s%3N)
    if [[ "$now_ms" == *N ]]; then now_ms=$(( $(date +%s) * 1000 )); fi
    SINCE=$(( now_ms - 3*24*3600*1000 ))   # first run: last 3 days
  fi
fi
if [[ -z "$SINCE" ]]; then SINCE=0; fi

mkdir -p "$LISTEN_DIR"

if [[ ! -f "$HOME/.local/share/opencode/opencode.db" ]]; then
  echo "ERROR: opencode db not found at ~/.local/share/opencode/opencode.db" >&2
  exit 1
fi

query() { sqlite3 "$DB" "$1"; }

iso() { date -u -d "@$(( $1 / 1000 ))" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo "$1"; }

if ! SESSION_ROWS=$(query "select id || '|' || replace(replace(title, char(10), ' '), '|', '/') || '|' || replace(directory, '|', '/') || '|' || time_updated from session where time_updated > ${SINCE} order by time_updated desc limit ${LIMIT};"); then
  echo "ERROR: cannot read session db (locked?)" >&2
  exit 1
fi

mapfile -t ROWS <<< "$SESSION_ROWS"

{
  echo "# listen dump"
  echo "generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "since: $(iso "$SINCE")"
  echo
} > "$DUMP"

scanned=0
empty=0
cap_skipped=0
max_ms=0
dumped_ids=()

for i in "${!ROWS[@]}"; do
  row=${ROWS[$i]}
  if [[ -z "$row" ]]; then continue; fi

  sid=${row%%|*}; rest=${row#*|}
  title=${rest%%|*}; rest=${rest#*|}
  dir=${rest%%|*}; tup=${rest##*|}

  PART_FILTER=""
  if [[ "$ALL" -eq 0 ]]; then PART_FILTER=" and p.time_created > ${SINCE}"; fi
  if ! PARTS=$(query "select json_extract(m.data,'\$.role') || char(31) || replace(json_extract(p.data,'\$.text'), char(10), char(14)) from part p join message m on m.id = p.message_id where p.session_id = '${sid}' and json_extract(p.data,'\$.type') = 'text' and json_extract(m.data,'\$.role') in ('user','assistant')${PART_FILTER} order by p.time_created, p.id;"); then
    PARTS=""
  fi

  SEC=$(mktemp)
  has_text=0
  prev_role=""
  while IFS= read -r pline; do
    if [[ -z "$pline" ]]; then continue; fi
    role=${pline%%$'\x1f'*}
    text=${pline#*$'\x1f'}
    text=${text//$'\x0e'/$'\n'}
    if [[ -z "${text//[[:space:]]/}" ]]; then continue; fi
    has_text=1
    if (( ${#text} > MAX_PART_CHARS )); then
      text="${text:0:MAX_PART_CHARS}
... [truncated]"
    fi
    if [[ "$role" != "$prev_role" ]]; then
      if [[ -n "$prev_role" ]]; then echo; fi
      echo "### $role"
      echo
      prev_role=$role
    fi
    printf '%s\n\n' "$text"
  done <<< "$PARTS" > "$SEC"

  if (( has_text == 0 )); then
    empty=$(( empty + 1 ))
    if (( tup > max_ms )); then max_ms=$tup; fi
    rm -f "$SEC"
    continue
  fi

  cur=$(wc -c < "$DUMP"); cur=${cur//[[:space:]]/}
  sec=$(wc -c < "$SEC"); sec=${sec//[[:space:]]/}
  if (( cur + sec > MAX_DUMP_BYTES )); then
    cap_skipped=$(( ${#ROWS[@]} - i ))
    rm -f "$SEC"
    break
  fi

  {
    echo "## $title"
    echo "session: $sid | dir: $dir | updated: $(iso "$tup")"
    echo
    cat "$SEC"
  } >> "$DUMP"
  rm -f "$SEC"

  if (( tup > max_ms )); then max_ms=$tup; fi
  scanned=$(( scanned + 1 ))
  dumped_ids+=("$sid")
done

dump_bytes=$(wc -c < "$DUMP"); dump_bytes=${dump_bytes//[[:space:]]/}
echo "sessions_considered: ${#ROWS[@]}"
echo "sessions_dumped: $scanned"
echo "sessions_empty: $empty"
echo "sessions_skipped_cap: $cap_skipped"
echo "max_time_updated_ms: $max_ms"
echo "dump: $DUMP ($dump_bytes bytes)"
if (( ${#dumped_ids[@]} > 0 )); then
  echo "session_ids: ${dumped_ids[*]}"
fi
if (( scanned == 0 )); then
  echo "nothing new since $(iso "$SINCE")"
fi
