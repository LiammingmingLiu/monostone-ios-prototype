---
type: data-schema-index
audience: 林啸（前端 Codable + 后端 SQLAlchemy / API 字段）
authority: 这里是 iOS Swift struct ↔ backend API 字段的契约。冲突时和 backend 实际接口对齐
---

# 数据 Schema 索引

## 为什么单独成一类

- 字段冲突是接口对齐 bug 的最大来源
- iOS 的 `Codable` struct 和 backend 的 JSON 必须 1:1
- 同一份 schema 让前端 / 后端 / Linear issue / spec 文档共用

## 命名规则（对齐 backend）

| 规则 | 例子 |
|---|---|
| iOS struct 名 = backend 实体名（PascalCase） | `RecordingSummary`、`AgentTask`、`TimelineEvent` |
| JSON 字段名 = snake_case（后端约定） | `recording_id`, `created_at`, `understanding_ready_at` |
| iOS 属性映射用 `CodingKeys` | `var recordingId: String` ↔ `"recording_id"` |
| ID 字段统一用 `{entity}_id` | `recording_id`, `agent_task_id`, `memory_node_id` |
| 时间统一 ISO8601 String | `created_at: String` |

## 文件清单

| 文件 | 后端归属 | iOS view |
|---|---|---|
| [card-recording.md](card-recording.md) | `multimodal-ingestion-service` + `understanding-service` + `llm-worker` 输出 | RecordingDetailView |
| [agent-task.md](agent-task.md) | `agent-orchestrator-service` (`/agent/tasks*`) | CommandDetailView, AgentView |
| [timeline-event.md](timeline-event.md) | `timeline-service` (`/timeline/events*`) | HomeView, TodoDetailView |
| [memory-tree-node.md](memory-tree-node.md) | `memory-api` + `memory-tree-worker` (`/memory/tree/nodes`) | MemoryView |
| [plugin-product.md](plugin-product.md) | `plugin-runtime-service` (`/plugins/products`) | PluginsView |

## 公共字段（所有实体）

```swift
struct EntityHeader {
    let id: String              // UUID 字符串
    let createdAt: String       // ISO8601
    let updatedAt: String       // ISO8601
    var schemaVersion: Int = 1  // 后端 prompt 升级时 bump
}
```

## TODO（明明）

- [ ] plugin-product.md 待写
- [ ] 给每个 schema 文件加 JSON 例子
- [ ] 校验 backend 实际返回字段（让林啸 curl 一份样本附在 schema 下面）
