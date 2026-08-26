#!/usr/bin/env bash
set -e
rm -f db.sqlite
./migrate.sh
