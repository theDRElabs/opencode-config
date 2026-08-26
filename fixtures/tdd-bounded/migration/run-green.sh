#!/usr/bin/env bash
set -e
rm -f db.sqlite
printf 'CREATE TABLE account (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);\n' > schema.sql
./migrate.sh
sqlite3 db.sqlite "SELECT display_name FROM account;" | grep -Fx Ada
