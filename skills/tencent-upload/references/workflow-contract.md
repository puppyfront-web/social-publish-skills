# 视频号工作流契约（TypeScript 引擎）

实现文件：`src/platforms/tencent.ts`。

## CLI 映射

| 步骤 | 命令 |
| --- | --- |
| 校验 | `node dist/cli.js tencent check --account <name>` |
| 登录 | `node dist/cli.js tencent login --account <name>` |
| 发布 | `node dist/cli.js tencent upload --account <name> --file <path> --title <t> [--tags a,b] [--schedule "YYYY-MM-DD HH:mm"] [--draft] [--category]` |

## 参数约定

- `title`：标题
- `tags`：逗号分隔
- `schedule`：可选，定时发布时间
- `draft`：存草稿
- `category`：原创类型文案（可选，与页面下拉匹配）

## 幂等与安全

- 多账号使用不同 `--account` 名，避免覆盖 cookie 文件
- 勿将 cookie JSON 提交到版本库
