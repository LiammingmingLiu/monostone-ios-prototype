---
milestone: M1
deadline: 2026-05-03
status: draft
backend-services:
  - multimodal-ingestion-service
  - batch-asr-worker
  - llm-worker
  - understanding-service
  - post-recording-coordinator
  - memory-api（消化结果）
ios-views:
  - HomeView（卡片入场）
  - RecordingDetailView（长录音 6 section）
  - IdeaDetailView（灵感卡片）
  - LongRecordingView（FAB 录音中）
linear-issues: [MON-9, MON-10, MON-11, MON-12, MON-13, MON-14, MON-15]
---

# M1 · 长录音 + 灵感（Recording + Multimodal Input）产品定义

> 林啸读完这份文档，应该能动手实现 monostone-app 长录音/灵感卡片所有交互 + 改 monostone_backend 的 `multimodal-ingestion-service` / `batch-asr-worker` / `understanding-service` 的相关字段。

## 1. Milestone 范围

**包含**
- 长录音卡片：从 FAB 录音 → ASR → understanding → Memory 入库 → iOS 展示完整 6 section
- 灵感卡片：短录音 → 自动归属到 `project` → 相关灵感 + Agent 发散
- iOS ↔ `multimodal-ingestion-service` 端到端打通（替换当前 mock）
- Live Activity 状态机映射后端处理事件

**不包含**
- 短录音 todo / command 类型（→ M2）
- Memory 节点物化 prompt（→ M3）
- Plugin 触发（→ M4）

## 2. Backend 模块对齐

### 录音链路（按 `MONOSTONE_BACKEND_MODULE_INTERFACE_CALL_REPORT.md` §app-后端链路模块）

```
iOS
  │
  │ 1. POST /recordings or /multimodal/inputs                ← multimodal-ingestion-service
  │ 2. POST .../presign                                      ← 获取对象存储预签名地址
  │ 3. PUT (S3 直传)
  │ 4. POST .../complete                                     ← 投递 SQS_QUEUE_URL / MULTIMODAL_PARSE_QUEUE_URL
  │
  ├──→ batch-asr-worker（消费录音队列）
  │      ├─ ASR (DASHSCOPE_API_KEY)
  │      ├─ 写 transcript artifact 到 ARTIFACTS_BUCKET
  │      └─ 投递 LLM_EVENTS_QUEUE_URL + TRANSCRIPT_COMPLETED_SNS_TOPIC_ARN
  │
  ├──→ multimodal-parser-worker（多模态文件）
  │
  ├──→ llm-worker（消费 LLM_EVENTS_QUEUE_URL）
  │      ├─ 按 recording_mode 路由模型
  │      ├─ 生成 summary + understanding（artifact 写入 ARTIFACTS_BUCKET）
  │      ├─ 可选投递 MEMORY_EVENTS_QUEUE_URL（写记忆）
  │      └─ 发布 UNDERSTANDING_READY_SNS_TOPIC_ARN
  │
  ├──→ post-recording-coordinator
  │      └─ 推进 memory / agent / pattern-evaluator / timeline
  │
  └─ iOS 轮询/推送
       GET /recordings/{recording_id}/summary       ← understanding-service
       GET /recordings/{recording_id}/understanding ← understanding-service
```

### 涉及的环境变量（仅作 spec 引用，不写值）
- `multimodal-ingestion-service`: `UPLOADS_BUCKET`, `ARTIFACTS_BUCKET`, `SQS_QUEUE_URL`, `MULTIMODAL_PARSE_QUEUE_URL`
- `batch-asr-worker`: `DASHSCOPE_API_KEY`, `LLM_EVENTS_QUEUE_URL`, `TRANSCRIPT_COMPLETED_SNS_TOPIC_ARN`
- `llm-worker`: `MEMORY_EVENTS_QUEUE_URL`, `MEMORY_TREE_EVENTS_QUEUE_URL`, `UNDERSTANDING_READY_SNS_TOPIC_ARN`, `MODEL_SETTINGS_BASE_URL`

## 3. iOS 用户旅程

> Prototype anchor: 待补，在 `index.html` 里给 s2 / s3 加 `id="screen-home"` `id="screen-recording-detail"`

