# Monostone iOS · 语意地图（Semantic Map）

给后端的一份"前端有哪些页面、页面之间怎么跳、每个页面需要哪些数据"的清单。

**版本**：v0.1 · 2026-04-09
**对应原型**：https://monostone-ios-prototype.vercel.app
**原型代码**：单文件 HTML · 10 个 screen（`s1` ~ `s10`，`s8`/`s9` 已废弃）

---

## 1. 页面清单（Screen Inventory）

| ID | 名称 | 类别 | 数据来源 | 备注 |
|---|---|---|---|---|
| `s1` | 启动 / Splash | 系统 | 无 | 只在首次启动、Profile → "重新开始引导" 时出现 |
| `s2` | 首页 Timeline | 列表 | `GET /cards?today=true&order=created_desc` | 核心页 |
| `s3` | 长录音详情 | 详情 | `GET /cards/{id}` · type=long_rec | — |
| `s4` | 指令详情 | 详情 · 可对话 | `GET /cards/{id}` · type=command + `GET /cards/{id}/chat` | Agent 对话区 |
| `s5` | 灵感详情 | 详情 · 可对话 | `GET /cards/{id}` · type=idea + `GET /cards/{id}/chat` | Agent 对话区 |
| `s6` | 日程/待办详情 | 详情 | `GET /cards/{id}` · type=todo | — |
| `s7` | 录音中 Listening | 瞬态 | 本地状态 + `WS: ring.recording_started` | 只在戒指触发录音时显示 ⚠️ 见 §5 差距 |
| `s10` | 我 Profile | 设置 | `GET /me` + `GET /ring/status` | 下属子页未实现 |

**废弃的 screen**：
- ~~`s8` 记忆图谱~~ — 记忆对用户不可见（后台自动管理）
- ~~`s9` Agent 对话~~ — Agent 沟通收进了每张卡片内部

---

## 2. 页面跳转图（Navigation Graph）

```
                          ┌──────────┐
                          │ s1 启动  │ ◄──── Profile → "重新开始引导"
                          └────┬─────┘
                               │ [开始]
                               ▼
       ┌───────────────────────────────────────────────┐
       │                                                │
       │         s2 · 首页 Timeline                    │
       │   ┌─────────────────────────────────────┐     │
       │   │ 问候 + 今日速览 + 筛选 chip        │     │
       │   │ [全部] [长录音] [指令] [灵感] [待办]│     │
       │   ├─────────────────────────────────────┤     │
       │   │ 卡片列表（按时间倒序 + 时间分段）   │     │
       │   └─────────────────────────────────────┘     │
       │   Tab Bar: [首页*] [我]                        │
       └────┬────────┬────────┬────────┬──────┬────────┘
            │        │        │        │      │
     点 rec │ 点 cmd │  点 idea│  点 todo│  点"我"tab
            ▼        ▼        ▼        ▼      ▼
        ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐
        │ s3 │  │ s4 │  │ s5 │  │ s6 │  │ s10│
        │长录│  │指令│  │灵感│  │日程│  │ 我 │
        │ 音 │  │对话│  │发散│  │待办│  │    │
        └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘
           │       │       │       │       │
        "返回"  "返回"  "返回"  "返回"  点"首页"
           └───────┴───────┴───────┴───────┘
                           ▼
                        回到 s2

       ┌──────────────────────┐
       │ s7 · 录音中 Listening │ ◄── BLE 事件：戒指开始录音（长录音双击 / 短录音按住）
       └────────┬─────────────┘
                │ 戒指停止录音 OR 用户点"取消"
                ▼
               回到 s2（新卡片会带 "processing" 状态插入列表）
```

---

## 3. 每个页面的数据需求（What data each screen needs）

### `s2` · 首页 Timeline

**路由**：`/` （应用默认首页）

