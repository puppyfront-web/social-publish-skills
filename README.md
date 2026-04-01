# social-publish-skills

独立的 **Agent Skills** 集合 + **TypeScript 发布引擎**（Playwright）。  

版本见 `VERSION` 与 `package.json`。

**给其他用户**：本仓库**不提交** `dist/`。拉取后在本目录执行一次 `npm install`、`npx playwright install chromium`、`npm run build`，即可使用 `node dist/cli.js …` 或把 `skills/` 下的 `SKILL.md` 交给 Agent 引用（Agent 需在同一仓库根目录按上述命令构建后再调 CLI）。

## 功能状态

| 平台 | CLI 子命令 | TypeScript 引擎 |
| --- | --- | --- |
| 微信视频号 | `tencent` | 已实现（`src/platforms/tencent.ts`） |
| 抖音 | `douyin` | 已实现（`src/platforms/douyin.ts`） |
| 快手 | `kuaishou` | 已实现（`src/platforms/kuaishou.ts`） |
| 小红书 / B 站 | — | 未实现（占位，可扩展） |

每个平台均支持：cookie 校验、扫码登录、视频上传、定时发布、8 阶段进度输出。

**扫码登录默认验链路**：`tencent|douyin|kuaishou login` 在写入 `storageState` 后会自动再跑一次无头 `cookieAuth`（`douyin`/`kuaishou` 的 `login` 子命令在扫码阶段已支持**轮询**自动继续）；失败则进程退出码为 `1`。仅保存不校验可加 `--skip-verify`。

**三平台顺序验收**：`node dist/cli.js verify-scan-login --account my_account`（一般**不要**加 `PWDEBUG=1`：调试器会在 `goto` 之前就暂停，窗口会长时间停在 **about:blank**，需先在 Inspector 点一次 Resume 才会加载网址）。**抖音、快手**扫码后默认**轮询**登录成功并保存 cookie；**微信视频号**仍可能需在 Inspector 点 **Resume**，或统一用 `SOCIAL_PUBLISH_LOGIN_STDIN=1` 在终端按 **Enter**。

## 环境要求

- Node.js **≥ 20**
- 安装 Playwright 浏览器：`npx playwright install chromium`（首次部署执行一次即可）

## 安装与构建（必做）

```bash
cd /path/to/social-publish-skills
npm install
npx playwright install chromium   # 首次在本机部署执行一次
npm run build                     # 生成 dist/，之后才能 node dist/cli.js …
```

开发时可直接：

```bash
npm run dev -- douyin check --account my_account
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `SOCIAL_PUBLISH_DATA_DIR` | 数据根目录（默认 `~/.social-publish-skills`），其下 `cookies/<platform>/<account>.json` |
| `SOCIAL_PUBLISH_HEADLESS` | `0` / `false` 时有界面运行 |
| `SOCIAL_PUBLISH_CHROME_PATH` | 可选，指定本机 Chrome 可执行文件（部分编码场景更稳） |
| `SOCIAL_PUBLISH_LOGIN_STDIN` | 设为 `1` 时，登录完成后在**终端按 Enter** 保存 cookie（不依赖 Playwright Inspector） |
| `SOCIAL_PUBLISH_LOGIN_NO_POLL` | 设为 `1` 时，**抖音**登录关闭自动轮询，仅使用 Inspector Resume / 与未实现轮询的平台一致 |

## CLI 示例

```bash
# ─── 微信视频号 ───────────────────────────
node dist/cli.js tencent check  --account my_account
node dist/cli.js tencent login  --account my_account
node dist/cli.js tencent upload --account my_account --file ./a.mp4 --title "标题" --tags "标签1,标签2"

# ─── 抖音 ─────────────────────────────────
node dist/cli.js douyin check  --account my_account
node dist/cli.js douyin login  --account my_account
node dist/cli.js douyin upload --account my_account --file ./a.mp4 --title "标题" --desc "描述" --tags "话题1,话题2"

# ─── 快手 ─────────────────────────────────
node dist/cli.js kuaishou check  --account my_account
node dist/cli.js kuaishou login  --account my_account
node dist/cli.js kuaishou upload --account my_account --file ./a.mp4 --title "标题" --desc "描述" --tags "话题1,话题2"

# ─── 三平台扫码 → 存 cookie → 无头校验（交互）──
node dist/cli.js verify-scan-login --account my_account

# ─── 多平台批量发布 ─────────────────────────
node dist/cli.js orchestrate --config skills/multi-platform-publish-orchestrator/references/orchestrator.config.example.json
```

## Cookie 存储结构

```
~/.social-publish-skills/
  cookies/
    tencent/
      my_account.json
    douyin/
      my_account.json
    kuaishou/
      my_account.json
```

## Skills 目录

`skills/` 下为各平台与编排的 `SKILL.md`，供 Cursor / OpenClaw 等加载；执行时让 Agent 调用上述 **Node CLI**，勿再引用外部 Python 引擎。

## 许可证

MIT，见 `LICENSE`。
