---
milestone: M2
deadline: 2026-05-04
status: draft
backend-services:
  - agent-orchestrator-service
  - timeline-service
  - plugin-runtime-service（调用 calendar-create-event-plugin / email-sender-plugin）
  - llm-worker（短录音分类）
ios-views:
  - HomeView（command / todo 卡片）
  - CommandDetailView
  - TodoDetailView
  - AgentView（inline chat 关联）
linear-issues: [MON-16, MON-17, MON-18, MON-19, MON-20, MON-21, MON-22]
---

# M2 · Agent 执行指令 + 待办事项 产品定义

> 林啸读完这份文档，应该能实现 monostone-app command/todo 卡片 + 改 monostone_backend 的 `agent-orchestrator-service` / `timeline-service` / 调用 `plugin-runtime-service` 的相关链路。

## 1. Milestone 范围

**包含**
- 短录音分类：command / todo / idea / longRec（后端 llm-worker 决定）
- command 卡片：邮件 / 日历 / Linear 等执行（通过 `agent-orchestrator-service` → `plugin-runtime-service`）
- todo 卡片：时间地点解析 + 写 Apple 日历（EventKit）
- command 执行结果回写 + Live Activity 进度
- 详情页交互（toast / 撤销 / 重试）

**不包含**
- 长录音 detail（→ M1）
- Memory prompt（→ M3）
- Plugin 商店 / manifest / sandbox（→ M4）

## 2. Backend 模块对齐

### 短录音 → 卡片类型链路

```
iOS POST /multimodal/inputs (短录音)
  │
  └─→ batch-asr-worker → llm-worker
        ├─ recording-mode-router prompt 决定类型
        │    （docs/prompts/llm-worker/recording-mode-router.md）
        ├─ 类型 = command: 写 understanding artifact, 包含 command 草稿
        └─ 类型 = todo: 写 understanding artifact, 包含 parsed time/location
        │
        └─ post-recording-coordinator
             ├─ command 类型 → 创建 /agent/tasks (type=command_execute)
             ├─ todo 类型 → 写 /timeline/events (kind=todo) + 触发 EventKit 写入
             └─ 同时写 memory
```

### Agent 执行 command（参考 backend report §agent 模块）

```
agent-orchestrator-service
  ├─ POST /agent/tasks 创建任务
  ├─ planner 选 plugin（依赖 PLUGIN_RUNTIME_BASE_URL）
  ├─ POST /internal/plugins/{plugin_id}/execute-active
  │    ↓
  │  calendar-create-event-plugin（CALENDAR_CREATE_EVENT_REAL_SEND）
  │  或 email-sender-plugin（EMAIL_SENDER_ENABLED, EMAIL_SENDER_SOURCE_EMAIL）
  │
  ├─ 需要用户确认: GET /agent/tasks/{id}/confirmations/pending
  │                POST /agent/tasks/{id}/confirmations/{cid}
  │
  └─ trace 写入 (/traces/* 仅调试，iOS 不直接调)
```

### 涉及的 first-party plugins
- `calendar-create-event-plugin` — 日历事件创建（已部署 dev Pod）
- `email-sender-plugin` — 邮件发送（已部署 dev Pod，AWS SES）

## 3. iOS 用户旅程

### 3.0 HomeView · 4 类卡片形态总表（MON-34）

> 收口：v0.5 极简 HomeView (MON-32 锁定) — 卡片只显示 type chip + title + meta-min 一行。下表是 4 类（+ 长录音）卡片的视觉差异 + 5 状态映射。

**4 类型颜色规范（已是现状，不动）**：

| type | color var | 色值 | 用在哪 |
|---|---|---|---|
| `command` (cmd) | `--t-cmd` | `#A295D0` 紫 | type chip + filter-chip |
| `cal` 日程 | `--t-todo` | `#7FC090` 绿（复用） | type chip + filter-chip |
| `todo` 待办 | — | `#b49b7c` 暖灰 | type chip（MON-20 新加） |
| `idea` 灵感 | `--t-idea` | `#d4a868` 暖黄 | type chip + filter-chip |
| 长录音 (rec) | `--text-dim` | 灰 | 默认无独立 chip 色 |

**meta-min 5 状态文案（已锁定 MON-32）+ 卡片右上角小圆点**：

| status | meta-min 文案 | 颜色 | 右上 dot |
|---|---|---|---|
| done（默认）| `{2 小时前}` / `{昨天 22:14}` | `--text-dimmer` | 无 |
| pending | `排队中` | `--text-dim` | 无 |
| executing / processing | `处理中 · 还剩 {X} 分钟` 或降级 `处理中` | `--text-dim` | 橙 pulse（仅录音处理链路） |
| needs_input | `需要确认 · {time}` | `#d4a868` 暖黄 | 暖黄静止（`.dot-warn`） |
| failed | `失败 · 点击重试 · {time}` | `--red` | 红静止（`.dot-err`） |

**特殊状态（cal/todo 写入失败 — MON-21 §E3）**：
- `cal` EventKit 写入失败 → meta `未加入日历 · 需权限` (`--red`)
- `todo` EKReminder 写入失败 → meta `未加入提醒事项 · 需权限` (`--red`)
- 默认成功不标，仅失败显示警告（避免冗余）

**即将开始的 cal（MON-21 / MON-34 拍板）**：
- **不在 HomeView 上浮 / 染色**（明明 2026-05-07 拍板：home feed 不引入新视觉）
- "即将开始" 提醒只走外置通道：**push notification + 桌面小组件**
- 1h 内即将开始 → push 一次 + widget SCHEDULED 区域显示

**改类型入口**（误分类纠正，MON-18 锁定 + MON-21 收口）：
- 仅在详情页 navbar `···` overflow menu 里
- HomeView 卡片**不引入长按 / 滑动手势**（极简）
- 改完 toast `已改为 {type} · Agent 会学习`

### 3.1 短录音 → command（邮件）
1. FAB 快点录音 "帮我写封 follow-up 邮件给敦敏"
2. 后端分类 = command, 创建 `/agent/tasks`
3. iOS 收到 task → 插入 command 卡片到 home（processing）
4. Agent 起草邮件 → confirmation pending → iOS 在 CommandDetailView 显示草稿可编辑
5. 用户改完点"发送" → `POST /agent/tasks/{id}/confirmations/{cid}` (confirm=true)
6. plugin-runtime → email-sender → 发送
7. iOS 显示 done + toast

### 3.2 短录音 → cal（有具体时间，写 Apple 日历）
1. FAB 快点录音 "提醒我周五下午三点和林啸开会"
2. 后端分类 = cal（recording_mode v3）+ cal_parse 解析时间地点
3. 后端写 `/timeline/events` (kind=cal, scheduled_at=2026-05-08T15:00)
4. iOS 收到 timeline event → 插入 cal 卡片
5. iOS 询问 EventKit 权限 → 写 Apple 日历 (EKEvent)
6. Smart Brief 异步生成；冲突由 brief 内嵌红色段表达

