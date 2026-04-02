---
name: xiaohongshu-upload
description: 当 agent 需要编排小红书登录、cookie、视频或图文发布时使用。本仓库为独立 social-publish-skills；小红书 TypeScript 适配器未实现，可参考 references/cli-contract.md 扩展。
---

# 小红书上传 Skill

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录直接执行命令，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter）才请求用户介入。
- 若能力未实现，Agent 应明确告知“当前仓库未实现”，并给出可执行替代方案；不要让用户尝试不存在的命令。

## 标准执行模板（未实现能力处理）

1. 先判断当前仓库是否存在 `xiaohongshu` 可执行子命令。
2. 若不存在，立即告知未实现状态，并给出替代路径（例如先使用已实现平台或进入实现任务）。
3. 不向用户下发不存在的命令，不让用户手动试错。

## 当前状态

占位；当前仓库未实现 `xiaohongshu` CLI 子命令。实现可参考 `references/cli-contract.md` 中的参数约定。

## 模板

- `scripts/examples/xiaohongshu_*`：参考用命令模板。

## 参考

- `references/runtime-requirements.md`
- `references/cli-contract.md`
- `references/troubleshooting.md`
