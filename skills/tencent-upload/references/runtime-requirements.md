# 运行前提

## 本仓库引擎

- Node.js ≥ 20
- 在 **social-publish-skills** 根目录执行 `npm install && npm run build`
- 安装浏览器：`npx playwright install chromium`

## 环境变量

- `SOCIAL_PUBLISH_DATA_DIR`：数据目录（默认 `~/.social-publish-skills`）
- `SOCIAL_PUBLISH_HEADLESS`：`0` / `false` 显示浏览器
- `SOCIAL_PUBLISH_CHROME_PATH`：可选，本机 Chrome 路径

## 登录说明

`tencent login` 使用有界面浏览器，并在 Playwright Inspector 中 **Resume** 后继续保存 cookie；请向用户说明需在窗口内完成微信扫码/登录。
