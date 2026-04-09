# Monostone · 数据流（Data Flow）

从戒指录音开始，到用户在 App 上看到一张卡片，完整的端到端数据流。

**版本**：v0.1 · 2026-04-09
**配套文档**：[semantic-map.md](./semantic-map.md)

---

## 1. 总览：4 种输入 → 4 种卡片

```
┌───────────────────────────────────────────────────────────┐
│                     输入层（戒指）                         │
├───────────────────────────────────────────────────────────┤
│  双击戒指                 按住戒指说话（短录音）            │
│  ────────                  ────────────────────            │
│  开始长录音                    │                           │
│  直到再次双击                  │                           │
│       │                        │                           │
└───────┼────────────────────────┼───────────────────────────┘
        │                        │
        ▼                        ▼
  ┌──────────┐           ┌─────────────┐
  │  长录音   │           │   短录音     │
  │ long_rec │           │  (无标签)    │
  └────┬─────┘           └──────┬──────┘
       │                        │
       │                   ┌────┴────────┐
       │                   │  分类器      │ ⭐ 后端核心
       │                   │ (LLM)       │
       │                   └────┬────────┘
       │                        │
       │            ┌───────────┼────────────┐
       │            │           │            │
       ▼            ▼           ▼            ▼
  ┌─────────┐  ┌────────┐  ┌────────┐  ┌────────┐
  │ 长录音卡 │  │ 指令卡  │  │ 灵感卡  │  │ 待办卡  │
  │long_rec │  │command │  │  idea  │  │  todo  │
  └─────────┘  └────────┘  └────────┘  └────────┘
        │           │           │           │
        └───────────┴───────────┴───────────┘
                    ▼
              ┌──────────┐
              │ Timeline │ (s2)
              └──────────┘
```

---

## 2. 完整流水线（Pipeline）

### 阶段 1 · 捕获 Capture（戒指 → 手机）

**触发**：用户操作戒指
- 双击戒指 → 进入"长录音模式"，开始连续录音，直到第二次双击
- 按住戒指 → 进入"短录音模式"，按住期间录音，松开后 ~0.3s buffer 结束

**数据流**：
```
戒指 MCU
  ├─ 采集双麦 16kHz PCM
  ├─ opus 编码（比特率 ~24kbps）
  └─ BLE characteristic notify → 手机 App
```

**App 端事件**：
```ts
// BLE 事件
event RING_RECORDING_STARTED {
  session_id: uuid,
  mode: 'long' | 'short',
  started_at: timestamp,
  trigger: 'double_tap' | 'press_hold'
}

event RING_AUDIO_CHUNK {
  session_id: uuid,
  sequence: number,
  opus_data: bytes
}

event RING_RECORDING_STOPPED {
  session_id: uuid,
  stopped_at: timestamp,
  stop_reason: 'user_stopped' | 'timeout' | 'disconnect'
}
```

**UI 影响**：
- `RING_RECORDING_STARTED` → App 跳到 `s7` Listening screen
- `RING_AUDIO_CHUNK` → 驱动波形动画
- `RING_RECORDING_STOPPED` → 返回 `s2` Timeline，同时在 Timeline 插入一个 `pending` 状态的卡

**本地缓冲**：
- 音频 chunk 写入 SQLite `raw_audio_sessions` 表
- 离线时持续缓冲，不丢数据
- 网络恢复后自动上传

---

### 阶段 2 · 上传 Upload（手机 → 云端）

**触发**：录音结束 OR 网络恢复

**API**：
```
POST /audio/upload
Content-Type: application/octet-stream
X-Session-Id: uuid
X-Mode: long | short
X-Started-At: ISO8601
X-Duration-Ms: number
X-Trigger-Context: base64(json)  // 前端捕获的上下文

Body: opus audio bytes

Response: {
  session_id: uuid,
  card_id: uuid,           // 云端立刻分配的 card id
  state: 'uploading' | 'queued'
}
```