**需要的数据**：
```ts
{
  greeting: string,                    // "早上好，明明"
  digest: {
    total_interactions_today: number,  // 8
    by_context: [                      // [{location:'walking',count:3},...]
      { location: 'walking'|'meeting'|'desk', count: number }
    ],
    minutes_saved_today: number,       // 47
    count_by_type: {
      long_rec: number,
      command: number,
      idea: number,
      todo: number
    }
  },
  cards: Card[],                       // 见下方 Card 数据模型
  ring_status: {
    connected: boolean,
    day_count: number                  // "第 12 天"
  }
}
```

**触发动作**：
- 点卡片 → `go(s3/s4/s5/s6)` 带 card_id
- 点 filter-chip → 纯前端筛选（数据一次性拉取全部）
- 下拉刷新 → 重新 `GET /cards?today=true`（⚠️ 原型没做，需要加）

---

### `s3` · 长录音详情

**路由**：`/card/{id}` · type=long_rec

**页面章节**（顺序）：
1. `detail-head` — type标签、标题、时长、日期、项目tag
2. `参与人` — 头像列表
3. `结构化摘要` — bullet list
4. `Action Items` — 可勾选列表（title、owner、deadline、completed）
5. `关键决策` — 决策 + 决策者
6. `本次会议学到了什么` — memory attribution（记忆更新）
7. `完整转录` — 折叠式按钮（展开后 4,281 字）
8. `detail-actions` — [分享] [投递 Notion] [发送纪要]

**需要的数据**：
```ts
LongRecordingCard {
  id: string,
  type: 'long_rec',
  state: 'ready',
  title: string,                       // AI 生成的会议主题
  duration_seconds: number,
  created_at: timestamp,
  project: { id, name } | null,

  participants: [                      // 自动识别的说话人
    { id, name, avatar_color }
  ],

  summary_bullets: string[],           // 3-5 条结构化摘要
  action_items: [
    {
      id: string,
      text: string,
      owner: string,                   // 从语音中识别
      deadline: string,                // "4月底" / "本周" / "下周前"
      completed: boolean,
      completed_at: timestamp | null
    }
  ],
  key_decisions: [
    { text: string, who: string }      // "明明主张，Linear 支持"
  ],
  memory_updates: [                    // 这次会议新增/更新的记忆
    {
      type: 'person' | 'project' | 'preference',
      content: string,
      confidence: number
    }
  ],
  full_transcript: string,             // 完整原文（默认折叠）
  audio_url: string                    // 用于未来重听
}
```

**支持的操作**：
- 勾选/取消 action item → `PATCH /cards/{id}/action-items/{item_id}`
  - ⚠️ 设计决定：勾选后这个 action item 是否在 Timeline 独立成为一张 todo 卡？目前没有，建议**否**（减少噪音）
- [分享] → 系统 share sheet
- [投递 Notion] → `POST /cards/{id}/deliver` body `{destination: 'notion'}`
- [发送纪要] → `POST /cards/{id}/send-summary` body `{format: 'email'}`

---

### `s4` · 指令详情

**路由**：`/card/{id}` · type=command

**页面章节**：
1. `detail-head` — type标签、标题（用户原话）、完成状态、用时、时间
2. `你说的原话` — 完整转录
3. `调取的上下文` — 4 项 context chips
4. `执行步骤` — 5 步 timeline
5. `产出` — 结构化结果（邮件 / 研究报告 / 等）
6. `继续和 Agent 沟通` — 对话区 + 输入框 ⭐ **核心交互**
7. `detail-actions` — [存为草稿] [发送]

