# 统一调度常见问题

## 1) `Unknown platform` / `尚未在本 TypeScript 引擎中实现`

当前仅 **tencent** 可走通；抖音/快手需实现对应 `src/platforms/*.ts` 并在 `orchestrator.ts` 注册。

## 2) Playwright 找不到浏览器

执行：`npx playwright install chromium`。

## 3) 视频号 cookie 一直 invalid

重新执行 `node dist/cli.js tencent login --account ...`，在浏览器与 Inspector 中完成登录后再 Resume。

## 4) 选择器失效

微信页面改版会导致 `src/platforms/tencent.ts` 内选择器失效，需按当前 DOM 更新（与其它自动化项目无关，自行维护）。
