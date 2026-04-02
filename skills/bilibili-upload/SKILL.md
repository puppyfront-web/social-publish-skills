---
name: bilibili-upload
description: 当 agent 需要编排 B 站视频上传、登录与校验流程时使用。本仓库为独立 social-publish-skills；B 站 TypeScript 适配器未实现，可参考 references/cli-contract.md 后续在 src/platforms/ 扩展（可能需交互式登录，与纯无头场景需区分）。
---

# Bilibili 上传 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录直接执行命令，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter）才请求用户介入。
- 若能力未实现，Agent 应明确告知“当前仓库未实现”，并给出可执行替代方案；不要让用户尝试不存在的命令。

## 标准执行模板（未实现能力处理）

1. 先判断当前仓库是否存在 `bilibili` 可执行子命令。
2. 若不存在，立即告知未实现状态，并给出替代路径（例如先使用已实现平台或进入实现任务）。
3. 不向用户下发不存在的命令，不让用户手动试错。

## 当前状态

引擎未实现；`references/cli-contract.md` 保留历史语义作为**实现参考**，不代表当前可直接执行。

## 模板

- `scripts/examples/bilibili_*`：命令拼接参考。

## 参考

- `references/runtime-requirements.md`
- `references/cli-contract.md`
- `references/troubleshooting.md`