**需要的数据**：
```ts
CommandCard {
  id: string,
  type: 'command',
  state: 'processing' | 'ready' | 'delivered',
  user_utterance: string,              // "帮我起草..."

  processing_time_ms: number,          // 1分42秒
  retrieved_context: [                 // AI 检索到的上下文
    {
      source_type: 'recording'|'memory'|'style'|'thread',
      ref_id: string,                  // 指向原始 card / memory entry
      label: string,                   // "今早 Series A 跟进会"
      source_label: string             // "42 分钟录音"
    }
  ],
  execution_steps: [
    {
      title: string,                   // "解析指令意图"
      detail: string,                  // "识别为邮件起草任务"
      duration_ms: number,
      status: 'done' | 'running'
    }
  ],
  result: {
    type: 'email' | 'research' | 'outline' | 'code' | ...,
    content: any,                      // 具体 schema 根据 type 不同
    version: number                    // 经过多少次 chat 迭代
  },
  versions: [...]                      // 历史版本（用于 "回到上一版"）
  chat_messages: ChatMessage[],        // 见下方 ChatMessage
  available_actions: [                 // 基于 result.type 动态决定
    { id: 'send_email', label: '发送', primary: true },
    { id: 'save_draft', label: '存为草稿' }
  ]
}

ChatMessage {
  id: string,
  card_id: string,
  role: 'user' | 'agent',
  content: string,
  created_at: timestamp,
  triggered_result_update: boolean,    // 这条消息是否导致 result 更新
  referenced_result_version: number
}
```

**支持的操作**：
- 发送新消息 → `POST /cards/{id}/chat` body `{content}` → WS 推送 agent 回复 + 可能触发 result 更新
- [存为草稿] → `PATCH /cards/{id}` state→'delivered'
- [发送] → `POST /cards/{id}/execute-action` body `{action_id: 'send_email'}`

---

### `s5` · 灵感详情

**路由**：`/card/{id}` · type=idea

**页面章节**：
1. `detail-head` — type标签、标题、场景（走路时）、时间、时长
2. `原声` — 播放按钮 + 波形 + 时长
3. `转写文本` — AI 清理过的可读版本
4. `自动归属` — 项目 badge + confidence
5. `相关的过往灵感` — 3 条关联卡片（核心：展示 Context 复利）
6. `和 Agent 一起发散` — 对话区 + 输入框 ⭐ **核心交互**
7. `detail-actions` — [归档] [加入项目]

**需要的数据**：
```ts
IdeaCard {
  id: string,
  type: 'idea',
  state: 'ready',
  title: string,                       // 从转写中抽取的短标题
  trigger_context: {
    location: 'walking'|'driving'|'desk'|...,
    duration_seconds: number
  },
  raw_audio_url: string,
  raw_transcript: string,              // ASR 直出
  cleaned_transcript: string,          // LLM 清理版（更好读）
  auto_project: {
    id: string,
    name: string,
    confidence: number                 // 0.94
  } | null,
  related_cards: [                     // 语义检索得到
    {
      card_id: string,
      card_type: 'idea'|'long_rec'|'command',
      similarity: number,              // 0.87
      snippet: string,                 // 预览文本
      relative_time: string            // "3 天前"
    }
  ],
  chat_messages: ChatMessage[]         // 同 s4
}
```

**支持的操作**：
- 播放音频 → `GET raw_audio_url`
- 发送新消息 → 同 s4
- [归档] → `PATCH /cards/{id}` state→'archived'
- [加入项目] → 打开项目选择器 → `PATCH /cards/{id}` project_id

---

### `s6` · 日程/待办详情

**路由**：`/card/{id}` · type=todo

**页面章节**：
1. `detail-head` — type标签（日程/待办）、标题、捕捉时间
2. `你说的原话` — 原句
3. `解析结果` — 标题/时间/地点/提醒/重复（dl 结构）
4. `已写入` — 目标系统图标 + 同步状态
5. `冲突检测` — 时间段冲突分析
6. `detail-actions` — [修改时间] [取消] [完成]

