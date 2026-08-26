#!/usr/bin/env bash
set -e
perl -0pi -e 's/score > 10/score >= 10/' src.js
npm test