1. **触发录音**（s2 home）：用户长按 / 快点 FAB
2. **录音中**（LongRecordingView）：内联计时器 + 实时音量波形
3. **结束录音**：iOS 调 `POST /recordings` → presign → S3 PUT → `POST /recordings/{id}/complete`
4. **首页插入 processing 卡片**：Live Activity 同步弹出
5. **Live Activity 状态变化**：
   - `uploading` → `transcribing` → `structuring` → `done` / `failed`
   - 状态映射后端事件：见 §6 API 契约
6. **done 后**：卡片标题更新为 LLM 提取的 title，可点入 RecordingDetailView
7. **RecordingDetailView**：6 section（参与人 / 摘要 / Action Items / 决策 / Memory / 完整纪要）
8. **灵感卡片旁路**：如果 `recording_mode=idea`，跳过 6 section，进 IdeaDetailView（94% 自动归属 + 相关 + 发散）

## 4. 页面级 spec

> TODO（明明）: 每个 view 按以下小节填充

### 4.0 HomeView · 极简卡片列表（MON-32 已 LOCKED 2026-05-03）

**视觉真相**：https://monostone-ux05.vercel.app

#### 4.0.a 整体范式
首页只回答一个问题：**"AI 给我处理出了什么？"** —— 删除一切其他元素。

**保留**: 顶部 Monostone logo / 卡片列表（白底无类型颜色）/ 底部 4 tab / 右下 FAB

**删除**:
- ❌ greeting "早上好，明明"
- ❌ 状态行 "第 N 天 · 戒指已连接 · 今日第 X 次交互"
- ❌ "今日速览"整块（3 行 + "省下 X 分钟"）
- ❌ filter chips（5 类型筛选）
- ❌ "今天 / 昨天" 时间分隔
- ❌ 卡片上的 type label / 卡片彩色区分 / 双行 head / meta 第二行

#### 4.0.b 卡片视觉规范

| 元素 | 规范 |
|---|---|
| 卡片背景 | `--panel` 纯白 `#ffffff` |
| 卡片边框 | `0.5px solid --border`（`rgba(0,0,0,0.06)`） |
| 卡片圆角 | `12px` |
| 卡片间距 | `8px` |
| title 字号 | `15px / 500` |
| title 截断 | 最多 2 行 + ellipsis（`-webkit-line-clamp: 2`） |
| meta-min 字号 | `12px / --text-dimmer` |

#### 4.0.c 卡片 5 状态视觉（**这是核心决策**）

| 状态 | meta-min 文案 | 视觉补充 |
|---|---|---|
| `done` | 相对时间："2 小时前" / "昨天 22:14" | 无 |
| `processing` | "处理中 · 还剩 X 分钟" | shimmer 微弱（cyan rgba 0.05）|
| `needs_input` | "需要确认 · {时间}" + 颜色 `#d4a868` | **右上角黄色小圆点** 8px |
| `failed` | "失败 · 点击重试 · {时间}" + 颜色 `--red` | **右上角红色小圆点** 8px |

文案 key 详见 `docs/copy/toast.md` § HomeView 卡片 meta-min 状态文案。

#### 4.0.d 后端依赖检查 ✅ 零改动

| 视觉元素 | 数据来源 | 后端是否要改 |
|---|---|---|
| 卡片 title | `understanding-service` 的 `title` 字段 | ✅ 已存在 |
| 相对时间 | `created_at` (ISO8601) iOS 端格式化 | ✅ 已存在 |
| `processing` 状态 | `agent-orchestrator-service` task `status` = `transcribing` / `structuring` / `executing` | ✅ 已存在 |
| `needs_input` | task `status` = `awaiting_input` / `awaiting_confirmation` | ✅ 已存在 |
| `failed` | task `status` = `failed` | ✅ 已存在 |
| 4 种类型混合排序 | `timeline-service` `/timeline/feed` 已聚合 | ✅ 已存在 |

