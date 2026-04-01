# 故障排查（抖音 · 本仓库引擎）

## 命令找不到 / 未生成 dist

在仓库根目录执行：

```bash
npm install
npx playwright install chromium
npm run build
```

使用：`node dist/cli.js douyin --help`（或 `npm run dev -- douyin --help`）。

## cookie 无效或上传页仍要登录

```bash
node dist/cli.js douyin check --account <account>
```

`invalid` 时重新登录：

```bash
node dist/cli.js douyin login --account <account>
```

`upload` 若仍弹出登录，按页面扫码即可；引擎会轮询成功后继续（见主 `SKILL.md`）。

## 二维码 / 浏览器

- `login` / `upload` 内登录默认**弹出浏览器**展示二维码，无需终端图片。
- 若要用终端结束登录流程：`SOCIAL_PUBLISH_LOGIN_STDIN=1`。
- 若需关闭抖音扫码轮询、改用手动 Resume：`SOCIAL_PUBLISH_LOGIN_NO_POLL=1`。

## 上传参数

视频上传最少：`--account`、`--file`、`--title`；可选 `--desc`、`--tags`、`--schedule`。

定时格式：`YYYY-MM-DD HH:mm`（与 CLI 解析一致）。

## 未实现能力

图文笔记、商品链、自定义缩略图等不在当前 `douyin upload` 范围内；勿按旧 `sau` 文档调用。
