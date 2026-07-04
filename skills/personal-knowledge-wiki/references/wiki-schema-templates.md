# 内容创作知识库 Schema 模板

> 开箱即用的 4 类 wiki Schema。每类含：目录结构、单页 Schema（frontmatter 字段）、示例条目。

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
├── _index.md                # 爆款总览 + 共性规律提炼
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
published: YYYY-MM-DD
metrics:                       # 必填：至少 1 个核心指标
  views: <播放量>
  likes: <点赞>
  comments: <评论>
  shares: <分享>
duration: <时长秒数，视频类填>
transcript_source: <转写来自哪：自转写/工具/手抄>
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