### 3.3 短录音 → todo（无具体时间，写 Apple 提醒事项）
1. FAB 快点录音 "把那本书还给舟舟"
2. 后端分类 = todo（recording_mode v3）+ 解析任务标题
3. 后端写 `/timeline/events` (kind=todo)
4. iOS 收到 timeline event → 插入 todo 卡片
5. iOS 询问 EventKit 权限 → 写 Apple 提醒事项 (EKReminder)
6. Smart Brief 异步生成（Agent 自由判断提醒形式 + 提供 context，不写固定时间）

> **cal vs todo 边界**：唯一差异是"有没有具体时间"。
> 用户视角：cal 卡显示时间字段；todo 卡时间字段写"无具体时间"，提醒由 Agent 智能决定。
> iOS 写入：cal → EKEvent；todo → EKReminder。
> 视觉框架：完全相同（4 段：head / 卡本体 / Smart Brief / 已写入），仅 §B / §D 内容不同。

## 4. 页面级 spec

### 4.1 CommandDetailView · 通用 Command 详情页（v0.5 邮件 + 日历，未来吃所有 plugin / MCP）

> **核心定位**：这页不是"邮件页"或"日历页"，而是**所有 plugin/MCP 调用的统一详情页**。v0.5 的邮件和日历只是这套通用契约的两个具体实例。未来加 Notion / Slack / Linear / 任意 MCP 工具，**这页代码不再改**，只加一行配置。

#### 4.1.0 不可妥协的极简哲学（拍板自 2026-05-03 讨论）
- **永远只有 2 个底部按钮**（needs_input 时）：`拒绝` / `允许`。砍掉所有 plugin-specific 按钮（不再有"发送"/"加入日历"/"创建 issue" 等差异）
- **产出永远是单一渲染**：模型输出 Markdown，前端只 1 个 markdown renderer 吃所有 plugin。砍掉 R1/R2/R3 多模板设计
- **没有 inline chat**：草稿不满意 → 拒绝 → 在 AgentView 主对话补一句 → Agent 起新 task。不在 detail 页内对话
- **没有"继续和 Agent 沟通"、"语音补充"、"上一版"按钮**：detail 页是纯静态 + 2 按钮
- **执行步骤只在 executing/failed 状态显示**，done 态完全隐藏
- **Head 只 3 件事**：类型 chip · 标题 · 状态。砍掉用时、相对时间。reclass-picker 移到 `···` 菜单（不污染 head）

#### 4.1.1 五段结构（所有状态、所有 plugin 通用）

| § | 内容 | 全状态显示 | 数据来源 |
|---|---|---|---|
| **A. Head** | `[类型 chip]` + 标题 + 状态 badge | ✅ | task.title / status |
| **B. 你说的原话** | 用户语音转写的原句（quote-said 样式） | ✅ | task.user_input_text |
| **C. 上下文** | Agent 调取了哪些 source（最多 4 行 + 省略号） | ✅ | task.contexts[] |
| **D. 执行步骤** | Agent 内部 step list | **仅 `executing` / `failed`** | task.steps[] |
| **E. 产出** | 模型输出的 Markdown | **`needs_input` / `done`** | task.output.display_markdown |

底部固定区域 `detail-actions`：
- `needs_input` → `[拒绝]` `[允许(primary)]`
- `executing` → `[取消执行(danger)]`
- `done` / `failed` / `pending` → **整条 actions 区域 `display:none`**

#### 4.1.2 §A Head 精确规范

```html
<div class="detail-head cmd">
  <span class="type">指令</span>             <!-- 永远是"指令"，type 标签不变 -->
  <div class="ti">{task.title}</div>          <!-- 模型生成的简短标题 -->
  <div class="status [waiting|executing|failed|]">
    <span class="dot"></span>{status_text}
  </div>
</div>
```

| status | text | color | dot 行为 |
|---|---|---|---|
| `pending` | "排队中" | `--text-dim` | 静止 |
| `executing` | "执行中" | `--t-cmd` | pulse 动画 |
| `needs_input` | "等待你确认" | `#a07a2a`（暖黄） | 静止 |
| `done` | "已完成" | `--text-dim` | 静止 |
| `failed` | "失败" | `--red` | 静止 |

reclass-picker（重新归类成"灵感/待办"）放在 navbar 右上 `···` overflow menu 里，**不在 head 里**。

#### 4.1.3 §C 上下文 — 最多 4 行 + 省略

**类型只有两类**（明明 2026-05-03 拍板）：

| 来源 | 包括什么 |
|---|---|
| **卡片** | 用户已有的 timeline 卡片 — 长录音 / 指令 / 灵感 / 待办 |
| **Memory** | Memory 系统 — Preference、人际关系、MCP 协议从外部 app（邮件/日历/Notion 等）拉进来整合到 Memory 的内容 |

**视觉极简 V2.1 改动（2026-05-03 二次拍板）**：行内不再有左侧彩色 chip，只保留右侧灰色 `.src` 文本。"卡片 vs Memory" 的区分**完全靠右侧 .src 文本承载**：
- 卡片类 → 右侧显示具体子信息（`42 分钟录音` / `指令` / `灵感` / `待办`）
- Memory 类 → 右侧固定显示 `Memory`

**精确文案模板**（极简 — 只让用户知道"系统调取了什么"，不暴露具体 preference 名 / 人名 / 条目名，保护隐私 & 减认知负担）：

| 来源子类 | 标题（≤ 10 字，简短说明是什么事） | 右侧 .src |
|---|---|---|
| 长录音卡 | `{长录音简短主题}` | `{N} 分钟录音` |
| 指令卡 | `{指令简短主题}` | `指令` |
| 灵感卡 | `{灵感简短主题}` | `灵感` |
| 待办卡 | `{待办简短主题}` | `待办` |
| **Preference** | `{Agent 自动生成的简短描述，不写"偏好"两字}` | `Memory` |
| **人际关系** | `{Agent 自动生成的简短描述，不写人名}` | `Memory` |
| **MCP 外部数据** | `{Agent 自动生成的简短描述}` | `Memory` |

> **关键设计**：Memory 类的标题由模型自动生成成"系统在用什么帮你"的简短描述（如"敦敏的投资人档案"、"你的邮件语气"），**不透出原始字段名**（不显示 "preference: communication_tone" / "person: 敦敏"），保护可读性。

**4 行 + 省略行为**：
- 上下文 ≤ 4 项：全列出
- 上下文 > 4 项：前 4 项 + 居中 `… 还有 {N} 项 ›` 链接，点击进 fullscreen sheet 看全部

#### 4.1.4 §D 执行步骤 — 状态条件渲染

```swift
var showSteps: Bool {
    status == .executing || status == .failed
}
```

