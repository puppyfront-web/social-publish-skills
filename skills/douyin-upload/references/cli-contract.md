# 抖音 CLI 契约（本仓库引擎）

执行前在仓库根目录：`npm install`、`npx playwright install chromium`、`npm run build`。  
命令形式：`node dist/cli.js douyin <子命令>`（或 `npm run dev -- douyin …`）。

## check

```bash
node dist/cli.js douyin check --account <name>
```

- 退出码：`0` 且输出 `valid` 表示无头校验通过；否则 `invalid` 且非零退出码。

## login

```bash
node dist/cli.js douyin login --account <name> [--skip-verify]
```

- 弹出浏览器扫码；默认扫码成功后**轮询**登录态并保存 cookie（无需 Inspector Resume）。
- `SOCIAL_PUBLISH_LOGIN_STDIN=1`：改在终端按 Enter 结束。
- `SOCIAL_PUBLISH_LOGIN_NO_POLL=1`：关闭轮询，仅用 Inspector Resume。
- `--skip-verify`：保存后不跑无头 `check`。

## upload

```bash
node dist/cli.js douyin upload \
  --account <name> \
  --file <video-path> \
  --title "<title>" \
  [--desc "<description>"] \
  [--tags "话题1,话题2"] \
  [--schedule "YYYY-MM-DD HH:mm"]
```

- 上传为**有头浏览器**，便于观察流程；若上传页需重新登录会**就地扫码**后继续。
- `--schedule`：定时发布，格式 `YYYY-MM-DD HH:mm`（与实现一致）。
- 本引擎**未实现**：缩略图、商品链、图文笔记等（旧 `sau` 文档中的项不适用）。

## 环境变量（节选）

见仓库根目录 `README.md`：`SOCIAL_PUBLISH_DATA_DIR`、`SOCIAL_PUBLISH_CHROME_PATH` 等。
