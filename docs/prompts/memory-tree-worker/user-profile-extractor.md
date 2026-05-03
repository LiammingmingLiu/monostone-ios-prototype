---
name: memory-tree-user-profile-extractor
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=user_profile)
---

# memory-tree-worker · → user_profile

## 用途
从下层节点（episode / project / scene）提取 L4 user_profile：用户偏好、关系、目标、习惯。L4 是 Agent 决策最常用的画像层。

## 输入契约
```typescript
{
  candidate_signals: Array<{
    source_node_id: string,
    layer: "episode" | "project" | "scene",
    text: string,
    importance: number,
  }>,
  existing_profile: {              // 当前 user profile 全量（可能很长，注意 token）
    preferences: { ... },
    relationships: { ... },
    goals: { ... },
    habits: { ... },
  },
}
```

## 输出契约
```typescript
{
  profile_updates: Array<
    | { kind: "add", category: "preferences" | "relationships" | "goals" | "habits", key, value, evidence_node_ids: string[] }
    | { kind: "update", category, key, new_value, evidence_node_ids: string[] }
    | { kind: "remove", category, key, reason }
  >,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）— 这个 prompt 决定了"Monostone 怎么看你这个人"。需要谨慎，不要过度推断。

## 决策规则
- 至少 2 个独立 evidence 才能 add（避免单次表达污染画像）
- 偏好冲突 → 取最近的，旧的标 removed 但保留 evidence
- 不抽取敏感信息（健康、性取向、政治倾向），除非用户主动表达多次

## Few-shot
> TODO

## 边界
- 单个 evidence 不能 add → 暂存 candidates_pending
- profile 字段达到上限 → 触发 prune（弱 evidence 优先）

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/user-profile-extractor-fixtures.md`
