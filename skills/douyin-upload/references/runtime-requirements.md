# 运行前提（抖音）

本 skill 对应引擎为仓库内 **TypeScript + Playwright**（`src/platforms/douyin.ts`），**不依赖** `social-auto-upload` / `sau` / `patchright`。

## 必备

- Node.js **≥ 20**
- 仓库根目录执行：

```bash
npm install
npx playwright install chromium
npm run build
```

- CLI：`node dist/cli.js douyin check|login|upload …`

## Cookie 目录

默认：`~/.social-publish-skills/cookies/douyin/<account>.json`  
可通过 `SOCIAL_PUBLISH_DATA_DIR` 改写（见根目录 `README.md`）。

## 与旧文档的关系

旧版 `sau` / `patchright` 安装说明已废弃；以本文件与 `cli-contract.md` 为准。