- `executing` → 实时刷新 step list，当前 step 用 pulse dot
- `failed` → 步骤定格，标红出错那步，配"重试"入口（重试入口的具体 UX 后面讨论）
- 其他状态 → `.sec` 整段不渲染

#### 4.1.5 §E 产出 — 双层 contract（display vs structured）

**所有 plugin 输出统一格式**（ux0.5 的核心约定）：

```jsonc
{
  "output": {
    "display_markdown": "...",   // 用户看到的 100% 是它
    "structured_payload": {...}   // 真正发给 plugin 的字段，用户不可见
  }
}
```

- 前端：**只渲染 `display_markdown`**。Markdown 里允不允许写 `**收件人** cai@...` 这种表达由模型决定，不强制 schema
- 后端：执行时用 `structured_payload`（保证邮件不发错收件人 / 日历不建错时间）
- Prompt 工程负责保持两者一致

**v0.5 内置 markdown 渲染支持**：`p`, `h1-3`, `b/strong`, `i/em`, `ul/ol/li`, `hr`, `code`, `br`。不支持表格 / 图片 / 链接（v0.5 不需要）。

**MCP plugin 接入 v0.6+**：plugin 只要实现 `display_markdown` + `structured_payload` 输出，**这页代码 0 改动**自动支持。

#### 4.1.6 §G 底部按钮 — 永远 2 按钮

`requires_consent` **由模型在 understanding/planning 阶段判断**：

| 操作类型 | requires_consent | 进入哪个状态 |
|---|---|---|
| 写 / 发送 / 创建 / 修改外部数据（邮件、日历、Linear、转账、文件改） | `true` | needs_input → 用户允许后才执行 |
| 删除（任何东西） | `true` | needs_input |
| 纯读取 / 查询 / 搜索 / 翻译 / 总结 | `false` | executing → done（不停） |
| 只写 Memory | `false` | executing → done |

**v0.5 在前端 hardcode 邮件/日历 = `true`**，未来 plugin manifest 加 `requires_consent: bool` 字段，模型判断不准时由 manifest 兜底。

**按钮文案永远固定**：

| status | actions |
|---|---|
| `needs_input` | `[拒绝]` `[允许(primary)]` |
| `executing` | `[取消执行(danger)]` |
| `failed` | `[拒绝]` `[重试(primary)]`（拒绝 = 放弃这个 task；重试 = 同 plan 重跑） |
| `done` / `pending` | actions 区域 `display:none` |

**拒绝时收集"原因"**：弹一个简单的语音/文字输入"告诉 Agent 哪里不对" → 这条 feedback 写到 AgentView 主对话流（不在 detail 页对话），Agent 在主对话里决定要不要起一个新 task 重做。

#### 4.1.d 后端依赖检查表 ✅ 零改动 / ⚠️ 需要后端配合

| 项 | 状态 | 备注 |
|---|---|---|
| `GET /agent/tasks/{id}` 拿 status / contexts / steps / output | ✅ 零改动 | 现有 endpoint |
| `/agent/tasks/{id}/confirmations/*` 允许/拒绝 | ✅ 零改动 | 现有 endpoint，复用 |
| Plugin output 包含 `display_markdown` 字段 | ⚠️ **需要 prompt 调整** | `understanding-prompt` + `agent-orchestrator` 的 plugin output 模板加这个字段。**不动 service 架构**，只改 prompt |
| Plugin output 包含 `structured_payload` 字段 | ✅ 零改动 | 现有 plugin 输出已是结构化 JSON，复用 |
| `task.contexts[]` 每项带 `source_type: "card" \| "memory"` | ⚠️ **需要确认** | 林啸看 `agent-orchestrator-service` context retrieval 现状是否已经分类，没有就在 trace 写入时加一个 enum 字段（schema 加字段，不改架构） |
| `task.contexts[]` 每项带 `display_title` (Agent 生成的简短描述) | ⚠️ **需要 prompt 调整** | 同上，让 retrieval prompt 输出"系统在用什么帮你"的人话标题，而不是原始 entity name |
| `understanding` 输出 `requires_consent: bool` | ⚠️ **需要 prompt 调整** | recording-mode-router prompt 加这个字段；v0.5 前端可以 hardcode 邮件/日历 = true 兜底 |
| 任务状态机 `pending / executing / needs_input / done / failed` | ✅ 零改动 | 现有 task status enum 已覆盖 |
| 砍掉 `/agent/tasks/{id}/turn` (inline chat) 调用 | ✅ 减少调用 | detail 页不再调，但 endpoint 保留给 AgentView 主对话用 |

**总结**：3 处后端改动，**全部是 prompt 层 / output schema 加字段**，不动 service 架构。比"为每个 plugin 各写一个 detail 渲染器"省得多。林啸自己单边改 prompt 即可。

#### 4.1.7 v0.5 显式排除清单（写入 spec 防 scope creep）

- ❌ research / web search 类 command（cmd-2 mock 仅作 executing 态参考，**v0.5 不上线**）
- ❌ Linear / Slack / Notion 等 third-party plugin
- ❌ multi-step planner（v0.5 一律 single-tool 调用）
- ❌ 发送后撤回（一旦点"允许"不可撤）
- ❌ 草稿版本管理 / 历史版本切换
- ❌ detail 页内编辑草稿（任何修改走 AgentView 主对话）

#### 4.1.8 ux05 prototype 对应 mock

| mock id | 状态 | 用途 |
|---|---|---|
| `cmd-1` | done · 邮件 | 完成态参考（无步骤、无按钮） |
| `cmd-2` | executing · research | 执行态参考（含步骤；research 本身 v0.5 不上线，仅演示 layout） |
| `cmd-3` | needs_input · 邮件 | 等待确认态（拒绝/允许 按钮） |

**指令 vs 日程 边界（2026-05-04 与明明对齐）**：
- "约会议 / 创建日历事件" 类 = **日程**（MON-17 / 4.2 节），**不是指令**
- 之前 cmd-4 (calendar create) mock 已删除，因为是分类错误
- v0.5 指令 cmd 类只剩 **邮件发送** 一种 plugin（其他 plugin 在 v0.6+ 接入 MCP 时自动 cover 通用契约）

### 4.2 CalendarDetailView · Smart Calendar 详情页（v0.5 核心差异化）

> **重新定位（2026-05-03 与明明拍板）**：v0.5 不存在 "todo / 待办" 类型；语音里说"提醒我 X 时 Y"全部归到「日程」。日程不是普通日历事件，而是 **Smart Calendar** —— 模型在理解用户意图后，**带着 context 帮用户准备这个日程要做的事**（送什么礼、带什么文档、对方偏好、风险提醒等）。

#### 4.2.0 概念厘清