⚠️ **唯一需要后端配合的（v0.5 不做，v1.0 再说）**:
- "处理中 · 还剩 X 分钟" 的 ETA 数字。当前 `agent-orchestrator-service` 没有 `estimated_remaining_seconds` 字段。
- **v0.5 fallback**：iOS 拿不到 ETA 时显示 "处理中"，不显示分钟数。HTML prototype 演示用的 "还剩 3 分钟" 是 mock。
- v1.0 加字段时:
  - service: `agent-orchestrator-service`
  - schema 加: `AgentTask.estimated_remaining_seconds: int?`
  - 算法: 后端基于历史 task 同类 P50 估算

#### 4.0.e 林啸 vibecoding 时要做的事
1. **删除** `App/Features/Home/HomeView.swift` 里:
   - `header` greeting + status-line
   - `TodayDigestText`
   - `FilterChipBar`
   - 时间分隔逻辑
2. **改 cardList**：每个 Card 简化为 title + meta-min（一行）。删除 type label / type 颜色。
3. **加** 卡片 5 状态视觉规则（按 4.0.c 表格）
4. **不动**: Repository / Store / RingCoordinator / Live Activity / FAB / 数据加载逻辑

预计代码改动：删 ~150 行，加 ~30 行，零后端改动。

---

### 4.1 RecordingDetailView · ux0.5 极简化（MON-9 已 LOCKED 2026-05-03）

> **重大产品决策**: 详情页不再显示 6 section（参与人 / 摘要 / Action Items / 决策 / Memory / 完整纪要 modal）。
> 改为 **直接 inline 显示完整纪要本身** + 底部 2 个分享按钮。

#### 4.1.a 范式变化
- **之前**: detail-head + 6 个独立 section（每个 section 都有 sec-title + sec-box）+ 底部"分享"单按钮 + "查看完整总结" link → modal
- **之后**: 详情页 = 完整纪要本身（H1 标题 + meta 表 + H2/H3 sections + 表格/引用/列表）+ 底部 `[分享原文] [分享纪要]` 2 按钮

#### 4.1.b 砍掉了什么 + 用户接受的代价

| 删掉的元素 | 原价值 | 删掉后用户怎么办 |
|---|---|---|
| 参与人头像横排 | 5 秒看到谁参会 | 完整纪要 meta 表里有"参会人员" |
| 结构化摘要 4 bullet | 5 秒看核心要点 | 读完整纪要前 1-2 段 |
| **Action Items 列表 + checkbox** | "我接下来要做什么" | **要在纪要里翻找 ⚠️**（用户已接受此代价）|
| 决策 section | 看决策 + 主张人 | 完整纪要"决策"小节 |
| Memory "学到了什么" | 看 AI 提取的 memory 节点 | 跳 Memory tab 看（不在详情页展示）|
| 完整纪要 modal | 弹出查看长内容 | 详情页本身就是完整纪要，无需 modal |
| "查看完整总结" link | 入口 | 不需要 |
| 完整转录 4281 字 inline 展开 | 看 ASR 原文 | 移到底部 `[分享原文]` 按钮（导出而非 inline 阅读）|

#### 4.1.c 详情页结构（单一）

```
┌─ navbar (返回 + (空 title) + ···)
│
├─ <h1>和敦敏的 Series A 跟进会 · 会议纪要</h1>
├─ <dl meta-table>
│     会议时间 / 时长 / 参会人员 / 项目 / 形式
│  </dl>
│
├─ <h2>会议背景</h2> ... <h3>...</h3> <p>...</p>
├─ <blockquote>...</blockquote>
├─ <table>...</table>
├─ ...（更多 section）
│
└─ 底部固定: [分享原文] [分享纪要(primary)]
```

#### 4.1.d 渲染 spec
- `<h1>`: 22px / 700, 文本色 `--text`
- `<h2>`: 17px / 600, top margin 24px
- `<h3>`: 15px / 600, top margin 16px
- `<p>`: 15px / 1.55 line-height, margin-bottom 12px
- `<dl meta-table>`: dt 11px dim / dd 13px text, 2 列 grid
- `<blockquote>`: 左 3px 边线 + 14px italic + dim quote-author
- `<table>`: 边框 0.5px + cell 8px padding + thead 加粗
- `<ul>/<ol>`: 缩进 16px + bullet 12px
- 整体 `.inline-summary` 容器 padding `20px 22px 30px`

