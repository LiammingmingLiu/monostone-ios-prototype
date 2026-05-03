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
    // ===== 标识 =====
    let id: String                  // memory_node_id
    let userId: String
    let layer: MemoryLayer

    // ===== 双视角字段（核心设计）=====
    // display_*: 给 iOS UI 渲染的人话字段，短、清爽
    // search_*:  给 Agent fetch pipeline 的密集检索字段
    let displayTitle: String?       // ≤ 12 字（episode）/ ≤ 8 字（project/scene）
    let displaySummary: String?     // ≤ 30 字，一行扫描
    let searchSummary: String       // ≤ 200 字，信息密集，Agent 检索用
    let searchKeywords: [String]    // 检索词（实体 + 主题 + 时间锚点）

    // ===== 检索元数据（Agent 视角）=====
    let salience: Double            // 0-1，原 importance 改名（避免歧义）。
                                    // 含义：节点的"被检索价值"分数，不是用户感知重要度。
                                    // 用途：context packaging 阶段决定是否装入 Agent context window
    let recencyScore: Double        // 0-1，时间衰减
    let entityIds: [String]         // 关联实体（人、项目、地点）

    // ===== 结构层（连接 Tree 节点）=====
    let parentNodeIds: [String]     // 上一层（多对多）
    let childNodeIds: [String]      // 下一层
    let sourceRecordingIds: [String]

    // ===== 用户编辑层（Q3 选 A 最小改动）=====
    let userEditedDisplayTitle: String?     // 用户改过的显示标题，覆盖 displayTitle
    let userEditedDisplaySummary: String?   // 同上。search_* 字段不被用户编辑影响

    let createdAt: String
    let updatedAt: String
    var schemaVersion: Int = 2      // v2: 双视角字段 + scene 层级调整 + salience 改名
}

enum MemoryLayer: String, Codable {
    case raw            // L0 原始片段（转写一段、文件一页）
    case description    // L1 单条可检索描述
    case episode        // L2 一段事件
    case project        // L3 项目级聚合（"在做什么"，主题维度）
    case scene          // L4 场景级聚合（"在哪个上下文里做"，跨 project 的语境包络）
    case userProfile = "user_profile"  // L5 用户画像
}
```

> **⚠️ Schema v2 变更（2026-05-03）**
> 1. 新增双视角字段（display_* / search_*）—— 同节点同行，UI 用 display，Agent 用 search
> 2. `importance` → `salience`（语义精准化，避免与"用户感知重要度"混淆）
> 3. **scene 从 L3 升到 L4**——scene 是跨 project 的更大语境包络
> 4. user_profile 从 L4 → L5
> 5. 新增 userEdited* 字段（用户改 display 不污染 search）

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

## 节点物化关系（M3 prompt 决定形态）· v2 双视角

```
                                          ┌── search 字段 ──→ Agent fetch pipeline
所有 layer 的节点都有双视角字段 ─────────┤
                                          └── display 字段 ──→ iOS Memory tab UI

物化链：

L0 raw  ──────────────────────────────────────────  #1 raw → description
              │
              ▼
L1 description (单条可检索原子) ────────────────────  #2 description → episode
              │
              ▼
L2 episode    (一段事件，时间窗 ≤ 1 天)  ───────────  #3 episode → project
              │
              ▼
L3 project    (主题项目，"在做什么")    ───────────  #4 project → scene
              │
              ▼
L4 scene      (语境包络，"在哪个上下文里"，可跨多个 project)
              │
              ▼
L5 user_profile (从 episode + project + scene 综合抽取)  #5

* episode 同时挂到 project（主题归属）和 scene（语境包络）
* scene 比 project 更宽：一个 "和林啸的所有对话" scene 可以包含
  ["Ring v1 硬件", "iOS App MVP"] 等多个 project
```

## 用户视角 vs Agent 视角

| 字段 | 给谁看 | 谁写 | 谁可改 |
|---|---|---|---|
| displayTitle / displaySummary | 用户 (Memory tab) | LLM 物化时 | 用户可编辑 (写到 userEdited*) |
| searchSummary / searchKeywords | Agent fetch | LLM 物化时 | 系统自动，用户不改 |
| salience | Agent context packaging | LLM 物化时 | 系统自动 |
| entityIds / parentNodeIds | 双方 | 系统结构 | 系统自动 |

每一层物化由一个 prompt 完成，prompt 文件路径在 frontmatter `related-prompts` 列出。

## TODO

- [ ] 校对 entity / importance / recencyScore 字段是否实际存在
- [ ] 列出 `/memory/tree/search` 的请求体 schema
