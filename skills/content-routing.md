# 内容技能路由总览（拿不准用哪个技能时，先看这个）

> 内容类技能共 6 个：增长三件套（链路）+ 内容工具包（单点）+ 知识库（地基），外加发布前补全助手。各技能的 description 有重叠触发区，**首次分流以本文档为准**，进入技能后以其内部路由表为准。

## 一句话分工

| 诉求 | 技能 |
|---|---|
| **做什么**（选题 / 定位 / 对标 / 投流策略） | `growth-content-strategy` |
| **怎么写**（标题 / 正文 / 口播 / 仿写） | `growth-content-writing` |
| **写完怎么优化与运营**（润色 / 互动 / 发布时间 / 单条数据复盘 / 周期账号复盘） | `growth-content-ops` |
| **给一条内容要结构化产出**（拆结构 / 挖模板 / 去 AI 味） | `content-toolkit` |
| **给一批拆解结论要共性规律 / 建模板库** | `content-toolkit/references/pattern-synthesis` |
| **让 AI 记住私有资料**（品牌 / 行业 / 爆款 / 对标 / 模板库） | `personal-knowledge-wiki` |
| **抖音发布前补齐标题/简介/标签** | `douyin-upload-prompt` |
| **执行发布**（单平台 / 多平台分发） | 各平台 skill + `multi-platform-publish-orchestrator` |

## 决策树

```text
用户诉求
├─ 还不知道做什么内容 / 找选题 / 定位
│   ├─ 拆整个对标账号（账号级）      → growth-content-strategy/references/benchmark-analysis
│   ├─ 拆单条爆款（单条级）          → content-toolkit/references/competitor-pattern-mining
│   └─ 其余（选题 / 定位 / 投流）    → growth-content-strategy
├─ 选题定了，要拿对标爆款建确定性（爆款流水线）
│   ├─ 采集爆款素材                  → 人工投喂链接 + 转写（CLI collect 为规划能力，未实现前不声称支持）
│   ├─ 逐条拆解（≥3 条）            → content-toolkit/references/competitor-pattern-mining
│   └─ 拆完一批提炼共性 / 建模板     → content-toolkit/references/pattern-synthesis（模板入 templates-wiki）
├─ 要写内容
│   ├─ 从零创作                      → growth-content-writing（先定 goal，再按 goal 从 templates-wiki 选模板）
│   ├─ 拿竞品转写仿写                → content-toolkit 拆框架 → growth-content-writing 仿写
│   └─ 写出来 AI 味重                → content-toolkit/references/de-ai-rewrite
├─ 内容已有，要加工
│   ├─ 润色 / 结构 / 情绪优化        → growth-content-ops/references/optimize-rewrite
│   ├─ 分析这条视频是怎么写的        → content-toolkit/references/video-structure-analysis
│   ├─ 评论区互动 / 发布时间         → growth-content-ops
│   ├─ 复盘某条已发布内容的表现      → growth-content-ops/references/retrospective-scorecard（按 goal 加权八维）
│   └─ 周/月账号复盘、下期怎么调     → growth-content-ops/references/periodic-review（六维盘点+行动项回写）
├─ 沉淀或引用私有资料                → personal-knowledge-wiki
└─ 要发布
    ├─ 抖音上传但缺标题/简介/标签    → douyin-upload-prompt（从零写文案则先去 growth-content-writing）
    └─ 执行上传 / 多平台分发         → multi-platform-publish-orchestrator
        （创作终稿的交接格式见其 references/content-package.md）
```

## 易混淆场景对照

| 用户原话 | 首选动作 |
|---|---|
| “帮我拆解这条爆款” | 先问清要「标注结构」还是「挖可复用模板」——前者 `content-toolkit/video-structure-analysis`，后者 `content-toolkit/competitor-pattern-mining` |
| “帮我拆解这个博主” | `growth-content-strategy`（账号级拆解在战略层） |
| “帮我优化这段文案” | `growth-content-ops/optimize-rewrite`；核心诉求是“像 AI 写的”则转 `content-toolkit/de-ai-rewrite` |
| “帮我改改这段” | `growth-content-ops`（优化不是重写） |
| “帮我写个文案” | `growth-content-writing` |
| “把这些资料整理成库” | `personal-knowledge-wiki` |

## 链路全景

```text
选题（strategy）→ 对标采集/逐条拆解（toolkit）→ 共性提炼（pattern-synthesis）→ 模板库（templates-wiki）
      ↑                                                                            ↓
      │                                              创作（writing：先定 goal，套用已验证模板）→ 优化（ops）
      │                                                                            ↓
      └── 回流反哺（规律 / 模板验证排序） ← hits-wiki（wiki）←────────────────── 发布（orchestrator）
                         ↑
     知识地基：wiki 挂载到三件套与 toolkit（brand/industry/hits/benchmarks/templates 五库）
```

创作→发布的交接格式：`multi-platform-publish-orchestrator/references/content-package.md`（内容包，含 goal 与 used_templates 回流字段）。