**需要的数据**：
```ts
TodoCard {
  id: string,
  type: 'todo',
  sub_type: 'calendar_event' | 'reminder' | 'task',
  state: 'ready' | 'delivered' | 'done' | 'cancelled',
  user_utterance: string,
  parsed: {
    title: string,
    datetime_start: ISO8601 | null,    // null = 无具体时间的待办
    datetime_end: ISO8601 | null,
    location: string | null,
    attendees: string[],
    reminders: number[],               // [60, 10] = 提前 60 分钟、10 分钟
    repeat_rule: string | null         // RFC5545 RRULE
  },
  written_to: {
    system: 'apple_calendar' | 'linear' | 'todoist' | ...,
    external_id: string,
    external_url: string,
    synced_at: timestamp
  },
  conflict_check: {
    has_conflict: boolean,
    conflicts: [{ event_title, overlap_duration }]
  }
}
```

**支持的操作**：
- [修改时间] → 打开时间选择器 → `PATCH /cards/{id}` parsed.datetime_*
- [取消] → `PATCH /cards/{id}` state→'cancelled' + `DELETE` 外部系统的事件
- [完成] → `PATCH /cards/{id}` state→'done'

---

### `s7` · 录音中 Listening

**触发**：戒指端事件（BLE → 手机 → App）

**页面章节**：
1. `listening-state` — "正在聆听"
2. `wave` — 音频波形动画
3. `ctx-loaded` — "已加载上下文 · Series A"
4. `ctx-chips` — 3 个相关 chip
5. `stop-btn` — 停止按钮

**需要的数据**：
```ts
{
  recording_session_id: string,
  started_at: timestamp,
  loaded_context: {                    // 系统自动加载的上下文
    primary_project: string,           // "Series A"
    relevant_chips: [                  // 基于当前时间/位置/最近活动
      { label: string, ref: string }
    ]
  },
  audio_level: number                  // 实时音量（用于波形）
}
```

**支持的操作**：
- 用户点停止按钮 → 发送停止指令到戒指 + 本地停止缓冲
- 戒指自己停止（双击）→ 同上
- 长按戒指释放（短录音） → 自动停止

---

### `s10` · 我 Profile

**页面章节**：
1. `profile-head` — 头像、姓名、订阅 plan
2. `profile-ring` — 戒指状态（已连接/第 N 天/电量）
3. `list-group` 1 — 日历与提醒 / 投递目标 / API Key
4. `list-group` 2 — 隐私与数据 / 导出所有数据 / 高级设置
5. `list-group` 3 — 重新开始引导

**需要的数据**：
```ts
{
  user: { id, name, email, avatar_url, plan: 'Free'|'Pro'|'Max' },
  ring: {
    id, connected: boolean, days_since_pairing: number,
    battery_percent: number, firmware_version: string
  },
  integrations: {
    calendars: [{ system, account_email, status }],
    destinations: [{ system, status }],
    api_keys: [{ provider: 'openai'|'anthropic'|..., configured: boolean }]
  }
}
```

⚠️ **差距**：所有 list-row 目前都是死链，子页面未实现。后端需要对应的 endpoints，但前端也要补页面。

---

## 4. Tab Bar 全局结构

```
┌─────────┬──────┐
│  首页    │  我   │
└─────────┴──────┘
```

只在 `s2` 和 `s10` 显示。其他 screen（s3~s7）都有 navbar（`[返回] [···]`）代替 tabbar。

**设计决策**：只保留 2 个 tab，原因：
- 记忆对用户不可见（后台自动管理）
- Agent 对话收进了每张卡片内部（不独立 tab）
- 这回应了 D-Day 时 Linear 那句 "closed-loop, not infra"

---

## 5. 已知差距 & 未解决的问题（给后端参考）

