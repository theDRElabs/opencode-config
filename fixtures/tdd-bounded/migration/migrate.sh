#!/usr/bin/env bash
set -e
sqlite3 db.sqlite < schema.sql
sqlite3 db.sqlite "INSERT INTO account VALUES (1, 'Ada');"