| 概念 | 定义 | v0.5 |
|---|---|---|
| 普通日历 | 时间 + 标题 + 地点 | ❌ 不是这个 |
| **Smart Calendar（v0.5 做的）** | 时间 + 标题 + 地点 + **Agent 自动生成的"为这件事你需要知道/准备什么"** | ✅ 这是 Monostone 在日历场景的护城河体现 |
| Todo / 待办 | "周五前完成 X" 这种无具体时间点 / 任务追踪导向 | ❌ v0.5 not in scope（语音里这种诉求归"指令"，让 Agent 提醒别人） |

**Context 复利在日历的具象**：你跟某人/某事的过往交互越多，下一次相关日程的 Smart Brief 越精准。

#### 4.2.1 Detail 页结构（4 段，无 emoji）

```
┌─────────────────────────────────┐
│ [日程] 舟舟生日                 │
│ 已加入日历                      │     ← §A Head（极简 3 件事）
├─────────────────────────────────┤
│ 时间    9 月 9 日（下周二）全天 │
│ 参与人  舟舟                    │     ← §B 日历卡本体（structured）
│ 提醒    提前 1 天               │
├─────────────────────────────────┤
│ [Agent 写的 markdown brief]     │     ← §C Smart Brief
│ 舟舟最近一次跟你聊...           │       async loading
│ 要不要送她原研哉的作品集？...   │
├─────────────────────────────────┤
│ [icon] 已加入 Apple 日历 [打开] │     ← §D 已写入标识（明明强调要保留）
└─────────────────────────────────┘
```

| § | 内容 | 必出 | 数据源 |
|---|---|---|---|
| **A. Head** | 类型 chip + 标题 + 状态 badge | 永远 | task |
| **B. 日历卡本体** | 时间 / 地点 / 参与人 / 提醒（无值的字段不显示） | 永远 | task.calendar_event |
| **C. Smart Brief** | Agent 写的 markdown brief，async loading | 永远（loading 中显示 shimmer） | task.output.display_markdown |
| **D. 已写入标识** | `已加入 Apple 日历` + `打开` 按钮（跳系统日历） | 写入成功后 | EventKit 写入回调 |

**砍掉的内容**（之前 todo detail 的）：
- ❌ "你说的原话"（日历卡不需要回放原话）
- ❌ "上下文" 4 行 chip section（这是 cmd 的设计；日程不在 detail 里展示 context，context 体现在 brief 文字里）
- ❌ "解析结果" parse-grid（结构化字段直接在 §B 显示）
- ❌ "冲突检测" 独立 section（冲突变成 §C brief 里的红色顶段）
- ❌ reclass-picker（移到 navbar `···` 菜单）
- ❌ inline chat / 继续和 Agent 沟通

#### 4.2.2 §A Head 状态映射

| status | text | color |
|---|---|---|
| `parsing` | 排队中 | `--text-dim` |
| `parse_failed` | 时间未识别 · 在 AgentView 补充 | `--red` |
| `brief_loading` | 已加入日历（brief 在生成） | `--text-dim` |
| `synced` | 已加入日历 | `--text-dim` |
| `removed` | 已从日历移除 | `--text-dimmer` |

#### 4.2.3 §B 日历卡本体 — 字段集

只 4 个字段，无值的字段不显示这一行：

| 字段 | 显示规则 | 示例 |
|---|---|---|
| 时间 | `{月日}（{周几}）{时间段}` 或 `{月日}（{周几}）· 全天` | `9 月 9 日（下周二）· 全天` / `6 月 12 日（周三）14:00 – 15:00` |
| 地点 | 原文 | `静安区` / `会议室 A` |
| 参与人 | 逗号分隔，**只有自己时不显示这一行** | `林啸、明明` |
| 提醒 | 多个用 `·` 分隔 | `提前 1 小时` / `提前 1 天` |

**砍掉的字段**：项目、负责人、优先级、截止日期、重复 — 这些是 todo/issue 概念，Smart Calendar 不要。

#### 4.2.4 §C Smart Brief — 核心差异化

**Brief 的两个维度（v0.5 锁定 = B 方案）**：

| 维度 | 干什么 | 数据源 |
|---|---|---|
| **B1. context** | 关于这个人 / 这件事的过往精华 | Memory（聊天、灵感、过往 cmd） |
| **B2. 准备建议** | 送什么礼 / 带什么文档 / 注意什么 | Memory + 模型推断 |

**v0.5 显式不做**：
- ❌ B3 实务信息（天气 / 路程 / 周边推荐）— 不接外部 MCP
- ❌ B4 风险/雷点单独维度（融在 B1/B2 文字里即可）

**渲染规范**：
- **单一 markdown** 渲染（复用 MON-16 双层 contract: `display_markdown` + `structured_payload`）
- **像朋友/助理说话**，不要技术术语；不要 sec-title，brief 直接是 §C 主体
- **全 App 禁止 emoji**（明明强调）— 视觉语义靠颜色 + 排版承载，不要 ✦/⚠️/→ 等符号
- 支持的 markdown：`p`, `b/strong`, `i/em`, `ul/ol`, `hr`

**Brief 全文由明明撰写 prompt**（见 [MON-37 占位 issue]）— v0.5 ux05 prototype 里的 brief 文案是 mock，最终由 prompt 生成。

#### 4.2.5 冲突的视觉表达（无 emoji，但要刺眼）

**模型 prompt 约定**：检测到冲突时，brief 第一段以 `**冲突：**` 开头（粗体冒号开场），第二行必须给具体改期建议（"建议挪到 X"）。

**前端识别 + 染色**：
- 第一段如果以 `**冲突：**` 起头 → 整段渲染为 `<p class="conflict">`：
  - 文字色 `var(--red)` (`#d4574a`)
  - 加粗
  - 段首左侧红色竖线（`border-left: 2px solid var(--red)`）
  - 浅红背景 `rgba(212,87,74,0.04)`
  - 段后 24px 强分割
- 第二段恢复正常颜色（暖灰），保持对话感

**示例 markdown**：
```markdown
**冲突：**那天下午你还约了和林啸的 Memory 评审会。建议把和敦敏的会面挪到 **6 月 12 日 16:30** 之后。

敦敏对你 Series A 那次的**估值**和 **GTM** 还没回邮件...
```

**冲突仍然写入日历**（不擅自不写）：用户看到红色后自己决定改不改。这是 Smart Calendar "建议"而非"阻止"的姿态。

#### 4.2.6 §D 已写入标识

**保留的理由（明明强调）**：让用户明确感知 "这个日历已经被同步到原生日历 App 了"，强化"无感同步"的信任感。

**视觉**：
- 左侧 iOS 风格日历 icon（红色月份缩写 + 大字号日期）
- 中间 `已加入 Apple 日历` + 副信息 `主日历 · iCloud`
- 右侧 `打开` 按钮（用 `--accent` 橙色）→ 跳 system 日历 app

#### 4.2.7 时间地点解析失败 UX（B2 方案，明明拍板）

