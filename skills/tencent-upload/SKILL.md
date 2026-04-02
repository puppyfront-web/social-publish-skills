---
name: tencent-upload
description: 当 agent 需要完成微信视频号登录、cookie 校验、视频发布与进度可视化时使用。使用本仓库 TypeScript 引擎与 Playwright；命令为 node dist/cli.js tencent check|login|upload（或 npm run dev --）。不依赖任何第三方上传仓库。
---

# 视频号上传 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录**直接执行命令**，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter、Inspector Resume）才请求用户介入。
- 若缺少 `dist/cli.js` 或依赖未安装，Agent 先自动执行 `npm install`、`npx playwright install chromium`、`npm run build`，再继续业务命令。

## 标准执行模板（全自动优先）

1. 在仓库根目录检查 `dist/cli.js` 是否可用。
2. 若不可用，自动执行 `npm install`、`npx playwright install chromium`、`npm run build`。
3. 自动执行目标命令（`check` / `login` / `upload`）。
4. 仅在扫码、Inspector Resume 或显式人工确认时暂停并请求用户操作；完成后由 Agent 继续后续步骤。

## 执行入口（本仓库）

在 **social-publish-skills** 根目录：

```bash
npm install && npm run build
node dist/cli.js tencent check --account <name>
node dist/cli.js tencent login --account <name>
node dist/cli.js tencent upload --account <name> --file <video> --title "..." --tags "a,b"
```

环境变量见仓库根 `README.md`（`SOCIAL_PUBLISH_DATA_DIR`、`SOCIAL_PUBLISH_HEADLESS`、`SOCIAL_PUBLISH_CHROME_PATH`）。

## 功能概览

| 功能 | CLI |
| --- | --- |
| cookie 校验 | `tencent check` |
| 登录 / 刷新 storageState | `tencent login`（headed + Playwright pause） |
| 发布视频 | `tencent upload` |

## 默认工作流

1. `references/runtime-requirements.md`
2. `references/workflow-contract.md`
3. `scripts/examples/tencent_upload_example.sh` 或直连 `node dist/cli.js`
4. `references/troubleshooting.md`

## cookie 持久化

- 默认目录：`$SOCIAL_PUBLISH_DATA_DIR/cookies/tencent/<account>.json`
- 发布前后引擎会读写的 Playwright `storageState`

## 进度可视化

引擎在控制台输出 `⏳/✅/❌ [step/total] STAGE - message`；agent 应同步转述给用户。

## 参考文档

- `references/runtime-requirements.md`
- `references/workflow-contract.md`
- `references/troubleshooting.md`
