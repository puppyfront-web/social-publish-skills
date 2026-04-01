# 故障排查（快手 · 本仓库引擎）

## 命令找不到 / 未生成 dist

在仓库根目录执行：

```bash
npm install
npx playwright install chromium
npm run build
```

使用：`node dist/cli.js kuaishou --help`（或 `npm run dev -- kuaishou --help`）。

## cookie 无效或上传页只有「去上传」

```bash
node dist/cli.js kuaishou check --account <account>
```

`invalid` 或上传流程中提示需登录时：

```bash
node dist/cli.js kuaishou login --account <account>
```

`upload` 会自动检测未登录并跳转扫码；成功后继续上传。

## 二维码 / 浏览器

- `login` 与 `upload` 内登录均为**有头**浏览器展示二维码。
- 扫码成功后引擎**轮询** URL 回到创作者域；也可用 `SOCIAL_PUBLISH_LOGIN_STDIN=1` 改为终端按 Enter。

## 上传参数

最少：`--account`、`--file`、`--title`；可选 `--desc`、`--tags`（最多 3 个话题）、`--schedule`。

定时格式：`YYYY-MM-DD HH:mm`。

## 未实现能力

图文、多图笔记等不在当前 `kuaishou upload` 范围内；勿按旧 `sau` 文档调用。
