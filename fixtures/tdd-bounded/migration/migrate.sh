#!/usr/bin/env bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
node -e "
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const db = new DatabaseSync('db.sqlite');
const schema = fs.readFileSync('${SCRIPT_DIR}/schema.sql', 'utf8');
db.exec(schema);
db.prepare('INSERT INTO account VALUES (1, ?)').run('Ada');
db.close();
"
