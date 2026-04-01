# 浏览器与 cookie 兼容策略

## 1) cookie 目录（本仓库引擎）

默认在 **`$SOCIAL_PUBLISH_DATA_DIR`**（未设置则为 `~/.social-publish-skills`）下：

- `cookies/tencent/<account>.json`
- 未来：`cookies/douyin/`、`cookies/kuaishou/` 等

使用 Playwright **`storageState`** JSON，与具体站点域名绑定；勿跨机器混用。

## 2) 生命周期

- 发布前：`tencent check` 或引擎内 `cookieAuth`
- 失效：`tencent login` 或发布流程内自动触发登录
- 发布后：写回同一 JSON

## 3) 有头 / 无头

- 默认无头：`SOCIAL_PUBLISH_HEADLESS` 未设为 `0`/`false`
- 登录：`tencent login` 固定有头 + Inspector

## 4) 安全

- cookie 文件加入 `.gitignore`（若放在仓库内）
- 日志勿打印 storageState 明文
