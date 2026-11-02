# 内容创作知识库 Schema 模板

> 开箱即用的 5 类 wiki Schema。每类含：目录结构、单页 Schema（frontmatter 字段）、示例条目。

## 通用约定

所有 wiki 页面都用 Markdown + YAML frontmatter。frontmatter 字段分两类：
- **必填**：缺失则 lint 不通过
- **可选**：有就填，没有不强求

所有 wiki 页面遵循 `wiki-maintenance.md` 的四阶段流程和 lint 清单。

---

## 1. 品牌资料库 `brand-wiki/`

**用途**：沉淀品牌自有资产，让 AI 创作时能准确引用品牌话术、产品卖点、视觉规范、人设定位。

### 目录结构
```
brand-wiki/
├── _index.md                # 品牌总览（一句话定位、核心标签、目标人群）
├── brand-story.md           # 品牌故事
├── products/                # 产品矩阵（每个产品一个文件）
├── voice-and-tone.md        # 话术与人设（语调、口头禅、禁忌词）
├── visual-guide.md          # 视觉规范（配色、字体、封面风格）
└── persona.md               # 账号人设定位
```

### 单页 Schema

**`_index.md`（品牌总览，必填）**
```yaml
---
type: brand-index
brand_name: <品牌名>
one_liner: <一句话定位>          # 必填
core_tags: [<标签1>, <标签2>]    # 必填，3-5 个
target_audience: <目标人群>
updated: YYYY-MM-DD
source: <来源>
---
```

**产品页 `products/<产品名>.md`**
```yaml
---
type: product
name: <产品名>
category: <品类>
positioning: <定位>             # 必填：一句话说清卖给谁、解决什么
selling_points:                 # 必填：3-5 个核心卖点
  - <卖点1>
  - <卖点2>
price_range: <价格区间>
differentiator: <与竞品的差异>   # 必填
forbidden_claims: [<不能说的话>]  # 合规/法务限制
updated: YYYY-MM-DD
source: <来源>
---
```

**话术与人设页 `voice-and-tone.md`（去 AI 味的锚点库）**
```yaml
---
type: voice
owner: <谁的声线（个人/品牌名）>
samples:                        # 必填：本人真实文案 ≥5 条（原创，非 AI 生成）
  - |
    <一段本人写的真实文案/口播/朋友圈>
catchphrases: [<固定口头禅>]     # 高频词与句式惯性
never_use: [<从不用的词>]        # 负面清单：本人反感/从不使用的表达
emoji_profile:                  # emoji 个人化画像（去 AI 味依据）
  frequency: 少|中|多
  favorites: [<惯用的那几款>]
  position: <通常出现的位置，如"只在情绪点">
quirks: <系统性偏差：爱跑的题/过度展开的话题/句长习惯>   # 个性=对个体的过拟合，写具体。注意：仅供改写时校对参考，不要求每篇展示，更禁止为表现 quirks 编造事件（见 de-ai-rewrite 硬约束）
updated: YYYY-MM-DD
source: <样本来源：本人提供/历史作品摘录>
---
```

**使用约定**：`content-toolkit/de-ai-rewrite` 改写时**必须先读本页**——有 `samples` 走"个体版"改写，没有则提示用户先建本页。`samples` 只收本人真实表达，不收 AI 生成内容（否则锚定的还是 AI 均值）。

### 示例条目（`products/轻食代餐奶昔.md`）
```yaml
---
type: product
name: 轻食代餐奶昔
category: 代餐/健康食品
positioning: 卖给 25-35 岁想控卡但没时间做饭的职场女性，一瓶替代一顿正餐
selling_points:
  - 一瓶仅 150 大卡，相当于一顿正餐的 1/5
  - 含 15g 植物蛋白，扛饿 4 小时
  - 冷水即溶，不用摇摇杯
price_range: 39-49 元/盒（6 瓶）
differentiator: 同价位里唯一用赤藓糖醇（不加蔗糖），口感不假甜
forbidden_claims: ["不能说'减肥'", "不能说'治疗'"]
updated: 2026-07-04
source: 对话（创始人访谈）
---

# 轻食代餐奶昔

## 卖点展开
（正文详细描述每个卖点的论据、适用场景）

## 适合的创作选题
- [[hits-wiki/职场女性控卡系列]]
- 职场午餐替代场景
```

---

## 2. 行业语料库 `industry-wiki/`

**用途**：沉淀行业通用知识（术语、痛点、数据源、竞品动态），让 AI 创作时言之有物、不外行。

### 目录结构
```
industry-wiki/
├── _index.md                # 行业总览
├── glossary/                # 行业术语表（每个术语一个文件）
├── pain-points/             # 用户痛点库
├── data-sources.md          # 权威数据源清单
└── competitor-moves/        # 竞品动态（每次重要动作一个文件）
```

### 单页 Schema

**术语页 `glossary/<术语>.md`**
```yaml
---
type: glossary
term: <术语>
plain_explanation: <一句话大白话解释>   # 必填：给外行听懂的版本
pro_explanation: <专业解释>
related_terms: [[<相关术语>]]
common_misuse: <常见误用>
updated: YYYY-MM-DD
source: <来源>
---
```

