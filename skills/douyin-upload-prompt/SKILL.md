---
name: douyin-upload-prompt
description: 当用户上传抖音视频但未填写标题、简介或标签时，提供智能补全建议与默认值流程。属于独立仓库 social-publish-skills，与 douyin-upload skill 配合；实际 CLI 以本仓库 TypeScript 引擎为准（抖音适配器落地后对接 social-publish）。
---

# Douyin Upload Prompt Skill

**当用户未填写标题、简介、标签时，提供智能提示和默认值。**

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

用户只提供视频文件、未给标题时，由 Agent 生成建议文案，确认后再调用未来的 `social-publish douyin upload ...`（参数含 `--title`、`--desc`、`--tags`）。

## 配置

- `prompt_logic.py`：提示逻辑参考实现
- `templates/`：标题与标签模板 JSON

## 集成方式

在调用抖音发布 CLI **之前**插入本 skill：先补齐/确认元数据，再执行上传命令。