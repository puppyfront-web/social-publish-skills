# INSTALL.md（LLM 安装与适配指南）

本文用于指导 LLM（Claude Code、Codex、OpenClaw）在本仓库中完成安装、初始化和运行适配。

## 1. 通用安装步骤（所有 Agent）

工作目录固定为：

```text
/Users/tutu/social-publish-skills
```

首次安装：

```bash
npm install
npx playwright install chromium
npm run build
```

验证：

```bash
node dist/cli.js --help
```

## 2. 通用适配规则（必须遵守）

1. 执行前先读取 `AGENTS.md`。
2. 所有 `npm` / `node dist/cli.js` 命令必须在仓库根目录执行。
3. 发布命令的本地文件路径必须是绝对路径（`--file`、`--images`、`--source`）。
4. 不读取、不泄露 `~/.social-publish-skills/cookies/` 下的 JSON 内容。
5. 不提交 `.env`。
6. 扫码登录必须在用户本机完成，不要伪造 cookie，不要跳过登录流程。

## 3. Claude Code 适配

建议启动后第一条任务提示：

```text
请先阅读 README.md 和 AGENTS.md，再执行命令。
所有操作在 /Users/tutu/social-publish-skills 根目录完成。
如果 dist/cli.js 不存在，请先 npm install、npx playwright install chromium、npm run build。
```

推荐执行模式：

- 登录：`node dist/cli.js <platform> login --account <name>`
- 检查：`node dist/cli.js <platform> check --account <name>`
- 发布：`node dist/cli.js <platform> upload|publish ...`
- 编排：`node dist/cli.js orchestrate --config <absolute-path>`

## 4. Codex 适配

建议给 Codex 的初始化 Prompt：

```text
你正在仓库 /Users/tutu/social-publish-skills 中工作。
先读取 AGENTS.md，然后按仓库规则执行命令。
统一使用 node dist/cli.js 作为入口；若 dist 缺失先构建。
所有本地文件参数必须是绝对路径；需要扫码时提示用户在本机完成。
```

Codex 执行时应优先遵循：

- 不要引入仓库外上传脚本
- 不要改业务逻辑去绕过登录
- 不要声称支持未实现平台（如 bilibili）

## 5. OpenClaw 适配

建议将本仓库 `skills/` 目录挂载为可发现技能目录，并让 Agent：

1. 先阅读目标 `skills/<platform>/SKILL.md`
2. 按文档参数调用 `node dist/cli.js ...`
3. 多平台任务统一使用 `orchestrate --config`

建议给 OpenClaw 的系统提示：

```text
Use /Users/tutu/social-publish-skills as the execution root.
Read AGENTS.md first.
Use node dist/cli.js as the only runtime entry.
Require absolute file paths for local media/article sources.
Never bypass QR login or fabricate cookies.
```

## 6. 常用命令速查

```bash
# 登录
node dist/cli.js tencent login --account my_account

# 检查 cookie
node dist/cli.js xiaohongshu check --account my_account

# 发布小红书视频
node dist/cli.js xiaohongshu upload-video --account my_account --file /absolute/path/video.mp4 --title "标题"

# 发布公众号文章（默认草稿）
node dist/cli.js wechatmp publish --account my_account --source /absolute/path/article.md --title "标题"

# 多平台编排
node dist/cli.js orchestrate --config /absolute/path/orchestrator.config.json
```

## 7. 故障排查

1. 找不到 `dist/cli.js`：重新执行安装与构建三步。
2. 登录态失效：先 `check`，再 `login`。
3. 上传异常：使用 `SOCIAL_PUBLISH_HEADLESS=0` 重试并观察页面。
4. 文章发布异常：确认 `--source` 为绝对路径或可访问 URL。
