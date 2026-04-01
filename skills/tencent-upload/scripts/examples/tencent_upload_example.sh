#!/usr/bin/env bash
# 在仓库根目录执行（需先 npm install && npm run build）
# 首次登录: node dist/cli.js tencent login --account YOUR_ACCOUNT
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
node dist/cli.js tencent upload \
  --account "${1:?account}" \
  --file "${2:?video}" \
  --title "${3:?title}" \
  --tags "${4:-}"
