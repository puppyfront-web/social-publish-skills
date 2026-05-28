---
name: xiaohongshu-upload
description: 当 agent 需要完成小红书登录、cookie 校验、视频发布或图文笔记发布时使用。使用本仓库 TypeScript + Playwright 引擎；命令为 node dist/cli.js xiaohongshu check|login|upload-video|upload-note（或 npm run dev --）。
---

# 小红书上传 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录直接执行命令，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter）才请求用户介入。
- 若缺少 `dist/cli.js` 或依赖未安装，Agent 先自动执行 `npm install`、`npx playwright install chromium`、`npm run build`，再继续业务命令。

## 执行入口（本仓库）

在 **social-publish-skills** 根目录：

```bash
node dist/cli.js xiaohongshu check --account <name>
node dist/cli.js xiaohongshu login --account <name>
node dist/cli.js xiaohongshu upload-video \
  --account <name> \
  --file <absolute_video_path> \
  --title "..."
node dist/cli.js xiaohongshu upload-note \
  --account <name> \
  --images <absolute_image_1> <absolute_image_2> \
  --title "..."
```

## 参数约定

### 视频

- `--file`：视频绝对路径，必填
- `--title`：标题，必填
- `--desc`：描述，可选，默认同标题
- `--tags`：逗号分隔话题，可选
- `--schedule`：定时发布，格式 `YYYY-MM-DD HH:mm`

### 图文

- `--images`：图片绝对路径列表，至少 1 张
- `--title`：标题，必填
- `--note`：正文，可选，默认同标题
- `--tags`：逗号分隔话题，可选
- `--schedule`：定时发布，格式 `YYYY-MM-DD HH:mm`

## cookie 持久化

- 默认目录：`$SOCIAL_PUBLISH_DATA_DIR/cookies/xiaohongshu/<account>.json`
- 发布前后引擎会读写 Playwright `storageState`

## 平台边界

- 支持小红书创作者平台视频和图文笔记。
- 当前实现参考抖音适配器，使用 Playwright 直接操作 `creator.xiaohongshu.com`。
- 首次验收建议设置 `SOCIAL_PUBLISH_HEADLESS=0` 观察扫码、上传控件和安全验证。

## 进度可视化

引擎在控制台输出 `⏳/✅/❌ [step/total] STAGE - message`；agent 应同步转述给用户。
