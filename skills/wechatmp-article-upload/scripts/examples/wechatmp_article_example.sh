#!/usr/bin/env bash
set -euo pipefail

# Run from repository root.

ACCOUNT="${ACCOUNT:-my_account}"
TITLE="${TITLE:-自动化发布示例}"
SOURCE="${SOURCE:-/absolute/path/to/article.md}"

node dist/cli.js wechatmp check --account "$ACCOUNT" || true
node dist/cli.js wechatmp login --account "$ACCOUNT"

# Default: save draft
node dist/cli.js wechatmp publish \
  --account "$ACCOUNT" \
  --source "$SOURCE" \
  --title "$TITLE" \
  --source-type auto

# Direct publish (only when explicitly required):
# node dist/cli.js wechatmp publish \
#   --account "$ACCOUNT" \
#   --source "$SOURCE" \
#   --title "$TITLE" \
#   --publish
