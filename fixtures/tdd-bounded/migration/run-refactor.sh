#!/usr/bin/env bash
set -e
printf 'diff review: migration remains minimal; no safe refactor needed\n'
rm -f db.sqlite
./migrate.sh
sqlite3 db.sqlite "PRAGMA integrity_check;" | grep -Fx ok
