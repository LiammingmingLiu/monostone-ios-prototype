---
name: memory-tree-episode-to-scene
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=scene)
---

# memory-tree-worker · episode → scene

## 用途
把 episode 聚合到 L3 scene（场景）。Scene ≠ project：scene 是按时间 / 地点 / 共同主题划分的"语境单元"，比 project 更宽。例如 "周一例会" / "深圳办公室" / "和林啸的所有对话"。

## 输入契约
```typescript
{
  episode: { id, title, time_range, entity_ids, location? },
  existing_scenes: Array<{ id, kind: "time" | "location" | "topic", definition, recent_episode_ids[] }>,
}
```

## 输出契约
```typescript
{
  scene_actions: Array<
    | { kind: "attach", scene_id: string }
    | { kind: "create_time", recurrence_pattern: string }
    | { kind: "create_location", location: string }
    | { kind: "create_topic", topic: string }
    | { kind: "skip" }
  >,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）— scene 是按什么分？时间 / 地点 / 主题三选一还是混合？这个决策是 M3 关键产品判断

## 决策规则
> TODO

## Few-shot
> TODO

## 边界
- Episode 没有时间或地点 → 只走 topic scene
- Scene 数量过多（用户已有 50+ scene）→ 优先 attach

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/episode-to-scene-fixtures.md`
