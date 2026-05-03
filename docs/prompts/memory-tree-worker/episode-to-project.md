---
name: memory-tree-episode-to-project
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
related-issue: MON-5, MON-12 (灵感归属也用这个)
related-data-schema: docs/data/memory-tree-node.md (layer=project)
---

# memory-tree-worker · episode → project

## 用途
判定 episode 归属于哪个 L3 project（用户的工作 / 关系 / 长期主题）。同样用于 M1 的灵感卡片自动归属。

## 输入契约
```typescript
{
  episode: { id, title, text, time_range, entity_ids: string[] },
  existing_projects: Array<{ id, name, description, entity_ids, recent_episode_titles[] }>,
  user_recent_corrections: Array<{ episode_id, wrong_project_id, correct_project_id }>,  // 用户校正历史
}
```

## 输出契约
```typescript
{
  primary_project_id: string | null,
  primary_confidence: number,       // 0-1
  candidates: Array<{ project_id, confidence, reason }>,  // top 3
  needs_user_choice: boolean,       // confidence < 0.6 时 true
  suggest_create_new: { name, reason } | null,           // 都不像时
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
- 实体重合 + 时间相邻 + 主题相关三个维度
- confidence < 0.6 → needs_user_choice=true
- 全部 < 0.4 → suggest_create_new
- 用户最近 5 次校正过的项目，权重 +0.15

## Few-shot
> TODO

## 边界
- 没有 existing_projects → suggest_create_new
- 多个 candidate 平分 → tie-break by 用户最近活跃 project

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/episode-to-project-fixtures.md`
