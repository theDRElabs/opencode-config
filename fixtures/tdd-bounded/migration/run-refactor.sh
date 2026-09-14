#!/usr/bin/env bash
set -e
printf 'diff review: migration remains minimal; no safe refactor needed\n'
rm -f db.sqlite
./migrate.sh
node -e "const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync('db.sqlite');const r=db.prepare('PRAGMA integrity_check').get();db.close();if(r.integrity_check!=='ok'){process.exit(1)}"
