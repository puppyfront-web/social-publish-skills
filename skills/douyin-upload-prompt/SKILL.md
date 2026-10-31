---
name: douyin-upload-prompt
description: 抖音发布前的最后一步补全：当用户上传抖音视频但未填写标题、简介或标签时，基于模板给出智能建议与默认值，用户确认后交给发布 CLI。只做元数据补全，不做完整创作——从零写文案去 growth-content-writing，执行上传去 douyin-upload。
---

# Douyin Upload Prompt Skill

**当用户未填写标题、简介、标签时，提供智能提示和默认值。**

## Agent 执行规则（重要）

- 默认由 Agent 在仓库根目录直接执行命令，不要让用户手动复制粘贴命令。
- 只有在必须人工完成的步骤（扫码、短信验证码、账号确认、终端按 Enter）才请求用户介入。
- 文案补全完成并经用户确认后，Agent 继续直接执行 `node dist/cli.js douyin upload ...`。

## 标准执行模板（全自动优先）

1. 先检查标题、简介、标签缺失项并生成候选文案。
2. 请求用户只对文案内容进行确认或微调（不要求用户执行命令）。
3. 文案确认后，Agent 自动执行 `node dist/cli.js douyin upload ...`。
4. 仅在扫码或显式人工确认时暂停并请求用户操作；完成后由 Agent 继续后续步骤。

## 功能
1. **输入检查**：检查标题、简介、标签是否为空
2. **智能建议**：基于视频内容生成建议
3. **默认值提供**：提供合理的默认值
4. **用户确认**：等待用户确认或修改

## 使用场景
- 用户上传视频但未填写标题
- 用户未填写简介或标签
- 需要AI辅助生成内容

## 工作流程
1. 检查用户输入
2. 如果为空，生成建议
3. 显示建议并等待用户确认
4. 使用确认后的值执行上传

## 示例

用户只提供视频文件、未给标题时，由 Agent 生成建议文案，确认后再调用 `node dist/cli.js douyin upload ...`（参数含 `--title`、`--desc`、`--tags`）。

## 配置

- `templates/`：标题与标签模板 JSON（`title_templates.json` / `hashtag_suggestions.json`）

## 与其他技能的边界

- 本技能只做**发布前的元数据补全**（标题/简介/标签缺失时的快速建议）；完整创作（标题公式、正文、平台调性）去 `growth-content-writing`。
- 补全确认后交给 `douyin-upload` 执行上传；多平台分发用 `multi-platform-publish-orchestrator`（创作终稿的标准交接格式见其 `references/content-package.md`）。
- 拿不准用哪个内容技能时，先看 `skills/content-routing.md`（路由总览）。

## 集成方式

在调用抖音发布 CLI **之前**插入本 skill：先补齐/确认元数据，再执行上传命令。