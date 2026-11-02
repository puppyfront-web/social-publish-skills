# 内容包（Content Package）标准格式

> 创作技能（`growth-content-writing` / `growth-content-ops` / `content-toolkit`）与发布引擎（`orchestrate` / 各平台 CLI）之间的**交接契约**：创作侧按本格式交付终稿，发布侧按映射表机械消费，不再人工转抄字段。

## 为什么需要内容包

创作产出（标题/正文/标签）和发布配置（orchestrator JSON / CLI 参数）此前没有格式约定，交接靠人工复制粘贴，容易丢字段、错平台。内容包 = **一个带 frontmatter 的 Markdown 文件**，同时满足三方需求：

- **图文平台**（wechatmp / zhihu / baijiahao）：文件本身就是 `--source` 的 Markdown 正文
- **视频平台**（tencent / douyin / kuaishou / xiaohongshu）：frontmatter 机械映射为发布任务字段
- **知识库**：`wiki_refs` 记录引用来源，发布成功后回流 `hits-wiki`（见文末）

## 格式定义

```markdown
---
title: 标题
goal: 引流                   # 获客|引流|涨粉信任|转化|测试（创作前必答，见 growth-content-writing「内容目标」）
desc: 视频平台的作品描述/口播摘要（缺省同 title）
note: 小红书图文正文（缺省同 title；图文正文也可直接写在 body）
tags: [话题一, 话题二]
platforms: [douyin, kuaishou, xiaohongshu]
schedule: ""            # "YYYY-MM-DD HH:mm"，留空立即发布
draft: false            # 仅小红书生效（true=存草稿不发布）
media:                  # 媒体文件绝对路径：视频 1 个 / 图文 1~N 张
  - E:/videos/demo.mp4
source_skill: growth-content-writing
used_templates: []       # 本次套用的模板页，如 ["[[templates-wiki/痛点开场-反转故事-评论引导]]"]
wiki_refs: []           # 本次创作引用的 wiki 页面，如 ["[[品牌话术]]"]
---

正文（口播稿 / 图文正文 / 文章）。发布到图文平台时，直接发布这一段。
```

除 `title` 外字段均可省略，缺省按注释规则回退。

## 字段 → 各平台任务映射

| 内容包字段 | tencent | douyin | kuaishou | 小红书视频 | 小红书图文 | wechatmp / zhihu / baijiahao |
|---|---|---|---|---|---|---|
| `title` | `title` | `title`（≤30 字） | `title` | `title` | `title` | `title` |
| `desc` | 不支持（无 `--desc`） | `description` | `description` | `description` | — | — |
| `note` | — | — | — | — | `note` | —（用 body） |
| `tags` | `tags` | `tags` | `tags`（≤3 个） | `tags` | `tags` | — |
| `schedule` | `schedule` | `schedule` | `schedule` | `schedule` | `schedule` | — |
| `draft` | — | — | — | `draft` | `draft` | 语义相反：图文默认存草稿，显式 `--publish` 才发布 |
| `media`（视频 1 个） | `video_file` | `video_file` | `video_file` | `video_file` | —（用 `images`） | — |
| `media`（图片 N 张） | — | — | — | — | `images` | — |
| body 正文 | — | — | — | — | — | 内容包文件直接作 `source`（`source_type: markdown`） |

> 注意字段名差异：表中的 `description` 是 **orchestrator task JSON 字段名**；单平台 CLI 直发时参数名以 `node dist/cli.js <平台> <命令> --help` 为准（如抖音/快手/小红书均为 `--desc`）。

`goal` / `used_templates` / `wiki_refs` / `source_skill` 不映射为发布参数——它们是回流字段，供发布后按 goal 选指标复盘、回填模板验证记录使用（见 `personal-knowledge-wiki/references/wiki-maintenance.md` 的「发布回流」）。

平台细节与易错点（标题字数上限、话题个数上限、账号参数）以仓库根 `AGENTS.md` 与各平台 skill 文档为准。

## 使用流程

1. **创作侧交付**：`growth-content-writing` / `growth-content-ops` 定稿后，按本格式落成 `content-<主题>.md`（放用户指定目录，使用绝对路径），一次交付、多处消费。
2. **单平台发布**：Agent 按映射表把字段转成对应平台 CLI 参数执行。
3. **多平台发布**：Agent 按映射表把内容包转成 `orchestrator.config.json` 的 `tasks[]`（每个目标平台一条任务），`media` 填入对应媒体字段。
4. **发布后回流**：发布成功后 CLI 会输出回流提示——按 `personal-knowledge-wiki/references/wiki-maintenance.md` 的「发布回流」一节，在 `hits-wiki/own/` 建占位条目（`goal` 从内容包带入条目的 `goal_type`），表现数据出来后回填；若内容包声明了 `used_templates`，同步给对应模板页 `usage_count +1` 并回填验证记录。

## 一稿多变体（多平台适配）

`platforms` 含多个平台时**不允许同稿直发**——先按 `growth-content-writing` 的「平台差异化调性表」逐平台改写标题与正文变体（如小红书口语化+emoji 个人化、公众号深度长文、抖音前 5 秒钩子）。变体写进 `variants`，优先级高于顶层字段：

```yaml
variants:
  douyin:
    title: 抖音版标题（30 字内）
    desc: 抖音版描述
  xiaohongshu:
    title: 小红书版标题（20 字内）
    note: 小红书版正文
```
