# social-publish-skills

一个基于 TypeScript + Playwright 的短视频发布工具集，用于在本机完成扫码登录、登录态校验和视频上传。

目前支持的平台：

- 微信视频号 `tencent`
- 抖音 `douyin`
- 快手 `kuaishou`

暂不支持：

- 小红书
- B 站

## 适合什么场景

- 首次登录某个平台账号
- 检查本机已有 cookie 是否仍然可用
- 将一个视频发布到单个平台
- 按顺序将一个视频发布到多个平台

## 环境要求

- Node.js `>= 20`
- 本机可运行 Playwright Chromium

## 安装

首次使用时，在仓库根目录执行：

```bash
npm install
npx playwright install chromium
npm run build
```

说明：

- 仓库默认不提交 `dist/`
- 只有完成构建后，才能使用 `node dist/cli.js ...`

## 在 Agent 中接入

这个仓库既可以直接给人手动使用，也可以接入到 `Codex`、`Claude Code`、`OpenClaw` 这类 Agent 工作流中。

接入时建议统一遵循这几个原则：

- 所有命令都在仓库根目录执行
- 首次运行先完成 `npm install`、`npx playwright install chromium`、`npm run build`
- 发布视频时使用视频文件绝对路径
- 扫码登录必须在用户本机完成

### Codex

适合场景：

- 让 Codex 直接帮你执行登录、检查、上传、多平台发布
- 让 Codex 根据你的文案和视频路径直接调用 CLI

推荐接入方式：

- 让 Codex 在本仓库内工作
- 先读取根目录的 `AGENTS.md`
- 再按任务需要调用 `node dist/cli.js ...`

推荐提示方式：

```text
先阅读 AGENTS.md，并在仓库根目录执行命令。
如果 dist/cli.js 不存在，先安装依赖、安装 chromium 并构建。
然后使用 node dist/cli.js 完成登录 / 检查 / 上传。
```

### Claude Code

适合场景：

- 在本地终端中让 Claude Code 直接执行发布命令
- 把它作为“本地操作代理”来完成扫码登录和上传

推荐接入方式：

- 将仓库作为当前工作目录打开
- 明确要求它先阅读 `README.md` 和 `AGENTS.md`
- 所有平台操作统一走 `node dist/cli.js`

推荐提示方式：

```text
请先阅读 README.md 和 AGENTS.md。
所有 npm 和 node dist/cli.js 命令都在仓库根目录执行。
不要跳过登录，不要伪造 cookie，扫码步骤在本机完成。
```

### OpenClaw

适合场景：

- 把 `skills/` 下的平台能力作为可复用 Skill 接入
- 在自动化工作流中复用单平台上传或多平台编排能力

推荐接入方式：

- 将本仓库的 `skills/` 目录提供给 OpenClaw
- 让 Agent 按需读取对应平台的 `SKILL.md`
- 实际执行仍统一调用本仓库 CLI，而不是另写一套上传逻辑

常见映射关系：

- 视频号发布：`skills/tencent-upload/SKILL.md`
- 抖音发布：`skills/douyin-upload/SKILL.md`
- 快手发布：`skills/kuaishou-upload/SKILL.md`
- 多平台顺序发布：`skills/multi-platform-publish-orchestrator/SKILL.md`

### 推荐做法

如果你要把这个仓库接到任意 Agent 中，最稳妥的方式是：

1. 让 Agent 先读取 `AGENTS.md`
2. 让 Agent 在仓库根目录构建并执行 CLI
3. 需要单平台时直接调用对应子命令
4. 需要多平台时使用 `orchestrate --config ...`

## 使用流程

推荐按下面顺序使用。

### 1. 登录账号

首次使用某个平台，先扫码登录：

```bash
node dist/cli.js tencent login --account my_account
node dist/cli.js douyin login --account my_account
node dist/cli.js kuaishou login --account my_account
```

参数说明：

- `--account` 是你给这个账号起的别名
- 同一平台下，不同别名会保存为不同的 cookie 文件

### 2. 检查登录态

如果不确定 cookie 是否还有效，可以先检查：

```bash
node dist/cli.js tencent check --account my_account
node dist/cli.js douyin check --account my_account
node dist/cli.js kuaishou check --account my_account
```

### 3. 发布单个平台

#### 微信视频号

```bash
node dist/cli.js tencent upload \
  --account my_account \
  --file /absolute/path/to/video.mp4 \
  --title "标题" \
  --tags "标签1,标签2"
```

#### 抖音

```bash
node dist/cli.js douyin upload \
  --account my_account \
  --file /absolute/path/to/video.mp4 \
  --title "标题" \
  --desc "描述" \
  --tags "话题1,话题2"
```

#### 快手

```bash
node dist/cli.js kuaishou upload \
  --account my_account \
  --file /absolute/path/to/video.mp4 \
  --title "标题" \
  --desc "描述" \
  --tags "话题1,话题2"
```

### 4. 多平台顺序发布

复制并修改示例配置：

```bash
cp skills/multi-platform-publish-orchestrator/references/orchestrator.config.example.json ./orchestrator.config.json
```

然后执行：

```bash
node dist/cli.js orchestrate --config ./orchestrator.config.json
```

## 常用命令

```bash
node dist/cli.js <platform> login --account <name>
node dist/cli.js <platform> check --account <name>
node dist/cli.js <platform> upload [options]
node dist/cli.js orchestrate --config /absolute/path/to/config.json
```

`<platform>` 可选：

- `tencent`
- `douyin`
- `kuaishou`

## 常用参数

- `--account`：账号别名
- `--file`：视频绝对路径
- `--title`：标题
- `--desc`：描述，仅抖音和快手支持
- `--tags`：逗号分隔标签
- `--schedule`：定时发布时间，格式为 `YYYY-MM-DD HH:mm`

## 数据目录

默认数据目录：

```text
~/.social-publish-skills/
```

cookie 默认保存在：

```text
~/.social-publish-skills/cookies/<platform>/<account>.json
```

## 常用环境变量

- `SOCIAL_PUBLISH_DATA_DIR`：自定义数据目录
- `SOCIAL_PUBLISH_HEADLESS=0`：使用有界面浏览器运行
- `SOCIAL_PUBLISH_CHROME_PATH`：指定本机 Chrome 路径

## 开发调试

不经过构建直接运行：

```bash
npm run dev -- douyin check --account my_account
```

## 许可证

MIT