- 不弹窗、不 block
- §B 日历卡本体显示 `时间未识别`（红色）
- §C 显示一段提示："**还差一点**：你想约的是哪天？回到主页跟我说一句就行（比如"周五下午 3 点"）"
- §D 不显示（没写入日历）

#### 4.2.8 撤销窗口（E1 方案，明明拍板）

- 写完 EventKit → 立刻 toast `已加入日历 · 撤销`，5s 内可点撤销 → 删 EventKit + 标 task `cancelled`
- detail 页**不放永久"从日历移除"按钮**（保持极简；过期想删去 system 日历手删）
- navbar 右上 `···` 菜单里可以放 `从日历移除`（poweruser 路径，不主推）

#### 4.2.9 撤销时的 Agent 反馈（F3 方案，明明拍板）

- 静默撤销，不打扰用户
- Agent 后台学习写 Memory：`user-rejected-time-pattern`（如"每周二下午都被拒"→ Agent 下次默认避开周二下午）
- 不弹"告诉 Agent 哪里不对" prompt

#### 4.2.10 Brief 是 async（明明 Q5 拍板）

- §A + §B + §D 秒进（解析成功 + EventKit 写入 → 立即可见）
- §C `cal-brief.loading` shimmer，文案 `正在为你想想…`，几秒后 `display_markdown` 填入
- 这样写日历的"已写入"反馈不被 brief 生成时长拖累

#### 4.2.d 后端依赖检查表 ✅ 零改动 / ⚠️ 需要后端配合

| 项 | 状态 | 备注 |
|---|---|---|
| `understanding-prompt` 输出 `cal_parse: {title, start_at, end_at, location, attendees, reminder, parse_failed, has_specific_time}` | ⚠️ **prompt 改字段名**（之前是 todo_parse） | 林啸 |
| **新 plugin `calendar-smart-brief-generator`**（pod 部署，复用 plugin-runtime 架构，**不是新 service**） | ⚠️ 新 plugin pod | 林啸 |
| Smart Brief prompt 全文 | ⚠️ **由明明撰写**（见 MON-37 占位 issue） | **明明** |
| 冲突检测：传 `existing_events_today/week` 给 brief prompt 输入 | ⚠️ retrieval 加一类 source（读 EventKit 上下文） | 林啸 |
| Brief 输出 `display_markdown` + `structured_payload` 双层 contract | ✅ 零改动（复用 MON-16 设计） | — |
| iOS EventKit 写日历 + 打开 system 日历 app | ✅ 现有 | — |
| 5s toast 撤销 → 删 EventKit + 标 task cancelled | ✅ 现有 | — |
| 撤销学习写 Memory（`user-rejected-time-pattern`）| ⚠️ 复用现有 Memory write 通道 | 林啸 |
| `agent-orchestrator-service` task type — 复用现有 `command_execute`，plugin = `calendar-smart-brief-generator` | ✅ 架构零改动 | — |

**总结**：核心后端工作 = **新 plugin pod** + **明明写 brief prompt**，不动 service 架构。

#### 4.2.11 v0.5 显式排除清单

- ❌ Todo / 待办类型（无具体时间点的诉求归"指令"或不进 v0.5）
- ❌ B3 实务信息（天气 / 路程 / 周边推荐）— 不接外部 MCP
- ❌ 周期事件（每周一次的会议等，v0.6+）
- ❌ Linear / Asana / Jira 等 issue tracker 写入
- ❌ 冲突检测的"自动改期"（只建议，不替用户改）
- ❌ Brief 历史版本管理 / 重新生成

#### 4.2.12 ux05 prototype 对应 mock

| mock id | 场景 | 演示 |
|---|---|---|
| `cal-1` | 朋友生日（无冲突，社交场景） | Smart Brief 完整形态 — 关于人的 context + 准备建议（送礼） |
| `cal-2` | 上海见敦敏（**有冲突**，工作场景） | 红色冲突顶段 + 工作 brief（带 deck + 偏好提醒） |

### 4.3 Command 进度展示 · Live Activity / 锁屏 / 桌面小组件（MON-19）

**状态机**: `pending` → `executing` → `done` / `failed` / `needs_input`

**3 个外置展示面**（在 ux05 prototype 中以 mock 面板形式放在手机左右两侧）：

#### 4.3.1 Live Activity / 灵动岛（左侧面板）

| 形态 | 出现场景 | 内容 |
|---|---|---|
| **compact (pill)** | 默认收起态，灵动岛右侧 | `M` logo + 状态文本 (≤14 字) + timer (executing 时) + 状态点（橙色 pulse / 暖黄静止 / 红色） |
| **expanded** | 用户长按灵动岛 | logo + 标题 (task title 截断 ≤16 字) + 状态行 + 进度条（executing）/ 拒绝/允许 按钮（needs_input） |

**5 状态文案（≤14 字硬约束）**：

| status | compact 文本 | trail dot | expanded 状态行 |
|---|---|---|---|
| `pending` | 排队中 · {title} | 橙 pulse | 排队中 · 即将开始 |
| `executing` | 执行中 · {title} | 橙 pulse | 执行中 · 还剩 {ETA} |
| `needs_input` | 需要确认 · {title} | 暖黄静止 `#d4a868` | 需要你确认（黄色） + `[拒绝] [允许]` 按钮 |
| `done` | 已完成 · {title} | 橙静止 | 已完成（5s 后自动收起） |
| `failed` | 失败 · {title} | 红静止 `#d4574a` | {failure_summary} ≤14 字 |

> {title} 自动截断到剩余空间能容纳的字数（一般 ≤8 字 / pill 显示能力）

#### 4.3.2 锁屏 widget

iOS 锁屏顶部 banner widget，wallpaper 半透明遮罩。

| 状态 | 视觉 |
|---|---|
| `executing` | 灰白文字 + pulse 点 + ETA |
| `needs_input` | **暖黄文字** `#f0c982` + 静止点 + "需要你确认 · 点击查看" |
| `failed` | **红色文字** `#ff8b8b` + 静止点 + 简短 reason |

点击 → deep link 进 detail 页**顶部**（F1 决策：用户从原话 / 上下文读到产出再决定）

#### 4.3.3 桌面小组件 (Home Widget) · 4×2 暗色

**基于明明设计稿**（2026-05-06）。WidgetKit 实现，**点击交互生效**：

```
┌─────────────────────────────────────┐
│ 5 月 6 日 · 周三       日程         │
│ 今天                   2 件事       │
├─────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────┐ │
│ │给敦敏邮件     │  │15:00–16:00   │ │
│ │已完成·1h前   │  │Memory 评审    │ │
│ ├──────────────┤  │会议室 A       │ │
│ │Sandbar↗     │  ├──────────────┤ │
│ │执行中·3min  │  │19:30          │ │
│ └──────────────┘  │和 Marshall    │ │
│                   │外滩茂悦       │ │
│                   └──────────────┘ │
│ ········· 5 件事 › │
└─────────────────────────────────────┘
```

