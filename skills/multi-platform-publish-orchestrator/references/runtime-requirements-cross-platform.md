# 跨平台运行前提（Linux / macOS / Windows）

## 1) Node.js 与构建

- Node **≥ 20**
- 在仓库根目录：`npm install && npm run build`
- 浏览器：`npx playwright install chromium`

## 2) 路径与子进程

- 使用绝对路径传视频文件，或在配置里写相对于**当前工作目录**的路径（引擎用 `path.resolve`）
- Windows 路径含空格时仍用 Node 内建参数列表，避免手工拼接引号

## 3) 全选快捷键

引擎内 `selectAllModifier()`：`Meta`（macOS）或 `Control`（Windows/Linux），用于时间输入等场景。

## 4) 可选系统 Chrome

设置 `SOCIAL_PUBLISH_CHROME_PATH` 指向本机 Chrome，部分视频编码场景更稳定。
