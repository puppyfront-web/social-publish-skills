#!/usr/bin/env bash
# 在 social-publish-skills 仓库根目录执行
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
cd "$ROOT"
DEFAULT_CFG="skills/multi-platform-publish-orchestrator/references/orchestrator.config.example.json"
node dist/cli.js orchestrate --config "${1:-$DEFAULT_CFG}"