#### 4.1.e 底部分享 actions

| 按钮 | 样式 | 行为 |
|---|---|---|
| **分享原文** | secondary（panel 底色 + border） | 调 `shareTranscript(cardId)` → mock 弹"已复制原文到剪贴板" |
| **分享纪要** | primary（accent 橙底 + 白字） | 调 `openShareSheet(cardId)` → 弹 share modal（Markdown / PDF / TXT 格式选 + 8 目的地：复制/邮件/iMessage/Notion/Slack/微信/AirDrop/Files）|

**关键差异**:
- "分享原文" = 直接导出 ASR `understanding.full_transcript` 的纯文本
- "分享纪要" = 弹现有 share modal（已支持 Markdown/PDF/TXT 多格式 + 多目的地）

#### 4.1.g 归属（MON-12 LOCKED 2026-05-04）

**决策**: 长录音和灵感都显示归属，cmd 和 todo 不显示。

| 类型 | 显示归属 | 理由 |
|---|---|---|
| 长录音 | ✅ | 内容类，一定属于某 project |
| 灵感 | ✅ | 内容类（MON-10 已实现）|
| cmd | ❌ | 动作类，核心是 owner / 执行结果，project 是 secondary |
| todo | ❌ | 动作类，核心是时间 / 提醒 |

**展示形式**：嵌在 meta line 末尾（不开独立 sec block）

- 灵感: `走路时 · 45 分钟前 · 0:08 · Monostone 后端 ›`
- 长录音: H1 后单独一行 `归属 · Series A ›`（H1 后没 .mt 行）

`.attr-inline` class: accent 橙色 + chevron，可点击

**点击改归属**: 弹 in-style bottom sheet `#modal-project-picker`（不是 native prompt）
- 复用现有 `.modal-sheet` 暖白样式
- project list + 当前归属 highlight
- 点击 row 即选中（无需确认按钮，iOS action sheet 风格）
- "+ 新建项目" 用 accent 橙色 highlight

**校正学习**: prompt 自动加权重 +0.15（MON-12 已 LOCKED 在 episode-to-project.md），不显式询问用户。

**v0.5 不做**：多次校正同一类型主动询问 "以后这种归到 X？"（避免打扰）

#### 4.1.f 后端依赖检查 ⚠️ 一项可选

| 元素 | 数据来源 | 后端 |
|---|---|---|
| 完整纪要 H1/meta/H2/H3/p 等 | `understanding.full_summary` | ⚠️ 见下 |
| 分享原文 (ASR) | `understanding.full_transcript` | ✅ 已有 |
| 分享纪要弹 sheet | 同上完整纪要数据 | ✅ |

⚠️ **唯一可能要后端配合**:
- `understanding-service` 的 `understanding` 输出 **必须包含** 完整纪要的结构化数据（不只是 `bullet_points`）
- **零改动方案**: 让 MON-6 (`docs/prompts/llm-worker/understanding-prompt.md`) 的输出 schema 包含 `full_summary: { title, meta, sections: [{h, paragraphs}] }`。这是 prompt 输出 schema 决定，不需要改 backend code。
- **prototype mock**: `data/mock.js` 的 `FULL_SUMMARIES` 已是正确格式，作为 backend prompt 输出参考

### 4.7 ~ 4.9 IdeaDetailView · ux0.5 重构（MON-10 已 LOCKED 2026-05-03）

> **核心定位**: 灵感不是 "信息档案"，是 **思考的记录 + 未来行动的种子**。
> 详情页的目标：让用户主动打开时，立即能 (a) 回到当时语境 (b) 看到相关 context (c) 一键转化为行动。

#### 4.7.a 5 块结构（替代旧 7 段）