**可点元素**（交互边界清晰版，2026-05-06 与明明拍板）：

| 操作 | 去哪 | 谁负责 |
|---|---|---|
| 左列 task 卡（cmd / cal） | Monostone app 内 detail（看 Smart Brief / 草稿） | Monostone 差异化 |
| 右列单个日程行 | Monostone cal detail (Smart Brief) | Monostone 差异化 |
| **"5 件事 ›" 看完整日历** | **`calshow://` 跳 Apple Calendar** | 系统原生 |
| 录音中状态左上角 `Mono Working · {timer}` + `Recording` 大字 + 红 pulse dot | — | — |

**核心边界原则**：
- Monostone 只做 "**单条的深度**"（Smart Brief、command 草稿、context 这些差异化内容）
- "**列表展示 / 全部日程**" 交给系统 Calendar — Apple Calendar 通过 EventKit 已经聚合了 iCloud + Google + Outlook 等所有连接源，一个 `calshow://` deep link 解决所有情况，0 新 nav / sheet / tab
- 这个边界让 v0.5 不需要日历 tab，也不需要"今日日程 sheet"

**配色**（暗色 widget 故意和 app 主体暖白形成对比，iOS home screen 上更突出）：
- bg `#0d0d0d`
- 行卡片 bg `rgba(255,255,255,0.05)`
- 日程时间色 `#f0c982` 暖黄
- 录音 dot `#ff5040`

#### 4.3.4 needs_input 中断 → 恢复链路（C3 决策）

用户**没在 app 里**时进入 needs_input 怎么提醒：

1. **Push notification** 一次：`需要你确认 · {task title}`（≤30 字硬限）
2. **同时** Live Activity 文案换成 `需要确认 · {title}` + 暖黄点
3. **同时** 锁屏 widget 切到 needs_input 视觉（暖黄文字）
4. 用户点任何一处 → deep link 进 detail 顶部 → 看上下文 / 产出 → 拒绝 / 允许
5. 不连环 push（一次到位，不打扰）

#### 4.3.5 failed 的"为什么 + 怎么办"（D3 决策）

两层展示：
- **head 一行简短 reason**（≤14 字）：`邮件服务断开 · 检查网络` / `需要重新登录 · 点击` 等。来自 task.failure_summary
- **产出区完整说明**（markdown）：来自 task.failure_detail_markdown，可以解释具体哪步失败 + 建议措施
- **底部按钮**：`[拒绝]` `[重试 (primary)]`（同 MON-16 锁定）

#### 4.3.d 后端依赖

| 项 | 状态 | 备注 |
|---|---|---|
| task status 5 态字段 | ✅ 现有 `agent-orchestrator-service` | — |
| `needs_input` 来自 confirmation pending | ✅ 现有 | — |
| **task 带 `failure_summary` (≤14 字) + `failure_detail_markdown` 字段** | ⚠️ 林啸确认现状是否已输出 | 林啸 |
| iOS ActivityKit (Live Activity) 集成 | ⚠️ iOS 端工作 | 林啸 (iOS) |
| iOS WidgetKit (桌面小组件) 集成 | ⚠️ iOS 端工作 | 林啸 (iOS) |
| Push notification (needs_input 触发) | ⚠️ iOS 端 + APNs | 林啸 (iOS) |

### 4.4 TodoDetailView · Apple 提醒事项 (MON-20)

> **核心**：todo 是 cal 的姊妹形态。视觉/结构和 §4.2 CalendarDetailView 完全一致（4 段），唯一差异：
> - **§B 卡本体**：时间字段写"无具体时间"（暖灰），多一行"提醒"显示 Agent 决定的提醒形式
> - **§D 已写入**：写"已加入 Apple 提醒事项"（不是"已加入 Apple 日历"）；icon 用"REM" 字样
> - **写入 target**：iOS EventKit 调 `EKReminder` 而非 `EKEvent`

#### 4.4.1 §B 字段（todo 简化版）

| 字段 | 内容 |
|---|---|
| 时间 | 固定显示 `无具体时间`（颜色 `--text-dim`） |
| 提醒 | Agent 智能决定的描述（如 `明天上班路上`、`本周内 · 价格波动较大时`） — **不固定规则**，由 Agent 根据 context 给出自然语言提醒 |
| 地点 / 参与人 | 通常 todo 没有，无值不显示 |

#### 4.4.2 §C Smart Brief（todo 也有 brief，和 cal 同等待遇）

明明拍板：todo 不是"光秃秃的提醒"，模型也带 context 帮用户做这件事。
- 例：todo "把那本《设计中的设计》还给舟舟" → brief 提示舟舟最近在做设计 + 你们常约在哪
- 例：todo "订下个月去东京的机票" → brief 提示要去见谁 + 历史订票偏好 + ANA 里程余额

Smart Brief prompt 和 cal 共用（详见 MON-37），输入参数加 `card_kind: "cal" | "todo"` 区分语气。

#### 4.4.3 §D 已写入标识（提醒事项版）

```
[REM icon] 已加入 Apple 提醒事项
           默认列表 · iCloud      [打开]
```

点 `打开` → deep link `x-apple-reminderkit://` 跳系统提醒事项 app

#### 4.4.4 提醒形式 — Agent 智能决定（明明拍板，不固定规则）

不用"提前 30 分钟 / 1 小时" 这种简单规则。Agent 根据 context 写自然语言：
- "把书还给舟舟" → `明天上班路上`（因为知道用户工作日通勤会经过她公司附近）
- "订机票" → `本周内 · 价格波动较大时`（基于历史购票模式）
- "做 POC" → `这周三晚上`（基于用户日历空闲槽 + 工作偏好）

iOS EventKit 写入时，Agent 把自然语言转成具体时间触发器（EKAlarm），用户在 Apple 提醒事项 app 看到具体时间。

#### 4.4.d 后端依赖

| 项 | 状态 | 备注 |
|---|---|---|
| `recording-mode-router` v3 输出 4 类（含 todo） | ⚠️ prompt 改 | 林啸（schema 加 todo） |
| `understanding-prompt` 输出 `todo_parse: {title, agent_reminder_natural_lang, agent_alarm_trigger}` | ⚠️ 新加字段 | 林啸（prompt 改） |
| iOS EventKit 写 `EKReminder` + `EKAlarm` | ✅ 现有 | — |
| iOS deep link `x-apple-reminderkit://` 打开提醒事项 | ✅ 现有 | — |
| 卡片删除同步删 EKReminder | ✅ 现有 5s undo 链路 | — |
| Smart Brief prompt 接受 `card_kind: "cal" \| "todo"` 参数 | ⚠️ MON-37 prompt 加分支 | 明明（写 prompt） |
| 错误文案 `todo.permission_denied` / `todo.write_failed` | ⚠️ docs/copy/error.md 加 | 我

### 4.5 详情页统一规范（MON-21）

