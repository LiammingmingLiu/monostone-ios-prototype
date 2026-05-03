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

### 4.1 RecordingDetailView · 参与人 section
- **UI**: 头像横排，最多 5，溢出 "+N"
- **数据来源**: `RecordingSummary.participants`（来自 `understanding` artifact 的 understanding 输出，由 `llm-worker` 提取）
- **交互**: 折叠/展开（spring 0.3s）
- **边界**: 0 人 → 隐藏；识别失败 → "未识别参与人 · 手动添加"
- **Acceptance**: …

### 4.2 RecordingDetailView · 结构化摘要
- TODO

### 4.3 RecordingDetailView · Action Items
- TODO（已有左滑删除骨架，commit 71955b9）

### 4.4 RecordingDetailView · 决策
- TODO

### 4.5 RecordingDetailView · Memory
- 列出本次录音入库的 memory tree 节点（按 `memory_node_ids`）
- 点击 → 跳转 MemoryView 并定位到节点

### 4.6 RecordingDetailView · 完整纪要 modal
- TODO

### 4.7 IdeaDetailView · 自动归属
- 引用 `agent-orchestrator-service` 的 retrieval policy（M3 prompt）

### 4.8 IdeaDetailView · 相关灵感
- 检索来源：memory-api `POST /memory/tree/search`

### 4.9 IdeaDetailView · Agent 发散
- 触发 `POST /agent/tasks`（type=brainstorm）

## 5. 后端变更

### 5.1 `multimodal-ingestion-service`
- TODO: 列出新增 / 修改的字段（如果有）

### 5.2 `llm-worker` 的 summary / understanding prompt
- 引用 `docs/prompts/llm-worker/summary-prompt.md`
- 引用 `docs/prompts/llm-worker/understanding-prompt.md`
- 引用 `docs/prompts/llm-worker/recording-mode-router.md`

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
