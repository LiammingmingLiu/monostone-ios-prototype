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

### 4.1 CommandDetailView
- TODO

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
