---
name: multi-platform-publish-orchestrator
description: 当 agent 需要按 JSON 配置顺序执行多平台发布、统一 cookie/进度阶段、并兼容 Linux/macOS/Windows 时使用。本仓库引擎为 TypeScript + Playwright，已实现 tencent / douyin / kuaishou 三个平台。
---

# 多平台发布统一调度 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录**直接执行命令**，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter、Inspector Resume）才请求用户介入。
- 若缺少 `dist/cli.js` 或依赖未安装，Agent 先自动执行 `npm install`、`npx playwright install chromium`、`npm run build`，再继续业务命令。

## 标准执行模板（全自动优先）

1. 在仓库根目录检查 `dist/cli.js` 是否可用。
2. 若不可用，自动执行 `npm install`、`npx playwright install chromium`、`npm run build`。
3. 自动执行 `node dist/cli.js orchestrate --config <path>` 或 `verify-scan-login`。
4. 仅在扫码、Inspector Resume 或显式人工确认时暂停并请求用户操作；完成后由 Agent 继续后续步骤。

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