**Trigger Context 数据**（前端采集后上报）：
```ts
{
  // 时间信息
  hour_local: number,
  weekday: number,

  // 位置 / 动作（从手机或戒指 accelerometer 推断）
  motion_state: 'walking' | 'driving' | 'stationary' | 'unknown',
  location_tag: 'home' | 'office' | 'commute' | 'unknown',  // 基于用户预先标记的坐标

  // 日历信息（前端读 EventKit）
  calendar_events_within_30min: [
    { title, start, end, is_attending }
  ],

  // 戒指传感器
  ring_battery: number,
  ring_firmware: string
}
```

⚠️ **trigger_context 是 "3 次走路时 / 2 次会后 / 3 次电脑前" 的数据来源**。没有它这个速览统计做不出来。

---

### 阶段 3 · 转写 Transcribe（云端）

**输入**：opus 音频
**输出**：
```ts
{
  raw_transcript: string,              // 原始 ASR 结果
  language: 'zh-CN' | 'en' | ...,
  speaker_segments: [                  // 说话人分离（长录音必需）
    { speaker_id: 'S1'|'S2'|..., start_ms, end_ms, text }
  ],
  confidence: number,
  asr_engine: 'whisper' | ...
}
```

**状态更新**：`card.state` → `transcribing` → `transcribed`

**前端感知**：WebSocket 推送 `card.updated`，Timeline 上的卡片文字从占位符变成实际转写。

---

### 阶段 4a · 分类 Classify（仅短录音）

**输入**：`raw_transcript` + `trigger_context`
**任务**：把短录音归为 `command` / `idea` / `todo` 之一

**建议策略**：
```python
# 伪代码
def classify_short_recording(transcript, context):
    # 规则快筛（高置信）
    if re.search(r'^(提醒|明天|下周|\d+点|\d+号).*', transcript):
        return ('todo', 0.95)
    if re.search(r'^(帮我|给我|做个|查一下).*', transcript):
        return ('command', 0.90)

    # LLM 兜底
    prompt = f"""
    分类这段短录音为 command/idea/todo 之一。
    - command: 要求执行某个任务（起草邮件、做研究、写代码…）
    - idea: 记录一个想法、灵感、观察，无需立即执行
    - todo: 日程、提醒、待办事项

    录音: {transcript}
    上下文: {context}
    """
    result = llm.classify(prompt)
    return (result.type, result.confidence)
```

**输出**：
```ts
{
  card_type: 'command' | 'idea' | 'todo',
  classification_confidence: number,
  alternative: { type, confidence } | null  // 次可能的分类
}
```

**UI 处理**：
- `confidence >= 0.85` → 静默分类
- `confidence < 0.85` → 卡片上显示 "看起来是灵感，切换为指令 ›" 的 affordance
- 用户手动切换 → `PATCH /cards/{id}` body `{type: 'command'}`，触发重新处理

⚠️ **这个 threshold 和分类准确率直接影响用户体验**，需要后续 A/B 测试调优。

---

### 阶段 4b · 类型特定处理 Type-specific Processing

#### 4b-1 · 长录音 → LongRecordingCard

```
transcribed → extracting_structure → ready
```

**Pipeline**：
1. **说话人识别 + 命名**：把 S1/S2 映射到实际人名（用 memory 里的 voice embedding）
2. **结构化摘要**：LLM 生成 3-5 条 bullet 摘要
3. **Action Items 抽取**：LLM 识别 "谁 / 做什么 / 什么时候"
4. **关键决策识别**：LLM 标记"决定了什么"的句子
5. **Memory 归因**：LLM 分析"这次会议新增了哪些关于 [人/项目/偏好] 的知识"
6. **持久化**

**LLM 输出示例**：
```json
{
  "title": "和蔡哥的 Series A 跟进会",
  "summary_bullets": ["..."],
  "action_items": [
    {
      "text": "Marshall 锁定 ODM 合作方",
      "owner": "Marshall",
      "deadline_parsed": "2026-04-30",
      "deadline_label": "4 月底",
      "source_offset_ms": 892340  // 原录音中的时间戳
    }
  ],
  "key_decisions": [...],
  "memory_updates": [
    {
      "type": "person",
      "target": "蔡哥",
      "fact": "Linear Capital 合伙人，偏好 closed-loop 定位",
      "confidence": 0.92
    }
  ]
}
```

