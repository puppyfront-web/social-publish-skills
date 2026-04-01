# runtime（已迁移）

原先计划放 Python 桥接脚本。**当前版本已改为纯 TypeScript 引擎**，实现位于仓库根目录的 `src/`。

- CLI：`npm run build` 后执行 `node dist/cli.js` 或 `npm run dev -- <args>`
- 视频号：`social-publish tencent check|login|upload`
- 批量：`social-publish orchestrate --config skills/multi-platform-publish-orchestrator/references/orchestrator.config.example.json`
