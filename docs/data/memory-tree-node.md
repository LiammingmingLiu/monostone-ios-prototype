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
  - docs/prompts/memory-tree-worker/project-to-scene.md
  - docs/prompts/memory-tree-worker/user-profile-extractor.md
related-spec: docs/features/M3-memory-prompts.md
---

# MemoryNode

> Memory Tree 6 层节点。所有层用同一个表 / 实体，靠 `layer` 字段区分。
>
> ⚠️ **零后端改动原则**：本 schema **完全对齐后端现有字段**，不引入新字段。双视角通过现有 `title`（短）+ `text`（长，含两段结构）实现。

```swift
struct MemoryNode: Codable, Identifiable {
    let id: String                  // memory_node_id
    let userId: String
    let layer: MemoryLayer

    let title: String?              // 短标题，≤ 12 字（display 用）
    let text: String                // 正文。约定结构：
                                    //   第一行：人话摘要 ≤ 30 字（用户在 feed 上看到的"一行扫描"）
                                    //   空行
                                    //   后续：详细内容（含数字/决策/实体，给 Agent embedding 用）
                                    // iOS 渲染时按 \n\n 切：第一段=summary，全文=detail
    let importance: Double          // 0-1，节点的检索价值分数（不是用户感知重要度）
                                    // 由物化 LLM 标，rubric: 信息密度 0.6 + 情绪信号 0.4
    let entityIds: [String]         // 关联实体（人、项目、地点、时间）

    let parentNodeIds: [String]     // 上一层（多对多）
    let childNodeIds: [String]      // 下一层
    let sourceRecordingIds: [String]

    let recencyScore: Double?       // 0-1，时间衰减（后端可能动态算）

    let createdAt: String
    let updatedAt: String
    var schemaVersion: Int = 1
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

## 双视角的实现：text 字段两段结构

**关键约定**：物化 prompt 输出的 `text` 字段必须遵守这个结构，iOS 客户端按 `\n\n` 切。

```
{display_summary 一句 ≤ 30 字人话摘要}

{search_text 详细内容，含所有数字/决策/实体/时间锚点}
```

**示例**：

```
续航 38h，离 50h 目标差 12h

当前续航 38 小时，距 50 小时目标差 12 小时。林啸计划把心率上报频率从 1Hz 降到 0.2Hz，预计省 18%，明天测试验证。
```

**iOS 渲染规则**：
- Memory feed 一行扫描 → `text.split("\n\n")[0]`（第一段，30 字内）
- 详情页全文 → `text` 完整内容
- title → 直接显示

**Agent fetch 规则**：
- embedding 全文 `text`（不需要单独的 search_summary 字段）
- 倒排索引按 `entity_ids`
- importance 决定 context packaging 优先级

**降级策略**（如果 LLM 没遵守结构）：
- iOS 端 split("\n\n") 只有一段 → 截前 30 字作为 summary

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

## 用户编辑

用户在 Memory tab 改 title 或 text → 走 `PATCH /internal/memory/tree/nodes/{node_id}/text` API（后端文档已存在）。
不区分"AI 版本 vs 用户版本"——用户改了就直接覆盖（最小改动原则）。

## 节点物化链

```
L0 raw  ──────────────────  #1 raw → description
       │
       ▼
L1 description           ──  #2 description → episode
       │
       ▼
L2 episode               ──  #3 episode → project
       │
       ▼
L3 project               ──  #4 project → scene
       │
       ▼
L4 scene
       │
       ▼
L5 user_profile          ──  #5 提取自 episode + project + scene
```

* episode 同时挂到 project（主题归属）和 scene（语境包络）
* scene 比 project 更宽：一个 scene 可包含多个 project
* **生产现状**：scene 实际只有 Work / Life 两个 phase（v0.5 范围）

## 历史变更

- v1 (2026-05-02): 初版
- v2 (2026-05-03): 引入 display_* / search_* 双视角字段（已废弃，未对齐后端）
- **v1.5 (2026-05-06)**: 回退到对齐后端现有字段，双视角通过 text 字段两段结构实现，零新字段

## TODO

- [ ] 跟林啸验证 title / importance / entityIds 字段实际存在
- [ ] 跟林啸验证 PATCH /internal/memory/tree/nodes/{node_id}/text 接口
- [ ] 列出 `/memory/tree/search` 的请求体 schema
