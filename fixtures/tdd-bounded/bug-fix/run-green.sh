#!/usr/bin/env bash
set -e
perl -0pi -e 's/return value \+ 2;/return value * 2;/' src.js
node test.js