> 收口：散落在 MON-16/17/18/19/20 的 detail 页规则收成一处。所有 4 种 detail (cmd/cal/todo/idea/rec) 共享。

#### 4.5.1 navbar `···` overflow menu（**所有 detail 页一致**）

固定 3 项，顺序固定：
1. **改类型** → 弹 reclass picker（4 选 1：指令/日程/待办/灵感）
2. **分享** → 弹 share sheet（**仅 rec 长录音显示**，其他 type 隐藏此项）
3. **删除**（红色文字）→ 同步删 EventKit + 5s undo toast

> v0.5 不引入"复制原话"、"导出"等其他菜单项，保持极简。

#### 4.5.2 详情页手势规范（4 detail 一致）

- ✅ **垂直滚动**（默认）
- ✅ **左滑返回**（iOS 系统标准）
- ✅ **navbar 分享按钮**（仅 rec）
- ❌ **不支持长按**（任何位置）
- ❌ **不支持卡内左滑/右滑**
- ❌ **不支持 pinch / zoom / pull-to-refresh**

详情页内的所有动作走 navbar `···` 或 detail-actions 底部按钮，**不引入 hidden 手势**。

#### 4.5.3 撤销窗口 + 视觉（5s 跨所有 detail 一致）

- **5s 倒计时**（已锁定 MON-17 §4.2.8 / MON-20）
- **视觉**：toast 显示 `已 X · 撤销`（纯文字，**不加进度条 / 圆环**），5s 后自动消失
- **触发场景**：
  - cal/todo 写入 EventKit 后
  - 删除 task / cal / todo 后（同步删 EKEvent / EKReminder）
  - command 草稿被允许后（用户可在 5s 内反悔）
- **撤销点击后**：toast 切到 `已撤销`，回滚状态

#### 4.5.4 失败重试规范（MON-19 D3 + MON-21）

**自动重试策略（A2 拍板）**：
- agent-orchestrator-service / EventKit 写入失败 → **后端自动重试 1 次**（应对网络瞬断）
- 仍失败 → 进入 `failed` 状态，弹给用户

**用户重试入口**（已锁定 MON-16）：
- detail 底部 actions：`[拒绝] [重试 (primary)]`
- 重试 = 用 task 原 plan + 当前最新 context 重跑

**failed 信息展示（MON-19 D3 双层）**：
- head status 一行简短 `failure_summary`（≤14 字）
- 产出区完整 `failure_detail_markdown`

#### 4.5.5 Toast 文案归属表

所有 detail 页 toast 文案统一在 `docs/copy/toast.md`：
- 通用 toast → `## 通用` 章节
- cmd 相关 → `## Command（M2）`
- cal 相关 → `## 日程 / Smart Calendar` § cal
- todo 相关 → `## 日程 / Smart Calendar` § todo
- 长录音 → `## RecordingDetailView 分享 / ## 录音 / 上传`
- 灵感 → `## IdeaDetailView`
- LA / 锁屏 / widget / push → `## Live Activity / 锁屏 / 桌面小组件 / Push`

每条 toast 文案 ≤14 字（`network.offline` 例外，≤20 字），`·` 分隔，无句号无感叹号。

#### 4.5.d 后端依赖

| 项 | 状态 |
|---|---|
| agent-orchestrator-service auto-retry 1 次 | ⚠️ 林啸（加 retry policy，轻改） |
| 5s undo / EventKit 删除链路 | ✅ 现有 |
| timeline-service 不需要"即将开始上浮"逻辑 | ✅ 不动（明明 2026-05-07 拍板 skip 上浮） |

### 4.6 inline chat（command 卡内）
- 关系: 是 `/agent/tasks/{id}/turn` 的简化入口；不和 AgentView 主线程合并

### 4.6 AgentView · 主对话屏（MON-41 v0.5）

> Sidebar 一等入口「Agent」跳转的主屏。HTML 锚点 `#s9` in `monostone-ux05/index.html`。
> v0.5 范围：把现有 chat mock 的产品定位正式化 + 视觉对齐其他屏（暖米白 + Claude 橙）+ 加 4 件原型未做的事（搜索入口 / 主动 push msg / memory 引用折叠 / 双模输入）。

#### 4.6.0 产品定位（核心 framing）

**Agent chat = 卡片做不到的 5 件事的唯一去处**：

| # | 场景 | 例子 |
|---|---|---|
| 1 | 跨 capture 综合问答 | "我这周关于戒指续航的所有讨论说了什么" |
| 2 | 脱离 capture 的纯问答 | "我下午有空吗"、"Series A 估值上限我说过吗" |
| 3 | **Agent 主动提示** | "你最近 3 次说要联系敦敏都没做"（每日活的核心驱动） |
| 4 | 跨 project 协调 | "把今早结论同步到 Series A 并更新策略" |
| 5 | 推理 trace 展示 | "你为什么这么建议" |

其他能在卡片里做的事不强塞 chat。

#### 4.6.1 屏幕结构

```
┌─ navbar (暖米白 backdrop-blur) ──────────────┐
│ [● avatar]  Agent                 [🔍]      │
│             已加载今天会议 + 这周 memory      │
├──────────────────────────────────────────────┤
│ chat-scroll                                  │
│  · proactive 主动 push (橙竖条 + 标签)       │
│  · date 分隔                                 │
│  · system msg                                │
│  · user 气泡 (橙底白字, 右对齐)              │
│  · agent 气泡 (白底深褐, 左对齐)             │
│    └─ thinking steps (虚线框, dim)           │
│    └─ "参考 N 条记忆 ›" 折叠条               │
│       (展开列出 5 个引用节点 + kind tag)     │
│  · agent attachment (邮件草稿卡)             │
│  · agent action pills (查看/改/发)           │
│  · agent typing (3 dots)                     │
├──────────────────────────────────────────────┤
│ chat-input (双模, 默认 voice-mode)           │
│  voice-mode:  [⌨]      [● mic 大圆]          │
│               按住说话 · 松开发送             │
│  keyboard-mode: [● voice] [输入框] [↑ send]  │
└──────────────────────────────────────────────┘
```

#### 4.6.2 关键决策

| § | 决策 | 落地 |
|---|---|---|
| §A 主屏定位 | A 纯 chat | 沿用现状 |
| §B 输入主导 | B 语音主导，大 mic 居中 | `.chat-input.voice-mode` 默认 |
| §C Context 感知 | B navbar 简化 + chat 内"参考 N 条记忆"折叠 | `.chat-refs` + `.chat-refs-list` |
| §D 初始状态 | B 上次未完成延续 / 退化 C 系统打招呼 | system msg 沿用 |
| §E 长 chat | 按天分段 + 顶部 search；不做 pin / quote | `.chat-date` + 🔍 入口 |
| §F Plugin 展示 | 1 步 inline pills；多步跳详情 | 沿用 attach + actions |
| §G 跟首页关系 | chat → 单向跳详情；反向不同步 | memory_refs item 点击跳目标 screen |
| §H 多 conversation | A 单 conversation 永久延续 | 不放"新建 chat"按钮 |