**痛点页 `pain-points/<痛点名>.md`**
```yaml
---
type: pain-point
pain: <痛点一句话>              # 必填
audience: <谁有这个痛点>
trigger_scenario: <什么场景下发作>  # 必填
intensity: high|medium|low
existing_solutions: [<现有解法>]
gap: <现有解法的不足>            # 必填：机会点在哪
evidence: <依据：数据/案例/引用>
updated: YYYY-MM-DD
source: <来源>
---
```

### 示例条目（`pain-points/职场妈妈没时间运动.md`）
```yaml
---
type: pain-point
pain: 想运动但孩子醒着的时间根本抽不出整块时间
audience: 25-40 岁有娃职场女性
trigger_scenario: 晚上哄睡后已 10 点，健身房早关门，在家练又怕吵醒孩子
intensity: high
existing_solutions: ["午休快走", "早起半小时", "碎片化训练 App"]
gap: 现有方案要么要求整块时间（午休/早起），要么没考虑"安静"约束
evidence: 小红书"职场妈妈 运动"话题 2.3 万篇笔记，高频吐槽"没时间""吵"
updated: 2026-07-04
source: 小红书话题调研
---
```

---

## 3. 历史爆款库 `hits-wiki/`

**用途**：沉淀自己/对标账号的已验证爆款，附结构拆解结论。这是"找到确定性 → 放大确定性"的素材池。

**联动**：与 `content-toolkit/competitor-pattern-mining` 和 `content-toolkit/video-structure-analysis` 的产出强联动——拆解结论直接填入本库。

### 目录结构
```
hits-wiki/
├── _index.md                # 爆款总览 + 共性规律提炼（规律区按 goal 分区）
├── own/                     # 自己账号的爆款
└── benchmark/               # 对标账号的爆款
```

### 单页 Schema

**爆款页 `own|benchmark/<标题简写>.md`**
```yaml
---
type: hit
title: <原标题>
author: <作者/账号>
platform: douyin|xiaohongshu|kuaishou|...
goal_type: <获客|引流|涨粉信任|转化|测试|unknown>   # 该条内容的目标；own 条目从内容包 goal 带入，benchmark 条目按 CTA 落点推断并注明
published: YYYY-MM-DD
metrics:                       # 必填：至少 1 个核心指标
  views: <播放量>
  likes: <点赞>
  comments: <评论>
  shares: <分享>
duration: <时长秒数，视频类填>
transcript_source: <转写来自哪：自转写/工具/手抄>
used_template: <套用的模板页双链，如 "[[templates-wiki/某模板]]">   # own 条目从内容包 used_templates 带入（单模板时）；模板验证回填靠它定位
hook_type: <钩子类型：反差/冲突/利益/痛点/悬念>   # 必填，联动 video-structure-analysis
structure_formula: <结构公式一句话>    # 必填，联动 competitor-pattern-mining
why_it_worked: <为什么爆：一句话>      # 必填
reusable_template: <可复用模板描述>    # 必填
transcript: |
  <完整或摘要转写>
analysis_source: <拆解来自哪条 skill 产出>
updated: YYYY-MM-DD
source: <链接或采集方式>
---
```

### 示例条目（`benchmark/职场妈妈代餐.md`）
```yaml
---
type: hit
title: 当妈后我怎么瘦的｜职场妈妈代餐实测
author: @某某妈妈
platform: xiaohongshu
goal_type: 转化   # 推断依据：结尾直接挂车引导下单
published: 2026-06-15
metrics:
  likes: 4.2万
  comments: 1832
  shares: 5600
duration: 45
hook_type: 痛点
structure_formula: 痛点共鸣(5s) → 个人反转故事(15s) → 产品植入(15s) → 评论区互动(10s)
why_it_worked: 精准踩中"职场妈妈没时间"痛点 + 真人实测感强
reusable_template: 痛点开场 → "我也是这样" → "直到我用了X" → 引导评论"你们都怎么解决的"
transcript: |
  当妈第三年我终于找到能好好吃饭的办法了...
analysis_source: content-toolkit/competitor-pattern-mining
updated: 2026-07-04
source: 小红书链接
---
```

---

## 4. 对标账号档 `benchmarks-wiki/`

**用途**：沉淀对标账号的系统性拆解（账号级，非单条）。

**联动**：与 `growth-content-strategy/references/benchmark-analysis.md` 的七维度拆解强联动。

### 目录结构
```
benchmarks-wiki/
├── _index.md                # 对标池总览
└── <账号名>.md               # 每个对标账号一个文件
```

### 单页 Schema

