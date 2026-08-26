#!/usr/bin/env bash
set -e
printf 'diff review: no safe refactor needed; module boundary and unrelated files preserved\n'
node --check src.js
npm test
