---
name: douyin-upload
description: 当 agent 需要编排抖音视频的登录校验、cookie 持久化与发布进度可视化时使用。本仓库为独立 social-publish-skills，抖音 TypeScript 引擎已通过 Playwright 完整实现。
---

# 抖音上传 Skill

本仓库 **不依赖** 任何外部上传项目；抖音执行入口为 **`node dist/cli.js douyin`（Node CLI）**，与视频号、快手共用同一 CLI。拉取源码后需在本仓库根目录执行 `npm install`、`npx playwright install chromium`、`npm run build` 后再调用（见 `references/runtime-requirements.md`）。

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录**直接执行命令**，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter）才请求用户介入。
- 若缺少 `dist/cli.js` 或依赖未安装，Agent 先自动执行 `npm install`、`npx playwright install chromium`、`npm run build`，再继续业务命令。

## 标准执行模板（全自动优先）

1. 在仓库根目录检查 `dist/cli.js` 是否可用。
2. 若不可用，自动执行 `npm install`、`npx playwright install chromium`、`npm run build`。
3. 自动执行目标命令（`check` / `login` / `upload`）。
4. 仅在扫码或显式人工确认时暂停并请求用户操作；完成后由 Agent 继续后续步骤。

## 当前状态

- **引擎**：`src/platforms/douyin.ts` — 已完整实现（Playwright + TypeScript）
- **功能**：cookie 校验 / QR 扫码登录 / 视频上传 / 标题描述话题 / 定时发布

## CLI 用法

```bash
# 校验 cookie
node dist/cli.js douyin check --account <name>

# 扫码登录（自动弹出浏览器；扫码成功后由引擎轮询检测，一般无需再点 Inspector Resume）
node dist/cli.js douyin login --account <name>
# 若需纯手动结束：SOCIAL_PUBLISH_LOGIN_STDIN=1（终端按 Enter）或 SOCIAL_PUBLISH_LOGIN_NO_POLL=1（仅 Inspector Resume）

# 上传视频
node dist/cli.js douyin upload \
  --account <name> \
  --file /path/to/video.mp4 \
  --title "标题" \
  --desc "描述" \
  --tags "话题一,话题二" \
  --schedule "2026-04-10 10:00"
```

## 元数据约定

- `title`：作品标题（最多 30 字符）
- `description`：作品描述（默认同标题）
- `tags`：逗号分隔的话题列表

## cookie 持久化策略

- 路径：`$SOCIAL_PUBLISH_DATA_DIR/cookies/douyin/<account>.json`
- `upload` 为**有头**浏览器；若上传页需重新登录会**就地扫码**；成功后写回 `storageState`；`check` 为无头粗验（与实际上传页态可能不完全一致）

## 发布进度可视化协议

8 阶段：`INIT` → `COOKIE_CHECK` → `COOKIE_REFRESH` → `OPEN_PUBLISH_PAGE` → `UPLOAD_START` → `UPLOAD_TRANSFERRING` → `PUBLISHING` → `DONE`

## 参考文档

- `references/runtime-requirements.md`
- `references/cli-contract.md`
- `references/troubleshooting.md`