```
┌─ navbar (返回 + ··· menu)
│
├─ §Head: [灵感 chip] + 标题 + 一行 meta
│
├─ §A 当时        ← 场景 2 关键，新增
│   📍 走路时 · 4/8 22:14 · 0:08
│   上一条录音是「和敦敏的 Series A 跟进会」
│
├─ §B 想法        ← LLM 整理版（不显示原话）
│
├─ §C 归属        ← 一行 + 点击 → 下拉/小框选 project
│
├─ §D 相关 context ⚠️ prompt-driven smart retrieval
│   🎙 「Anki spaced repetition」指令 · 3 天前      L1
│   📝 「Memory A/B 评审」长录音 · 昨天             L2
│   💡 灵感 · 4/2                                    L3
│   ⏱ 待办 · 下周三                                 L1
│
├─ §E 接下来你可以...   ⚠️ AI suggested actions
│   ▸ 让 Agent 做 SM-2 调研               ›
│   ▸ 加成 todo「本周做 POC」             ›
│   ▸ 写成 Memory 设计 RFC                ›
│
└─ (底部无 actions bar，分享 / 归档 / 删除 进 ··· menu)
```

#### 4.7.b 砍掉了什么

| 删 | 理由 |
|---|---|
| 原声播放块 | 用户基本不再听，浪费空间 |
| reclass-picker | 移到 navbar `···` menu（一致 cmd 决策）|
| 自动归属 confidence 数字 | 只显示 project 名字（用户不关心 91% 数字）|
| "相关的过往灵感" 3 个 card | 改成 §D smart context（4 类 source 混排）|
| "和 Agent 一起发散" inline chat | 改成 §E action card 单击转 cmd task（避免详情页变成第二个 Agent 入口）|
| 底部 [归档][加入项目] | 归属已在 §C 完成，归档/分享进 ··· menu |

#### 4.7.c §A 当时 — 新增的"语境"块

**价值**: 解决场景 2（用户在做任务时回看灵感）— 让用户立即想起 "我当时为什么会想到这个"。

| 字段 | 数据源 | 后端 |
|---|---|---|
| 场景标签（走路时/开车时/在办公室）| 戒指 IMU + 时间推断 | ✅ 戒指已有 IMU；后端推断逻辑 v0.5 不实现也 OK（fallback 不显示） |
| 时间 | `recording.recorded_at` | ✅ |
| 时长 | `recording.duration_seconds` | ✅ |
| 上一条录音标题 | `timeline-service /timeline/feed?around={event_id}` | ✅ 已有（feed 临近 events） |

#### 4.7.d §B 想法 — LLM 整理版

**用户拍板**: 不显示原话切换，只信任 LLM 整理。如果 LLM 整理错了，用户在 §C 改归属时反馈。

**字段**: `understanding.title` 或 `understanding.summary_text`（短叙述版，不是 bullet）

#### 4.7.e §C 归属 — 一行可点击

**交互**: 点击 → 弹小框/下拉（不占满屏）→ 选 project（含"+ 新建项目"）→ 写回

**API**: `memory-api POST /memory/feedback`（已有）

#### 4.7.f §D 相关 context — Smart Retrieval ⚠️

**核心产品决策**: 这块不是 dumb similarity search，而是 **smart context retrieval**。系统要回答 "用户面对这条灵感，如果想推进，他需要哪些 context 才能做出好决策？"

**3 个层次（按价值排序）**:

| 层次 | 包含 | 例子 |
|---|---|---|
| **L1 直接 actionable** | 已经做过 / 已经写过 / 已经决定 | "你 3 天前已经让 Agent 做过 SM-2 调研" |
| **L2 决策支撑** | 相关讨论 / 相关人物 / 项目状态 | "林啸在 A/B 测试评审讨论了 promotion 阈值" |
| **L3 启发拓展** | 相似主题的过往灵感 | "你 4 周前想过 Memory 衰减曲线" |

**跨类型 source**: long_rec / command / idea / todo 四类都可能出现。

**⚠️ 后端配合（仅 prompt schema 约束）**:
- 在 **MON-8 agent fetch pipeline** 加第 6 个 prompt: `docs/prompts/agent-orchestrator/idea-context-retriever.md`
- 输出 schema:
  ```typescript
  {
    relevant_context: Array<{
      node_id: string,
      source_type: "long_rec" | "command" | "idea" | "todo",
      title: string,             // ≤ 20 字
      why_relevant: string,      // ≤ 30 字 — 关键字段
      relevance_layer: "L1" | "L2" | "L3",
      importance: number,
    }>,  // 总数 3-5 条
  }
  ```
