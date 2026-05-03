---
type: data-schema
entity: MemoryNode
backend-source:
  - /memory/tree/nodes (memory-api)
  - /memory/tree/search
  - 由 memory-tree-worker 物化
related-prompts:
  - docs/prompts/memory-tree-worker/raw-to-description.md
  - docs/prompts/memory-tree-worker/description-to-episode.md
  - docs/prompts/memory-tree-worker/episode-to-project.md
  - docs/prompts/memory-tree-worker/episode-to-scene.md
  - docs/prompts/memory-tree-worker/user-profile-extractor.md
related-spec: docs/features/M3-memory-prompts.md
---

# MemoryNode

> Memory Tree 5 层节点。所有层用同一个表 / 实体，靠 `layer` 字段区分。

```swift
struct MemoryNode: Codable, Identifiable {
    let id: String                  // memory_node_id
    let userId: String
    let layer: MemoryLayer
    let title: String?
    let text: String                // description / episode 的人类可读内容
    let parentNodeIds: [String]     // 上一层节点（多对多）
    let childNodeIds: [String]      // 下一层节点
    let entityIds: [String]         // 关联的命名实体（人、项目、地点）
    let sourceRecordingIds: [String]
    let createdAt: String
    let updatedAt: String
    let importance: Double          // 0-1, structuring LLM 标
    let recencyScore: Double        // 0-1, 衰减
    var schemaVersion: Int = 1
}

enum MemoryLayer: String, Codable {
    case raw            // L0 原始片段（转写一段、文件一页）
    case description    // L1 单条可检索描述
    case episode        // L2 一段事件
    case project        // L3 项目级聚合
    case scene          // L3 场景级聚合（按时间/地点/主题）
    case userProfile = "user_profile"  // L4 用户画像
}
```

## API 调用

| iOS | Method | Path |
|---|---|---|
| 列出 | GET | `/memory/tree/nodes?layer=...` |
| 单节点 | GET | `/memory/tree/nodes/{node_id}` |
| 搜索 | POST | `/memory/tree/search` |
| 健康 | GET | `/memory/tree/health` |
| 导出 | GET | `/memory/export` |
| 反馈 | POST | `/memory/feedback` |

> ⚠️ `/admin/memory`、`/ops/memory`、`/agent/memory`、`/internal/memory` 是后端 / Agent 用，iOS 不直接调。

## 节点物化关系（M3 prompt 决定形态）

```
L0 raw  ──────┐
              ├─→  L1 description ──┐
                                     ├─→ L2 episode ──┐
                                                       ├─→ L3 project
                                                       └─→ L3 scene
                                                              │
                                                              └─→ L4 user_profile
```

每一层物化由一个 prompt 完成，prompt 文件路径在 frontmatter `related-prompts` 列出。

## TODO

- [ ] 校对 entity / importance / recencyScore 字段是否实际存在
- [ ] 列出 `/memory/tree/search` 的请求体 schema