**Memory 写入**：每一条 `memory_update` 成为 `memories` 表的一行，level=L1（原始）+ source_card_id=当前卡片。

---

#### 4b-2 · 指令 → CommandCard

```
classified(command) → retrieving_context → planning → executing → reviewing → ready
```

**Pipeline**：
1. **意图解析**：`user_utterance` → `{intent: 'draft_email', target: '蔡哥', topic: 'Series A 跟进'}`
2. **上下文检索**：从 memories + 最近录音 + 邮件线程里 RAG 相关信息
3. **执行规划**：根据 intent 调用对应 Agent skill
4. **执行**：skill 生成 result（邮件 / 研究 / 代码 …）
5. **自我校验**：LLM 检查 result 是否有事实错误
6. **产出**：写入 `result` 字段

**Step 级别状态广播**（WebSocket）：
```ts
event card.processing_progress {
  card_id: uuid,
  step_index: number,
  step_title: string,
  detail: string,
  status: 'running' | 'done' | 'failed',
  elapsed_ms: number
}
```

前端 `s4` 的 "执行步骤" section 实时显示这些。

**结果 schema**（以 email 为例）：
```ts
{
  result_type: 'email',
  result_content: {
    to: string,
    subject: string,
    body_markdown: string,
    attachments: []
  },
  version: 1
}
```

---

##### 指令卡的对话迭代（核心）

用户在 `s4` 的 "继续和 Agent 沟通" 发送新消息：

```
POST /cards/{id}/chat
body: { content: "GTM 那段展开一下" }

Response (streaming):
event: agent_thinking
data: { status: "理解需求中..." }

event: agent_result_update
data: {
  new_version: 2,
  changed_fields: ['result_content.body_markdown'],
  diff_summary: "扩展 GTM 段为三句，加入 10+ 交互锚点"
}

event: agent_message
data: { content: "好，我把 GTM 段扩展成三句..." }
```

前端收到事件后：
- `agent_thinking` → 显示 typing indicator
- `agent_result_update` → 刷新 "产出" section
- `agent_message` → 追加到 chat_messages

⚠️ **版本管理**：每次 result 变更，old version 存到 `card.versions[]`，用户可以 "回到上一版"。

---

#### 4b-3 · 灵感 → IdeaCard

```
classified(idea) → cleaning → classifying_project → finding_related → ready
```

**Pipeline**：
1. **转写清理**：raw_transcript → cleaned_transcript（去口头禅、补标点）
2. **项目归属**：向量检索所有 project 的 description + 最近活动，找最接近的 → `auto_project`
3. **相关灵感检索**：embedding 相似度搜索所有历史卡片 → top-3 `related_cards`
4. **不执行任何 agent 动作**（这是 idea 和 command 最大的区别）

**写入 memory**：灵感本身不自动写 memory（避免噪音），但如果后续被 `加入项目` 则加一条 L1 memory。

---

##### 灵感卡的对话发散（核心）

用户在 `s5` 的 "和 Agent 一起发散" 发送新消息：

和指令卡的 chat 机制**几乎一样**，但关键差异：
- **不触发 result 更新**（因为 idea 没有 result）
- Agent 回复可以建议 "要我整理成一个 RFC 草稿吗？" → 点了之后 `POST /cards/{id}/spawn` 创建一个新的 command 卡

```ts
event agent_message {
  content: "...",
  suggested_actions: [
    { type: 'spawn_command', label: '整理成 RFC 草稿', payload: {...} },
    { type: 'link_to_card', label: '关联到 L2 consolidation 灵感', payload: {...} }
  ]
}
```

---

#### 4b-4 · 待办/日程 → TodoCard

```
classified(todo) → parsing → writing_external → conflict_checking → ready
```