- **不需要 backend code 改动**，是 prompt 输出 schema 决定
- **iOS fallback**: prompt 还没写时，前端用 `memory-api POST /memory/tree/search` 拿 raw nodes 显示（无 why_relevant 字段）

#### 4.7.g §E 接下来你可以... — AI Suggested Actions ⚠️

**核心产品决策**: 灵感的核心价值是"种子"，详情页应该让灵感"立即能转化为行动"。

**3 张 action card，单击 = 创建 cmd task → 跳 CommandDetailView 等待 [拒绝][允许]**

| 用户点 | 后端发生 |
|---|---|
| "让 Agent 做 X 调研" | `POST /agent/tasks` (type=command_execute, prompt 含灵感 id) → 跳 cmd detail |
| "加成 todo「Y」" | `POST /timeline/events` (kind=todo) → toast "已加入待办" |
| "写成 RFC" | `POST /agent/tasks` (type=command_execute, plugin=document-writer) → 跳 cmd detail |

**为什么不要"忽略"按钮**: 不点就是忽略，加按钮反而鼓励主动忽略行为。

**为什么不要展开预览**: CommandDetailView 已经是预览页（你的原话 + 上下文 + 产出 + 拒绝/允许），重复设计无意义。

**⚠️ 后端配合（仅 prompt schema 约束）**:
- **MON-6 understanding-prompt** 输出加 `suggested_actions: Array<{title: string, why: string, action_type: "command" | "todo"}>`
- 总数 ≤ 3，每条 title ≤ 20 字，why ≤ 30 字
- **不需要 backend code 改动**，是 prompt schema
- **iOS fallback**: prompt 还没写时，前端 hardcode 3 条通用 action（"让 Agent 调研" / "加为 todo" / "写成文档"）

#### 4.7.h 后端依赖完整 check ✅ 零 backend code 改动

| UX 元素 | 后端 |
|---|---|
| §A 当时 (location/前后录音) | ✅ 已有 |
| §B 想法 (LLM 整理版) | ✅（understanding.title / summary_text）|
| §C 归属改 | ✅（memory-api /memory/feedback）|
| §D 相关 context smart retrieval | ⚠️ **MON-8 加新 prompt** `idea-context-retriever.md` |
| §E suggested actions | ⚠️ **MON-6 prompt schema** 加 `suggested_actions` 字段 |
| §E 转 cmd task | ✅（POST /agent/tasks）|
| §E 转 todo | ✅（POST /timeline/events）|

**两个 ⚠️ 都是 prompt 输出 schema 约束**，不是 backend code 改动。林啸在做 MON-6 / MON-8 时按这个约束写。

#### 4.1.f 后端依赖检查（MON-9 范围）⚠️ 一项可选

| 元素 | 数据来源 | 后端 |
|---|---|---|
| 完整纪要 H1/meta/H2/H3/p | `understanding.full_summary_html` 或等价结构 | ⚠️ 见下 |
| 分享原文 (ASR) | `understanding.full_transcript` | ✅ 已有 |
| 分享纪要弹 sheet | 同上完整纪要数据 | ✅ |

⚠️ **唯一可能要后端配合**:
- `understanding-service` 的 `understanding` 输出 **必须包含** 完整纪要的结构化数据（不只是 `bullet_points`）
- **零改动方案**：让 MON-6 (`docs/prompts/llm-worker/understanding-prompt.md`) 的输出 schema 包含一个 `full_summary` 字段（结构化 sections + paragraphs）。这是 prompt 输出 schema 决定，不需要改 backend code。
- **prototype mock**: `data/mock.js` 的 `FULL_SUMMARIES` 已经是正确格式 (sections[].paragraphs[])，作为 backend prompt 输出参考

## 4.10 Live Activity 5 状态（MON-14 LOCKED 2026-05-04）

> **范围**：iOS 灵动岛 + 锁屏浮动卡片。和 home feed 内卡片状态视觉是不同的 surface（home 见 §4.0.c）。

### 4.10.a 5 状态文案

