# 给 AI / LLM 的操作说明（本仓库）

你是自动化助手时，请**先读本文件再执行命令**。详细人类文档见 `README.md`；各平台语义与边界见 `skills/<平台>/SKILL.md` 与 `references/`。

## 你必须遵守

1. **工作目录**：所有 `npm` / `node dist/cli.js` 命令在**本仓库根目录**执行（与 `package.json` 同级）。
2. **构建优先**：若不存在 `dist/cli.js`，先执行：`npm install`、`npx playwright install chromium`、`npm run build`。不要假设上游已提交 `dist/`。
3. **路径**：`--file` 使用用户提供的**绝对路径**；JSON 配置里的 `video_file` 也使用绝对路径。微信公众号 `publish --source` 若是本地 Markdown，也必须是绝对路径。
4. **隐私**：勿将 `~/.social-publish-skills/cookies/` 下任何 JSON 读入对话全文或写入仓库；勿提交 `.env`。
5. **真实环境**：需要扫码或浏览器时，在**用户本机**运行 CLI；你侧沙箱无法代替用户完成扫码。

## 统一入口

```text
node dist/cli.js <tencent|douyin|kuaishou> <check|login|upload> [选项]
node dist/cli.js wechatmp <check|login|publish> [选项]
```

开发调试用：`npm run dev -- <同上参数>`（无需先 build）。

## 按任务执行

| 用户意图 | 推荐动作 |
|----------|----------|
| 首次或换账号登录 | `node dist/cli.js <平台> login --account <别名>` |
| 检查 cookie | `node dist/cli.js <平台> check --account <别名>` |
| 发一个视频 | `node dist/cli.js <平台> upload --account <别名> --file <绝对路径> --title "..."` |
| 发公众号图文 | `node dist/cli.js wechatmp publish --account <别名> --source <绝对路径或URL> --title "..."` |
| 多平台顺序发 | 复制并编辑 `skills/multi-platform-publish-orchestrator/references/orchestrator.config.example.json`（支持 `tencent/douyin/kuaishou/wechatmp` 混排），再 `node dist/cli.js orchestrate --config <该文件路径>` |
| 三站各登录一遍验收 | `node dist/cli.js verify-scan-login --account <别名>` |

## 平台差异（易错）

- **微信视频号 `tencent`**：`upload` 有 `--tags`，**无** `--desc`。建议 `SOCIAL_PUBLISH_HEADLESS=0` 便于排错；登录后常需 Inspector **Resume** 或 `SOCIAL_PUBLISH_LOGIN_STDIN=1`。
- **抖音 `douyin`**：`upload` 有 `--desc`、`--tags`；标题约 **30 字**内；`login` / 上传页内登录默认**轮询**扫码成功，一般不必点 Resume。可选 `SOCIAL_PUBLISH_LOGIN_NO_POLL=1` 关闭轮询。
- **快手 `kuaishou`**：`--tags` 最多 **3** 个话题；`login` 与 `upload` 内登录支持轮询；未登录上传页可能出现「去上传」，引擎会跳转扫码。
- **微信公众号 `wechatmp`**：`publish` 支持 `--source-type auto|markdown|github|url`。默认点击“保存草稿”；只有显式传 `--publish` 才会尝试发布。首版建议 `SOCIAL_PUBLISH_HEADLESS=0` 便于观察编辑器行为。

## 环境变量（常用）

- `SOCIAL_PUBLISH_DATA_DIR`：cookie 根目录（默认 `~/.social-publish-skills`）。
- `SOCIAL_PUBLISH_HEADLESS=0`：有头浏览器（上传/登录调试）。
- `SOCIAL_PUBLISH_CHROME_PATH`：可选，指定本机 Chrome 可执行文件。
- `SOCIAL_PUBLISH_LOGIN_STDIN=1`：登录完成后在终端按 Enter，代替 Inspector。
- `SOCIAL_PUBLISH_LOGIN_NO_POLL=1`：仅影响**抖音** `login` 的自动轮询。

## 失败时

1. 确认已 `npm run build` 且 `npx playwright install chromium` 已执行。
2. 上传失败：用 `SOCIAL_PUBLISH_HEADLESS=0` 重试；按提示重新 `login`。
3. 不要改业务逻辑去「跳过登录」或硬编码用户 cookie。

## 未实现

`skills/bilibili-upload`、`skills/xiaohongshu-upload` 等为占位，**不要**对用户声称本仓库 CLI 已支持 B 站/小红书上传。