#### 4.6.3 主动 push msg 视觉规范（§C）

跟 Agent 普通回答区分：
- 不用气泡形状（避免和"用户问→Agent 答"流混淆）
- 淡橙背景 `var(--accent-soft)` + 左侧 2.5px 橙竖条
- 头部一个小 pill tag："今早简报" / "提醒" / "模式发现" / "待办催促"
- 触发时机由后端决定（cron / event-driven），前端只渲染收到的 msg

mock 例子见 `data/mock.js` AGENT_CONVERSATION 第一条。

#### 4.6.4 memory 引用展示（§C wow moment）

每条 agent text 回答可带 `memory_refs[]` 字段：

```js
memory_refs: [
  { id: 'rec-2026-04-09-am', kind: '录音', title: '...', target: 's4' },
  { id: 'desc-positioning',   kind: 'desc', title: '...', target: 's8' },
  ...
]
```

- 渲染："参考 N 条记忆 ›" 折叠条（虚线框，dim 灰）
- 点击展开列出引用节点（kind tag + 标题）
- 节点点击跳到对应 detail（v0.5 mock toast，未来 deep link 到 RecordingDetailView / IdeaDetailView / Memory tab）

跟 MON-39 wow moment §2 强相关。

#### 4.6.5 双模输入交互（§B）

**voice-mode（默认）**：
- 大圆 mic 居中（56×56，accent 橙底白字 + 阴影）
- 左侧小圆按钮 ⌨ 切到键盘
- mic 上方提示 "按住说话 · 松开发送"
- 按下 mic：200ms 后 toast"录音中…松开发送"
- 抬起 mic：toast"已发送 · Agent 正在响应…"

**keyboard-mode**：
- input box 展开 + send 按钮亮起
- 左侧小圆按钮 ● 切回语音
- mic 隐藏

切换函数：`setAgentInputMode('voice' | 'keyboard')`

#### 4.6.d 后端依赖检查表 ✅ 零改动

| 字段 / 行为 | 接口 | 状态 |
|---|---|---|
| chat 历史读 / 写 | `agent-orchestrator-service` 现有 conversation API | ✅ 用现有 |
| memory_refs 字段 | Agent 回答 response 加 `evidence_node_ids[]` | ⚠️ 林啸 verify 是否已返；若无，前端 mock 兜底 |
| proactive push msg | 后端 cron / event → SNS push → 前端展示 | ⚠️ 后端要加 cron-worker（不阻塞 v0.5 前端 mock） |
| 搜历史对话 | 走 memory tree search（chat 入 memory raw 节点） | ⚠️ 林啸 verify chat 是否入 memory；若无，v0.5 mock toast |
| 单 conversation | 1 个永久 conversation_id | ✅ 用现有 |

> 接口契约不动，后端实现可以脱胎换骨重写（架构可变 / 门面不变原则）。

#### 4.6.6 v0.5 砍掉的事

| 砍 | 原因 | 留给 |
|---|---|---|
| 卡片内 inline chat | 工作量大，需要 RecordingDetailView/IdeaDetailView 全改 | v0.6 |
| chat 历史 search 真实跳转 | 需要 backend chat search 接口 | v1.0 |
| memory 引用真实跳转到 detail | 需要 deep link 路由 | v1.0 |
| 多 conversation / 新建 chat | 跟产品定位不符（Agent 是 long-lived companion） | 永远不做 |
| pin / quote 引用回看 | ChatGPT 风功能；Monostone 走 memory 检索路径 | 永远不做 |
| 真实 push msg 推送链路 | 后端 cron-worker + SNS topic | M5 主动陪伴 |

## 5. 后端变更

### 5.1 `llm-worker` 的 recording-mode-router prompt（MON-18 v2 重新框架）

**核心改变（2026-05-04 与明明拍板）**：长 vs 短不在这里分类 —— 由 iOS **手势直接决定**（按住 = 长 / 按一下 = 短），物理硬约束。prompt 缩窄到"短录音子类 3 选 1"。

- 引用 `docs/prompts/llm-worker/recording-mode-router.md` (v2)
- 输出 schema: `recording_mode: "command" | "cal" | "idea"`, `confidence`, `reason`, `fallback_used`, `schema_version: 2`
- 命名严格沿用现有：文件名 `recording-mode-router.md` 不改、字段名 `recording_mode` 不改、service 名 `llm-worker` / `post-recording-coordinator` 不改

**调用场景**：
1. 正常路径：iOS 短按 → batch-asr-worker → llm-worker (本 prompt) → post-recording-coordinator 路由
2. **场景 A（长按 fallback）**：iOS 长按但 `duration_seconds < 120` → post-recording-coordinator **fallback 调本 prompt** 拿子类 → 当短录音处理。**模型自动归类，不打扰用户**（无 UX 提醒）

**唯一林啸要做的事**：`post-recording-coordinator` 加场景 A 路由分支（长按 < 120s → 调 recording-mode-router）。其他全复用现有通道。

**Few-shot prompt 全文** ⚠️ 拆给明明撰写：见 MON-38。我已在 prompt 文件里写完 framework + 3 个示范 few-shot，明明补 4+ 真实语料即可。

### 5.2 `post-recording-coordinator` 路由逻辑
- TODO: command → 创建 agent task; todo → 写 timeline event

### 5.3 `agent-orchestrator-service`
- 新增 task type: `command_execute`
- TODO: confirmation 流复用现有 `/agent/tasks/{id}/confirmations/*`

## 6. API 契约

### iOS 调用
```
POST /multimodal/inputs (短录音上传)
GET  /timeline/feed                          ← timeline-service
POST /timeline/events/{id}/reply             ← inline chat / 编辑指令
POST /agent/tasks/{task_id}/turn             ← 给 command 加补充指令
GET  /agent/tasks/{task_id}/confirmations/pending
POST /agent/tasks/{task_id}/confirmations/{confirmation_id}
POST /agent/tasks/{task_id}/cancel
```

### Plugin 调用（iOS 间接通过 agent，不直调）
```
POST /plugins/{calendar-create-event}/connections/me/connect  ← 首次 OAuth
POST /plugins/{email-sender}/connections/me/connect            ← 首次连接
```

## 7. 文案

引用 `docs/copy/toast.md` 的 command/todo 章节。

## 8. Acceptance

- [ ] 短录音 4 种分类链路全跑通
- [ ] command 草稿 → 用户编辑 → confirm → 真发送
- [ ] todo 写 EventKit + 冲突检测 UI
- [ ] Live Activity 显示 command 执行进度
- [ ] 详情页 toast / 撤销 / 重试 全覆盖
- [ ] 端到端时延符合 SLA（短录音→todo<8s, →command<12s）
