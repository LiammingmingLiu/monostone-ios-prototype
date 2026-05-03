---
type: data-schema
entity: AgentTask
backend-source:
  - /agent/tasks (agent-orchestrator-service)
  - /agent/tasks/{id}/turn
  - /agent/tasks/{id}/events
  - /agent/tasks/{id}/confirmations/pending
related-spec: docs/features/M2-agent-tasks-and-timeline.md
---

# AgentTask

```swift
struct AgentTask: Codable, Identifiable {
    let id: String                  // task_id
    let userId: String
    let kind: AgentTaskKind         // command_execute / brainstorm / clarification ...
    let status: AgentTaskStatus
    let createdAt: String
    let updatedAt: String
    let title: String
    let lastTurnSummary: String?
    let pendingConfirmationIds: [String]
    var schemaVersion: Int = 1
}

enum AgentTaskKind: String, Codable {
    case commandExecute = "command_execute"  // M2 短录音 command
    case brainstorm                           // M1 灵感发散
    case clarification                        // Agent 反向澄清
    case dialogue                             // AgentView 主线对话
}

enum AgentTaskStatus: String, Codable {
    case pending, planning, executing, awaitingConfirmation = "awaiting_confirmation"
    case awaitingInput = "awaiting_input"
    case done, failed, cancelled
}
```

## Confirmation

```swift
struct AgentConfirmation: Codable, Identifiable {
    let id: String                  // confirmation_id
    let taskId: String
    let kind: ConfirmationKind      // send_email / create_event / external_api ...
    let preview: [String: AnyCodable]  // 草稿内容 (e.g. 邮件 subject + body)
    let pluginId: String?
    let createdAt: String
    let expiresAt: String?
}
```

## Turn / Event

```swift
struct AgentTurn: Codable {
    let role: TurnRole  // user / assistant / tool
    let content: String
    let toolCalls: [ToolCall]?
    let createdAt: String
}

enum TurnRole: String, Codable { case user, assistant, tool }

struct AgentEvent: Codable, Identifiable {
    let id: String
    let taskId: String
    let kind: AgentEventKind
    let payload: [String: AnyCodable]
    let createdAt: String
}

enum AgentEventKind: String, Codable {
    case planCreated = "plan_created"
    case toolCalled = "tool_called"
    case toolReturned = "tool_returned"
    case confirmationRequested = "confirmation_requested"
    case confirmationResolved = "confirmation_resolved"
    case statusChanged = "status_changed"
    case finalized
}
```

## API 调用

| iOS | Method | Path |
|---|---|---|
| 创建 | POST | `/agent/tasks` |
| 追加回合 | POST | `/agent/tasks/{task_id}/turn` |
| 恢复 | POST | `/agent/tasks/{task_id}/resume` |
| 列表 | GET | `/agent/tasks` |
| 详情 | GET | `/agent/tasks/{task_id}` |
| 事件流 | GET | `/agent/tasks/{task_id}/events` |
| 待确认 | GET | `/agent/tasks/{task_id}/confirmations/pending` |
| 提交确认 | POST | `/agent/tasks/{task_id}/confirmations/{confirmation_id}` |
| 取消 | POST | `/agent/tasks/{task_id}/cancel` |
| 能力 | GET | `/agent/capabilities` |

## TODO

- [ ] 林啸 curl `/agent/tasks` 和 `/agent/tasks/{id}/events` 样本
- [ ] 校对 ConfirmationKind 全集
