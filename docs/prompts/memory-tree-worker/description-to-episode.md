---
name: memory-tree-description-to-episode
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=episode)
---

# memory-tree-worker · description → episode

## 用途
把若干 L1 description 聚合成 L2 episode：一段"事件"。聚合粒度由时间窗 / 主题相似度 / 实体重合决定。

## 输入契约
```typescript
{
  candidate_descriptions: Array<{ id, title, text, created_at, entities }>,
  existing_episodes_summary: Array<{ id, title, time_range, entity_overlap }>,
  user_timezone: string,
}
```

## 输出契约
```typescript
{
  episode_actions: Array<
    | { kind: "create", title, description_ids: string[], time_range, entity_ids: string[] }
    | { kind: "extend", episode_id: string, description_ids: string[] }
    | { kind: "skip", description_id: string, reason: string }
  >,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
- Episode 时长建议 ≤ 1 天（除非明显是跨天连续事件）
- 实体重合 ≥ 50% 优先归到已有 episode
- 主题切换明显 → 新 episode

## Few-shot
> TODO

## 边界
- 单条 description 不归到任何 episode → kind=skip
- 候选 episode 都不匹配 → kind=create

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/description-to-episode-fixtures.md`
