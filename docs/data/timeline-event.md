---
type: data-schema
entity: TimelineEvent
backend-source:
  - /timeline/feed (timeline-service)
  - /timeline/events/{event_id}/*
related-spec: docs/features/M2-agent-tasks-and-timeline.md
---

# TimelineEvent

> HomeView feed 实际就是 `/timeline/feed` 返回的事件列表。卡片类型由 `kind` 决定。

```swift
struct TimelineEvent: Codable, Identifiable {
    let id: String                  // event_id
    let userId: String
    let kind: TimelineEventKind     // recording / todo / command / agent_message / digest ...
    let createdAt: String
    let scheduledAt: String?        // todo 类才有
    let title: String
    let snippet: String?
    let status: TimelineEventStatus
    let relatedRecordingId: String?
    let relatedAgentTaskId: String?
    let relatedMemoryNodeIds: [String]?
    let syncTarget: SyncTarget?
    let archivedAt: String?
    var schemaVersion: Int = 1
}

enum TimelineEventKind: String, Codable {
    case recording        // 长录音卡片（含 longRec / idea）
    case todo             // M2 todo 卡片
    case command          // M2 command 卡片
    case agentMessage = "agent_message"  // Agent 主动通知
    case digest           // Daily digest（v0.5 不实现）
}

enum TimelineEventStatus: String, Codable {
    case pending, executing, done, failed, cancelled, archived
}

enum SyncTarget: String, Codable {
    case reminders, calendar, linear, slack
}
```

## API 调用

| iOS | Method | Path |
|---|---|---|
| 拉 feed | GET | `/timeline/feed` |
| 详情 | GET | `/timeline/events/{event_id}` |
| 用户回复 | POST | `/timeline/events/{event_id}/reply` |
| 标完成 | POST | `/timeline/events/{event_id}/complete` |
| 取消 | POST | `/timeline/events/{event_id}/cancel` |
| 调度 | POST | `/timeline/events/{event_id}/schedule` |
| 设同步目标 | POST | `/timeline/events/{event_id}/sync-target` |
| 已读 | POST | `/timeline/events/mark-read` |
| 归档 | POST | `/timeline/events/{event_id}/archive` |
| 删除 | DELETE | `/timeline/events/{event_id}` |

## 注意

- `POST /timeline/events/{id}/reply` 在后端会按 `kind` 路由：
  - `agent_message` → `agent-orchestrator-service`
  - `recording` → `system-agent-service`
- iOS 不需要管路由，统一调 reply 接口

## TODO

- [ ] 校对 TimelineEventKind 全集（特别是 v0.5 范围内）
- [ ] `/timeline/feed` 分页参数