**账号页 `<账号名>.md`**
```yaml
---
type: benchmark-account
account: <账号名/ID>
platform: <平台>
followers: <粉丝数>
positioning: <账号定位一句话>       # 必填
target_audience: <目标人群>
content_pillars: [<核心内容方向>]    # 必填：3-5 个
posting_cadence: <更新频率/时间>
voice: <语言风格>
seven_dimensions:                # 必填：对应 benchmark-analysis 的七维度
  positioning: <账号定位分析>
  topic: <选题策划分析>
  content: <内容创作分析>
  copywriting: <文案排版分析>
  visual: <视觉呈现分析>
  engagement: <互动策略分析>
  operation: <运营策略分析>
reusable_elements: <可复用的元素>
not_copyable: <个人风格/不可复制的点>
updated: YYYY-MM-DD
source: <主页链接 + 采集日期>
---
```

### 示例条目（`某职场妈妈博主.md`）
```yaml
---
type: benchmark-account
account: @职场妈妈小A
platform: xiaohongshu
followers: 18.6万
positioning: 职场妈妈的时间管理 + 副业带货
target_audience: 28-35 岁一线城市职场妈妈
content_pillars: ["时间管理方法", "亲子关系", "副业经验", "好物种草"]
posting_cadence: 每周 4-5 篇，早 8 点 / 晚 9 点
voice: 温和但直接，常用"姐妹们""说真的"
seven_dimensions:
  positioning: ...
  topic: ...
  # （详见 benchmark-analysis.md 的七维度展开）
reusable_elements: 痛点开场公式、评论区"你们都怎么X"互动话术
not_copyable: 创始人个人故事（IP 强绑定，照搬无效）
updated: 2026-07-04
source: 小红书主页，2026-07 抓取
---
```

---

## 5. 模板库 `templates-wiki/`

**用途**：沉淀从爆款共性中提炼出的可复用创作模板，并跟踪每个模板被套用后的真实表现——模板按验证效果自我排序，这是"沉淀结论和能力"的核心库。

**联动**：上游是 `content-toolkit/references/pattern-synthesis.md`（共性提炼产出模板候选）；下游是 `growth-content-writing`（按 goal 选验证效果最好的模板套用）；`verdicts` 验证数据来自发布回流（见 `wiki-maintenance.md` 的「发布回流」）。

### 目录结构
```
templates-wiki/
├── _index.md                # 模板总览：按 goal 分组 + 验证效果排序
└── <模板名>.md              # 每个模板一个文件
```

### 单页 Schema

**模板页 `<模板名>.md`**
```yaml
---
type: template
name: <模板名>
goal: <获客|引流|涨粉信任|转化|测试>   # 必填
platforms: [<适用平台>]
structure_formula: <填空式结构公式>    # 必填
elements:
  hook: <钩子写法>
  cta: <CTA 写法，必须与 goal 匹配>
  tone: <语气/口头禅要点>
source_entries: ["[[hits-wiki/benchmark/某爆款]]"]   # 必填：提炼自哪些条目的共性
usage_count: 0                 # 被套用次数，发布回流时 +1
verdicts: []                   # 验证记录，只在发布数据回填时写，不预填：
                               # - {work: "[[hits-wiki/own/某作品]]", date: YYYY-MM-DD, outcome: 高于常态|均值|低于常态|无基准}
status: 待验证                 # 待验证 | 验证中 | 已验证 | 已淘汰
updated: YYYY-MM-DD
---
```

**使用规则**：
- 选模板时只按 `goal` 匹配 + `status` 排序：已验证 > 待验证 > 已淘汰（淘汰模板保留页面，作失败样本）
- 连续 2 次 `低于常态` 的模板置为 `已淘汰`
- 模板改动（结构调整）视为新模板，新建页面不覆盖旧的——旧模板的验证记录是资产

### 示例条目（`痛点开场-反转故事-评论引导.md`）
```yaml
---
type: template
name: 痛点开场-反转故事-评论引导
goal: 获客
platforms: [xiaohongshu, douyin]
structure_formula: "[痛点共鸣 5s] → [我也是这样 10s] → [直到我用了X 15s] → [引导评论'你们怎么解决' 5s]"
elements:
  hook: 用目标人群的一句原话开场，不加铺垫
  cta: 评论区提问式软引导（"你们都怎么解决的"），私信入口放评论区置顶
  tone: 第一人称实测口吻，忌"家人们"式叫卖
source_entries: ["[[hits-wiki/benchmark/职场妈妈代餐]]", "[[hits-wiki/benchmark/通勤族早餐]]", "[[hits-wiki/benchmark/加班党速食]]"]
usage_count: 0
verdicts: []
status: 待验证
updated: 2026-07-04
---
```

---

## 如何自定义新 Schema

以上 4 类不够用时，按这个流程加新类型：

1. **先想清楚要回答什么问题**（例如"我要管广告投放素材" → 需要记录投放数据、素材类型、ROI）
2. **定义 frontmatter 字段**：必填字段控制在 3-5 个以内，太多会难维护
3. **写到 `SCHEMA.md`**：记录新类型的字段定义和示例
4. **建第一个示例页面**：验证 Schema 是否好用，不好用就调
5. **加到 `wiki-maintenance.md` 的 lint 流程**

**Schema 设计原则**：
- 字段宁少勿多——必填项越多，维护成本越高
- 每个字段都要能回答一个具体问题，不要"为了完整"加字段
- 字段类型简单（字符串、数字、列表），避免嵌套结构
