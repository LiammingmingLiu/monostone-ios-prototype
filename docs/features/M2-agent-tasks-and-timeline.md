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

### 3.1 短录音 → command（邮件）
1. FAB 快点录音 "帮我写封 follow-up 邮件给敦敏"
2. 后端分类 = command, 创建 `/agent/tasks`
3. iOS 收到 task → 插入 command 卡片到 home（processing）
4. Agent 起草邮件 → confirmation pending → iOS 在 CommandDetailView 显示草稿可编辑
5. 用户改完点"发送" → `POST /agent/tasks/{id}/confirmations/{cid}` (confirm=true)
6. plugin-runtime → email-sender → 发送
7. iOS 显示 done + toast

### 3.2 短录音 → todo（日历）
1. FAB 快点录音 "提醒我周五下午三点和林啸开会"
2. 后端分类 = todo + 解析时间地点
3. 后端写 `/timeline/events` (kind=todo, scheduled_at=2026-05-08T15:00)
4. iOS 收到 timeline event → 插入 todo 卡片
5. iOS 询问 EventKit 权限 → 写 Apple 日历
6. 冲突检测：如果有重叠事件，弹冲突 UI

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
| `cmd-4` | needs_input · 日历 | 等待确认态（同样 拒绝/允许）— 验证按钮通用 |

### 4.2 TodoDetailView
- TODO（已有骨架, commit 389826c）

### 4.3 短录音处理中卡片
- 状态机: `pending` → `executing` → `done` / `failed` / `needs_input`

### 4.4 inline chat（command 卡内）
- 关系: 是 `/agent/tasks/{id}/turn` 的简化入口；不和 AgentView 主线程合并

## 5. 后端变更

### 5.1 `llm-worker` 的 recording-mode-router prompt
- 引用 `docs/prompts/llm-worker/recording-mode-router.md`
- 必须输出: `recording_mode: "command" | "todo" | "idea" | "longRec"`, `confidence`, `reason`

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
