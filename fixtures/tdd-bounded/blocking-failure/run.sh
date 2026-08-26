#!/usr/bin/env bash
set -e
printf 'red evidence\n'
printf 'green check failed: injected blocking failure\n' >&2
exit 1