| 状态 | 标题 | 副标题 | trail |
|---|---|---|---|
| uploading | 上传中 | "{title} · 处理 {N} 条录音" | spinner |
| transcribing | 转写中 | 同上 | spinner |
| structuring | 整理中 | 同上 | spinner |
| done | 已完成 | "{title} · 点击查看" | ✓ |
| failed | 失败 · 点击重试 | "{title}" | ! |

### 4.10.b 视觉差异（3 个 surface）

| Surface | 内容 |
|---|---|
| **锁屏 / 灵动岛展开** (long press) | 图标 + 标题 + 副标题 + trail |
| **灵动岛紧凑态** (Dynamic Island compact) | 状态 emoji + 数字（处理几条），最小空间 |
| **首页卡片 meta-min** (home feed) | 见 §4.0.c（不同 surface 不同视觉）|

### 4.10.c 关键决策

1. **进度形态**：处理中 3 状态用 spinner（不显示 % 或 ETA）。理由：后端无 `estimated_remaining_seconds` 字段（MON-32 决定 v0.5 fallback）
2. **完成停留**：done 状态 **永久显示直到用户 dismiss 或点击进入卡片详情**（不自动收起 5 秒）。这是和 home 卡片不同的策略
3. **多录音并发**：合并显示 "处理 N 条录音中"，**不堆叠**（避免占满锁屏）
4. **失败原因**：Live Activity 不显示具体原因。点击 → 跳首页对应卡片，详细原因在卡片错误态展示（MON-15 范围）
5. **重试入口**：Live Activity 上**不**放 [重试] 按钮。点击 = 跳卡片，在卡片上重试。Live Activity 不承载 action

### 4.10.d 后端依赖检查 ✅ 零改动

| 元素 | 数据源 | 后端 |
|---|---|---|
| 5 状态 | `agent-orchestrator-service` task `status` 字段 | ✅ 已有 |
| Live Activity 启动 / 更新 / 结束 | iOS ActivityKit 端到端 | ✅ 纯前端 |
| done 5 秒自动收起 | iOS ActivityKit `staleDate` = +5s, 然后 `end()` | ✅ |
| failed 跳卡片 | iOS Deep link（已实现, commit fec25ef）| ✅ |

### 4.10.e prototype mock
ux05 home 页 navbar 下方有 `.la-preview` mock 展示 5 状态 cycle 视觉（点击切换）。这是纯演示，iOS 端用 ActivityKit 真实实现。

## 4.11 空态 / 错误态 / 重试 (MON-15 LOCKED 2026-05-05)

### 4.11.a 8 个边界 case 决策

| # | 场景 | 决策 |
|---|---|---|
| A | 第一次打开 home（无卡片）| 一行 dim 文字 `还没有录音 · 长按戒指开始`（不引入 illustration）|
| B | 网络断 | **不做全局 banner**（明明 5/6 复议）。状态信息**只在受影响的卡片**上显示，避免污染主屏 |
| C | ASR 失败 | 卡片 meta `失败 · 点击重试`；详情页 `[重试转写][下载原音频]` 双按钮 |
| D | LLM 整理失败但转写成功（部分降级）| status 仍 `done`，详情页顶部 banner `AI 未能整理结构化纪要 · 显示完整转写` |
| E | **上传中断（飞行模式 / 杀进程）** | **iOS 自动续传 + 卡片 meta 显示"已存戒指 · 联网后自动上传"**（戒指 4h 缓存兜底，用户可见）。**不加右上角 [戒指] badge**（明明 5/6 复议，meta 文案足够）|
| F | 灵感无法归属（confidence < 0.4）| 暂挂"未归属"伪 project，meta `归属 · 未归属 ›`，用户主动改 |
| G | 自动重试策略 | 网络错误 3 次 exponential backoff (1/3/10s)；LLM/ASR 错误不自动重试 |
| H | 错误信息详细程度 | 简短人话主显示，技术细节进 `···` menu "查看错误详情" |

### 4.11.b 戒指本地缓存 (E 场景关键)

**产品定位**: 戒指有 4 小时录音存储空间。上传中断时录音不丢失，**用户可见**地知道"数据安全在戒指上"，避免怀疑数据丢失。

**实现（明明 5/6 复议简化版）**: 只用卡片 meta 文案承载，**不加 ring badge / 不加全局 banner**。

