# 统一调度契约

## 配置文件（JSON）

- `data_dir`（可选）：等价于设置环境变量 `SOCIAL_PUBLISH_DATA_DIR`
- `tasks`：数组，每项至少包含 `platform`、`account`、`title`。视频平台通常需要 `video_file`；文章平台需要 `source`；小红书图文需要 `images`

## 任务字段

| 字段 | 说明 |
| --- | --- |
| `platform` | `tencent` \| `douyin` \| `kuaishou` \| `xiaohongshu` \| `wechatmp` \| `zhihu` \| `baijiahao` |
| `account` | 账号别名，用于 cookie 文件名 |
| `video_file` | 视频路径，视频平台必填 |
| `images` | 图片路径数组，小红书图文必填 |
| `source` | Markdown 绝对路径 / GitHub URL / 网页 URL，图文平台必填 |
| `note` | 小红书图文正文，可选 |
| `source_type` | 可选，`auto` \| `markdown` \| `github` \| `url` |
| `title` | 标题 |
| `tags` | 可选，逗号分隔 |
| `schedule` | 可选，`YYYY-MM-DD HH:mm` |
| `category` | 可选，视频号原创类型 |
| `draft` | 可选，布尔，仅视频号 |
| `publish` | 可选，布尔，图文平台默认保存草稿 |

## 平台适配器（TypeScript）

每个平台在 `src/platforms/<name>.ts` 导出发布逻辑；调度器只负责顺序执行与统一进度语义。

## 幂等

- 失败重试前重新做 cookie 校验
- 同一账号并发写入同一 cookie 文件时应避免
