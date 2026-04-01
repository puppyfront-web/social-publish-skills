---
name: multi-platform-publish-orchestrator
description: 当 agent 需要按 JSON 配置顺序执行多平台发布、统一 cookie/进度阶段、并兼容 Linux/macOS/Windows 时使用。本仓库引擎为 TypeScript + Playwright，已实现 tencent / douyin / kuaishou 三个平台。
---

# 多平台发布统一调度 Skill

## 执行入口

在 **social-publish-skills** 根目录：

```bash
npm install
npx playwright install chromium   # 本机首次
npm run build                       # 生成 dist/（仓库不提交 dist）
node dist/cli.js orchestrate --config path/to/config.json
```

示例配置：`references/orchestrator.config.example.json`（本 skill 目录下）。可选字段 `data_dir` 会写入 `process.env.SOCIAL_PUBLISH_DATA_DIR`。

Shell 封装：`scripts/examples/run_orchestrate.sh`。

**扫码登录链路验收**（人工扫码，机器校验）：`node dist/cli.js verify-scan-login --account <别名>`。抖音/快手 `login` 扫码阶段默认**轮询**；视频号多依赖 Inspector Resume 或 `SOCIAL_PUBLISH_LOGIN_STDIN=1`。各站保存后默认无头 `check`，可用 `--skip-verify` 关闭。

## 核心实现

- `src/orchestrator.ts`：读取任务列表，按 platform 分发
- `src/platforms/tencent.ts`：微信视频号
- `src/platforms/douyin.ts`：抖音创作者平台
- `src/platforms/kuaishou.ts`：快手创作者平台

## 已支持平台

| 平台 | CLI 子命令 | cookie 路径 | 状态 |
|------|-----------|------------|------|
| 微信视频号 | `tencent` | `cookies/tencent/<account>.json` | 已实现 |
| 抖音 | `douyin` | `cookies/douyin/<account>.json` | 已实现 |
| 快手 | `kuaishou` | `cookies/kuaishou/<account>.json` | 已实现 |

## 扩展新平台

在 `src/platforms/` 实现发布函数 → 在 `orchestrator.ts` 增加 `switch` 分支 → 在 `cli.ts` 添加子命令 → 更新本 SKILL 与 `references/orchestrator.config.example.json`（或同类示例）。

## 进度协议

8 阶段：`INIT` → `COOKIE_CHECK` → `COOKIE_REFRESH` → `OPEN_PUBLISH_PAGE` → `UPLOAD_START` → `UPLOAD_TRANSFERRING` → `PUBLISHING` → `DONE`

## 参考

- `references/orchestration-contract.md`
- `references/runtime-requirements-cross-platform.md`
- `references/browser-cookie-compatibility.md`
- `references/troubleshooting.md`