| 视觉元素 | 实现 |
|---|---|
| 卡片 meta | `已存戒指 · 联网后自动上传` |
| 卡片边框 | 暖黄 (`rgba(212,168,104,0.30)`) — 区别于 done / failed |
| 网络恢复 | meta 切换 `正在补传…` → 上传完成转 done |

**砍掉**:
- ❌ 卡片右上角 `[戒指]` badge — meta 文案已经讲清楚，badge 多余
- ❌ home 顶部网络断 banner — 信息只在受影响的卡片上显示，避免污染主屏

### 4.11.d 后端依赖检查

| 元素 | 后端 |
|---|---|
| 网络监测 (Reachability) | ✅ iOS 端到端 |
| 戒指本地缓存 4h | ✅ 戒指固件已实现（hardware spec, see `project_monostone.md`）|
| BLE 续传 | ✅ events-protocol 已有 |
| 自动重试 (网络层) | ✅ iOS URLSession |
| Live Activity 续传 | ✅ ActivityKit + URLSession background |

⚠️ **2 项可能要后端配合（不是 backend code 改动，是约定 schema）**:

1. **错误码标准化**: 各 service 返回 `{ http_status, error: { code, message_zh, retryable: bool } }`
   - **v0.5 fallback**: iOS 端 hardcode 错误文案 mapping，按 HTTP status 兜底

2. **understanding 部分降级**: LLM 整理失败时，`understanding-service` 仍返回 `{ full_transcript, full_summary: null, partial: true }`
   - **v0.5 fallback**: iOS 端 if `understanding.full_summary == null` → 显示降级 UX

这两项都是约定 schema，林啸看 backend 实际响应字段做对齐。

## 5. 后端变更

### 5.1 `multimodal-ingestion-service`
- TODO: 列出新增 / 修改的字段（如果有）

### 5.2 `llm-worker` 的 summary / understanding prompt
- 引用 `docs/prompts/llm-worker/summary-prompt.md`
- 引用 `docs/prompts/llm-worker/understanding-prompt.md`
- 引用 `docs/prompts/llm-worker/recording-mode-router.md`
- **MON-9 约束**: understanding 输出必须含 `full_summary: { title, meta, sections: [{h, paragraphs}] }`

### 5.3 `understanding-service` 返回 schema
- 引用 `docs/data/card-recording.md`

## 6. API 契约

### 上传录音
```
POST /recordings
POST /recordings/{recording_id}/presign
PUT  <预签名 S3 URL>
POST /recordings/{recording_id}/complete
GET  /recordings/{recording_id}/summary
GET  /recordings/{recording_id}/understanding
```

### 状态映射
| iOS 状态 | 触发条件 | 数据源 |
|---|---|---|
| `uploading` | iOS 本地，PUT S3 中 | iOS 自跟踪 |
| `transcribing` | TODO: 后端是否有 status 字段？还是靠 `understanding-service` 404 推断？ | TODO 林啸定 |
| `structuring` | LLM_EVENTS 已投递、UNDERSTANDING_READY 未发布 | TODO |
| `done` | `GET /recordings/{id}/understanding` 返回 200 + 完整结果 | understanding-service |
| `failed` | TODO: 后端错误事件 | TODO |

## 7. 文案

引用 `docs/copy/toast.md`、`docs/copy/empty-state.md`、`docs/copy/error.md`。本 milestone 涉及：
- toast: 录音完成 / 上传失败 / 转写失败
- empty-state: 第一次打开 / 网络断
- error: ASR 失败 / 结构化失败

## 8. Acceptance（林啸完成 = 全勾）

- [ ] iOS FAB 录音真上传到 `multimodal-ingestion-service`，本地 mock 全部移除
- [ ] `GET /recordings/{id}/summary` + `/understanding` 数据正确映射到 RecordingDetailView 6 section
- [ ] Live Activity 5 状态全部跑通，且和后端事件对齐
- [ ] IdeaDetailView 自动归属置信度 + 相关 + 发散三块都从真实 API 数据
- [ ] 错误态 / 空态 / 重试 全覆盖
- [ ] prototype `index.html` 对应区块加锚点 + 截图存 `docs/screenshots/`
