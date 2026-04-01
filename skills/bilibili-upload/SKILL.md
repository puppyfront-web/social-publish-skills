---
name: bilibili-upload
description: 当 agent 需要编排 B 站视频上传、登录与校验流程时使用。本仓库为独立 social-publish-skills；B 站 TypeScript 适配器未实现，可参考 references/cli-contract.md 后续在 src/platforms/ 扩展（可能需交互式登录，与纯无头场景需区分）。
---

# Bilibili 上传 Skill

本仓库 **不绑定** 外部项目；目标形态为 **`social-publish bilibili ...`（规划中）**。

## 当前状态

引擎未实现；`references/cli-contract.md` 保留原 `sau bilibili` 语义作为**实现参考**。

## 模板

- `scripts/examples/bilibili_*`：命令拼接参考。

## 参考

- `references/runtime-requirements.md`
- `references/cli-contract.md`
- `references/troubleshooting.md`
