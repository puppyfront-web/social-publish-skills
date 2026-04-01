# 视频号故障排查（TypeScript 引擎）

## 1) `SOCIAL_AUTO_UPLOAD_HOME` / 外部引擎

本仓库 **不再使用** 任何外部引擎变量；仅需 Node、Playwright 与可选 `SOCIAL_PUBLISH_*` 环境变量（见 `runtime-requirements.md`）。

## 2) 浏览器未安装

```bash
npx playwright install chromium
```

## 3) 登录后仍 invalid

确认 `tencent login` 在 Inspector 中已 **Resume**；cookie 写入路径为 `$SOCIAL_PUBLISH_DATA_DIR/cookies/tencent/<account>.json`。

## 4) 页面改版

更新 `src/platforms/tencent.ts` 中的选择器与交互顺序。

## 5) macOS / Windows 快捷键

时间输入依赖 `Meta+A` / `Control+A`，由 `selectAllModifier()` 自动选择。
