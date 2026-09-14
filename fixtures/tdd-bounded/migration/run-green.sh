#!/usr/bin/env bash
set -e
rm -f db.sqlite
printf 'CREATE TABLE account (id INTEGER PRIMARY KEY, display_name TEXT NOT NULL);\n' > schema.sql
./migrate.sh
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('db.sqlite');const r=db.prepare('SELECT display_name FROM account').get();db.close();if(r.display_name!=='Ada'){process.exit(1)}"
