# 快手 CLI 契约（本仓库引擎）

执行前在仓库根目录：`npm install`、`npx playwright install chromium`、`npm run build`。  
命令形式：`node dist/cli.js kuaishou <子命令>`（或 `npm run dev -- kuaishou …`）。

## check

```bash
node dist/cli.js kuaishou check --account <name>
```

- 退出码：`0` 且输出 `valid` 表示无头校验通过；否则 `invalid` 且非零退出码。

## login

```bash
node dist/cli.js kuaishou login --account <name> [--skip-verify]
```

- 打开 passport 登录页并展示二维码；默认扫码成功后**轮询** URL 回到 `cp.kuaishou.com` 即继续保存。
- `SOCIAL_PUBLISH_LOGIN_STDIN=1`：改在终端按 Enter 结束。
- `--skip-verify`：保存后不跑无头 `check`。

## upload

```bash
node dist/cli.js kuaishou upload \
  --account <name> \
  --file <video-path> \
  --title "<title>" \
  [--desc "<description>"] \
  [--tags "话题1,话题2,话题3"] \
  [--schedule "YYYY-MM-DD HH:mm"]
```

- **有头浏览器**；若上传页未登录（如出现「去上传」等），会跳转登录扫码后再回上传页。
- `tags` 最多 **3** 个话题（逗号分隔）。
- `--schedule`：定时发布。
- 本引擎**未实现**：`sau` 时代的图文、缩略图专用参数等。

## 环境变量（节选）

见仓库根目录 `README.md`。