### 关键缺失的 UI
1. **`s7` Listening 的进入路径不明确** —— 原型里没有 FAB 录音按钮。真实产品里这个 screen 只能由戒指 BLE 事件触发。**后端/固件协议**需要定义：戒指按键事件如何通过 BLE 推送给手机 App。
2. **无 Projects 页** —— 卡片有项目 tag（Series A / Monostone 后端…）但用户无法浏览某个项目的所有卡片。**建议**：点击卡片的项目 tag → 进入 Projects view（按项目筛选的 timeline）。
3. **无 Search** —— 30 天 312 次交互，用户肯定需要搜。需要一个全局 search 入口（建议放 s2 顶部）。
4. **Profile 的子页全部是死链** —— 日历配置 / OAuth 投递目标 / BYOK API Key / 隐私设置 / 数据导出，都需要实现。
5. **没有 "processing" 状态的卡片样式** —— 当前原型的 "执行中" Sandbar research 卡片其实是直接展示，但真实产品里，长录音、灵感、待办在上云期间也需要有一个中间态展示（转写中 / 处理中）。

### 数据流歧义
6. **短录音分类（command / idea / todo）怎么做？** —— 同样是 "按住戒指说话"，系统如何区分？建议方案：
   - LLM 分类器基于转写内容判断（关键词 + 上下文）
   - 置信度低时，在卡片上显示 "分类调整" affordance 让用户可以 re-classify
   - ⚠️ **这是个架构决策，后端必须定**
7. **"你今天 3 次走路时 / 2 次会后 / 3 次电脑前"** —— 这个场景分类数据哪里来？需要：
   - 戒指或手机提供 accelerometer / motion 数据
   - 或读取手机日历判断 "会后"
   - 或 GPS 判断 "电脑前 = 家/公司"
   - **目前数据源不明**，后端需要定义这个 enrichment pipeline
8. **Action Items 的归属** —— 长录音里的 Action Items 是 **sub-entity**（属于 LongRecordingCard），还是**独立 todo 卡**？**建议**：sub-entity，勾选后只更新会议卡的状态，不在 Timeline 独立成卡。
9. **Chat messages 与 result 的版本关系** —— 用户在指令卡片里说 "GTM 段展开"，新生成的邮件草稿是覆盖旧的还是新增版本？**建议**：保留 versions，UI 默认展示 latest，但允许 "回到上一版"。
10. **长录音详情没有音频播放** —— 原型里只有 "完整转录" 折叠按钮，没有时间轴 + 播放。**建议**补：timeline-based 音频 player，配合 action items 带时间戳跳转。

### 记忆层的问题
11. **记忆 Tab 删了，但记忆本身还要让用户可见/可控吗？** —— 长录音详情有 "本次会议学到了什么"，但用户无法：
    - 查看所有累积的记忆
    - 纠正错误的推断
    - 删除不希望记住的事
    - 决定哪些记忆可以被 Agent 调取
    **这是产品哲学问题**：是让记忆完全黑盒（极简但失控风险高），还是给一个低调入口（在 Profile 里）？**建议**：在 Profile 里加 "记忆管理" 入口，但不做成 top-level tab。

### 状态同步
12. **iOS 和 macOS 双端同步** —— 产品规划有 macOS App，但原型只是 iOS。**后端的数据模型必须 device-agnostic**，所有 card / chat / memory 都需要 last_modified_at + version 字段支持 CRDT 或 LWW 合并。
13. **离线录音如何处理** —— 戒指录音时手机没网，音频数据需要在手机本地缓冲直到网络恢复。卡片需要 `pending_upload` 状态。
14. **实时 push** —— 云端处理完一张卡片后，首页 Timeline 如何知道？需要 WebSocket 推送机制。建议事件：`card.created` / `card.updated` / `card.processing_progress`。

---

## 6. 前端还要补的 UI（按优先级）

1. **P0** · `s7` 进入路径文档化 —— 至少要有一个"模拟戒指"的调试按钮，方便后端联调
2. **P0** · 卡片的 `processing` 状态样式 —— 不然后端推进来的中间态没处展示
3. **P0** · Profile 里的各个子页（至少做 Integrations / API Key / Privacy 三个）
4. **P1** · Projects view（点项目 tag 进入）
5. **P1** · Search bar
6. **P2** · 长录音的音频 timeline player
7. **P2** · Memory 管理入口（在 Profile 里）
