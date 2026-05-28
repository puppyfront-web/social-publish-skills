---
name: wechatmp-article-upload
description: 当 agent 需要完成微信公众号后台登录、cookie 校验、自动导入 Markdown/GitHub/网页内容并发布（默认草稿）时使用。使用本仓库 TypeScript 引擎与 Playwright；命令为 node dist/cli.js wechatmp check|login|publish（或 npm run dev --）。
---

# 微信公众号图文发布 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录直接执行命令，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter）才请求用户介入。
- 若缺少 `dist/cli.js` 或依赖未安装，Agent 先自动执行 `npm install`、`npx playwright install chromium`、`npm run build`，再继续业务命令。

## 标准执行模板（全自动优先）

1. 在仓库根目录检查 `dist/cli.js` 是否可用。
2. 若不可用，自动执行 `npm install`、`npx playwright install chromium`、`npm run build`。
3. 自动执行目标命令（`check` / `login` / `publish`）。
4. 仅在扫码或显式人工确认时暂停并请求用户操作；完成后由 Agent 继续后续步骤。

## 执行入口（本仓库）

在 **social-publish-skills** 根目录：

```bash
node dist/cli.js wechatmp check --account <name>
node dist/cli.js wechatmp login --account <name>
node dist/cli.js wechatmp publish \
  --account <name> \
  --source <absolute_markdown_path_or_url> \
  --title "..."
```

### 来源类型

- `--source-type auto`：默认，自动识别
- `--source-type markdown`：本地 Markdown（必须绝对路径）
- `--source-type github`：GitHub URL（优先读取 README 或 blob 文件）
- `--source-type url`：通用网页 URL（抓取正文后转换）

### 发布策略

- 默认保存草稿（推荐）
- 仅在用户明确要求时增加 `--publish` 直接发布

## 功能概览

| 功能 | CLI |
| --- | --- |
| cookie 校验 | `wechatmp check` |
| 登录 / 刷新 storageState | `wechatmp login` |
| 发布图文（默认草稿） | `wechatmp publish` |

## 默认工作流

1. `references/runtime-requirements.md`
2. `references/workflow-contract.md`
3. `scripts/examples/wechatmp_article_example.sh` 或直连 `node dist/cli.js`
4. `references/troubleshooting.md`

## cookie 持久化

- 默认目录：`$SOCIAL_PUBLISH_DATA_DIR/cookies/wechatmp/<account>.json`
- 发布前后引擎会读写的 Playwright `storageState`

## 进度可视化

引擎在控制台输出 `⏳/✅/❌ [step/total] STAGE - message`；agent 应同步转述给用户。

## 参考文档

- `references/runtime-requirements.md`
- `references/workflow-contract.md`
- `references/troubleshooting.md`
