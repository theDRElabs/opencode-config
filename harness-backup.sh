#!/usr/bin/env bash
# harness-backup.sh — Create a timestamped tarball of the opencode config
# Usage: bash ~/.config/opencode/harness-backup.sh [output-dir]
set -euo pipefail

HARNESS_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="${1:-$HOME/backups}"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$OUTPUT_DIR/opencode-harness-$TIMESTAMP.tar.gz"

mkdir -p "$OUTPUT_DIR"

tar czf "$BACKUP_FILE" \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='graph/' \
  --exclude='*.log' \
  -C "$(dirname "$HARNESS_DIR")" \
  "$(basename "$HARNESS_DIR")"

echo "Backup created: $BACKUP_FILE ($(du -h "$BACKUP_FILE" | cut -f1))"

# Keep only last 5 backups
ls -t "$OUTPUT_DIR"/opencode-harness-*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm -v
echo "Old backups pruned (keeping last 5)"