**Pipeline**：
1. **自然语言解析**：`"周四下午 3 点去看牙医"` → structured datetime
2. **地点识别**：`"人民医院口腔科"` → location field
3. **写入外部系统**：
   - 有时间 → Apple Calendar (EventKit)
   - 无时间 → Reminders / Linear / Todoist（按用户配置）
4. **冲突检测**：扫描 Apple Calendar 同时段其他事件

**写入 API**：
```
POST /external/calendar/write
body: {
  card_id: uuid,
  target: 'apple_calendar',
  event: {...}
}

Response: {
  external_id: "abc-123",
  external_url: "calshow://...",
  synced_at: timestamp
}
```

⚠️ **离线问题**：写入外部系统可能失败（网络、权限），需要重试队列。

---

### 阶段 5 · 交付 Deliver（展示给用户）

**WebSocket 推送**：
```ts
event card.created {
  card: Card  // 初始状态，可能还是 processing
}

event card.updated {
  card_id: uuid,
  fields: { ... },  // 只发变更字段
  new_state: string
}
```

前端 `s2` Timeline 维护一个 card list，收到事件后：
- `card.created` → prepend 到列表顶部（同时更新 digest counts）
- `card.updated` → 原位更新

---

## 3. 核心数据模型（Data Models）

### Card 基类

```ts
interface BaseCard {
  id: uuid,
  user_id: uuid,
  device_id: uuid,                     // 产生这张卡的设备（戒指 id）

  type: 'long_rec' | 'command' | 'idea' | 'todo',
  state: CardState,

  // 时间戳
  created_at: timestamp,               // 录音开始时间
  uploaded_at: timestamp | null,
  processed_at: timestamp | null,
  last_modified_at: timestamp,
  version: number,                     // 用于 CRDT 合并

  // 原始数据
  audio_url: string,
  audio_duration_ms: number,
  raw_transcript: string,
  cleaned_transcript: string | null,

  // 上下文
  trigger_context: TriggerContext,
  project_id: uuid | null,

  // 软删除
  archived: boolean,
  deleted_at: timestamp | null
}

type CardState =
  | 'captured'        // 戒指录完，手机本地
  | 'uploading'       // 手机 → 云端
  | 'queued'          // 云端待处理
  | 'transcribing'    // ASR 进行中
  | 'classifying'     // 短录音分类中
  | 'processing'      // 类型特定处理
  | 'ready'           // 完成，用户可交互
  | 'delivered'       // 已执行外部动作（发送/写入）
  | 'archived'        // 归档
  | 'failed'          // 处理失败
```

### 4 种 type 的扩展字段

（见 [semantic-map.md §3](./semantic-map.md) 中每个 screen 的 data schema）

### Memory

```ts
interface Memory {
  id: uuid,
  user_id: uuid,
  level: 'L1' | 'L2' | 'L3',
  type: 'person' | 'project' | 'preference' | 'event' | 'fact',
  subject: string,                     // "蔡哥"
  content: string,                     // "Linear Capital 合伙人..."
  confidence: number,

  last_confirmed_at: timestamp,        // 最后被用户/Agent 确认
  last_referenced_at: timestamp,       // 最后被用来生成 context

  source_card_ids: uuid[],             // 这条记忆来自哪些卡

  // L2/L3 由多条 L1 consolidate 而来
  consolidated_from: uuid[],

  created_at: timestamp,
  updated_at: timestamp
}
```

### Project

```ts
interface Project {
  id: uuid,
  user_id: uuid,
  name: string,
  description: string,                 // 用于语义归属
  status: 'active' | 'archived',
  created_at: timestamp
}
```

### ChatMessage（卡片内对话）

```ts
interface ChatMessage {
  id: uuid,
  card_id: uuid,
  role: 'user' | 'agent',
  content: string,                     // markdown 允许
  created_at: timestamp,

  // 仅 agent 消息
  referenced_result_version: number | null,
  triggered_result_update: boolean,
  suggested_actions: SuggestedAction[] | null
}
```

---

## 4. API 概览（REST + WebSocket）

### REST

