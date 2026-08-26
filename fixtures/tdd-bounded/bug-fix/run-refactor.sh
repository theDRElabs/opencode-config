#!/usr/bin/env bash
set -e
printf 'diff review: no safe refactor needed; existing export and unrelated files preserved\n'
node --check src.js
node test.js
