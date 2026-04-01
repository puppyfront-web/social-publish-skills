# 运行前提（快手）

本 skill 对应引擎为仓库内 **TypeScript + Playwright**（`src/platforms/kuaishou.ts`），**不依赖** `social-auto-upload` / `sau` / `patchright`。

## 必备

- Node.js **≥ 20**
- 仓库根目录执行：

```bash
npm install
npx playwright install chromium
npm run build
```

- CLI：`node dist/cli.js kuaishou check|login|upload …`（或 `npx social-publish kuaishou …` 若已 `npm link` / 全局安装本包）

## Cookie 目录

默认：`~/.social-publish-skills/cookies/kuaishou/<account>.json`  
可通过环境变量 `SOCIAL_PUBLISH_DATA_DIR` 改写数据根目录（见根目录 `README.md`）。

## 与旧文档的关系

若你看到基于 `sau kuaishou` / `--headless` 的说明，均为**历史第三方工具**约定；当前以本文件与 `cli-contract.md` 为准。