```
# 卡片
GET    /cards                          # 列表 · 支持 ?today / ?project / ?type / ?search / ?cursor
GET    /cards/{id}                     # 详情
PATCH  /cards/{id}                     # 部分更新（state, project_id 等）
DELETE /cards/{id}                     # 归档

# 卡片内对话
GET    /cards/{id}/chat                # chat messages 列表
POST   /cards/{id}/chat                # 发新消息 · SSE/streaming 返回

# 卡片操作
POST   /cards/{id}/execute-action      # body: {action_id, params}
POST   /cards/{id}/spawn               # 从灵感生成指令

# 长录音的 sub-entities
PATCH  /cards/{id}/action-items/{item_id}   # 勾选

# 音频
POST   /audio/upload                   # 见阶段 2

# 用户
GET    /me
GET    /me/digest?date=2026-04-09      # 今日速览数据

# 戒指
GET    /ring/status
POST   /ring/sync                      # 同步设置 / 推送固件

# Projects
GET    /projects
POST   /projects
PATCH  /projects/{id}

# Memories（可选暴露）
GET    /memories?subject=蔡哥          # 用于 Profile 里的记忆管理
PATCH  /memories/{id}                  # 纠正
DELETE /memories/{id}
```

### WebSocket（用户连一个长链）

```
ws /stream?token=...

# 服务器 → 客户端事件
event card.created            # 新卡出现（pending 状态）
event card.updated            # 任意字段变更
event card.processing_progress # 指令卡的实时执行进度
event ring.status_changed     # 戒指连接/断开/电量
event memory.updated          # 记忆变更（如果要做实时记忆管理）
```

---

## 5. 关键架构决策点（需要后端定）

这些是我在梳理过程中发现的、**必须由后端+产品一起拍板**的问题：

### 决策 1 · 短录音分类策略
- 选项 A：LLM 分类器 + 低置信度时让用户 re-classify
- 选项 B：纯规则（关键词匹配）
- 选项 C：戒指不同手势（长按 vs 长按+滑动 vs 双击+按住）区分

**推荐**：A（最自然，容错最好）

### 决策 2 · Chat 触发 result 更新的机制
- 指令卡的每次新消息是否都可能触发 result 更新？
- 是所有消息都 re-run pipeline，还是 Agent 自己判断？
- 旧版本怎么存（全部存 / 只存 last N）

**推荐**：Agent 自主决定 + 每次 result 变更存 version（最多 10 版）

### 决策 3 · 记忆的用户可见性
- 完全黑盒 vs 给低调管理入口

**推荐**：Profile 里加 "记忆管理" 入口，但不做 top-level tab

### 决策 4 · Action items 的独立性
- 是 LongRecordingCard 的 sub-entity，还是独立 todo card

**推荐**：sub-entity（减少 Timeline 噪音）

### 决策 5 · 离线 / 同步策略
- 冲突怎么解决（LWW / CRDT）
- 离线录音的 cap（最多存几分钟音频在手机本地）

**推荐**：LWW for 简单字段；CRDT for chat_messages 数组；本地缓冲 cap 60 分钟音频

### 决策 6 · 实时推送还是轮询
- WebSocket vs Long polling vs Server-Sent Events

**推荐**：WebSocket（双向，可以 App 主动发戒指控制指令）

---

## 6. 前端需要做的配合工作（给后端铺路）

1. **实现 "模拟戒指" 调试按钮**（只在 dev build） — 让后端可以在没有硬件的情况下测试整条 pipeline
2. **所有 screen 的 `processing` 状态样式** — 后端推中间状态时前端才有地方展示
3. **实现 WebSocket client + 状态机** — 而不是只在 `go()` 里切屏
4. **trigger_context 的前端采集代码** — motion state, location tag, calendar events
5. **定义 error state 的 UI** — 处理失败的卡怎么展示
6. **前端本地缓存层** — 离线时也能浏览历史 timeline
7. **OAuth 流** — 连接 Notion / Linear / 日历的授权流程（前端 UI + deep link 回调）
8. **BYOK API Key 管理页** — 安全存储（Keychain）+ 测试连接按钮
