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
判定 episode 归属于哪个 L3 project（用户的工作 / 长期主题）。
同样用于 M1 的灵感卡片自动归属。

⚠️ **scene 已升到 L4**（在 project 之上），不在本 prompt 范围。
本 prompt 只判定 project（主题项目）。Scene 归属由 `project-to-scene.md` 处理。

## 输入契约
```typescript
{
  episode: { id, title, text, time_range, entity_ids: string[] },
  existing_projects: Array<{ id, name, description, entity_ids, recent_episode_titles[] }>,
  user_recent_corrections: Array<{ episode_id, wrong_project_id, correct_project_id }>,  // 用户校正历史
}
```

## 输出契约（v2）
```typescript
{
  primary_project_id: string | null,
  primary_confidence: number,       // 0-1
  candidates: Array<{ project_id, confidence, reason }>,  // top 3
  needs_user_choice: boolean,       // confidence < 0.6 时 true
  suggest_create_new: {             // 全部 < 0.4 时
    display_name: string,           // ≤ 8 字 "个人健康"
    search_definition: string,      // 给 Agent 检索的密集描述
    reason: string,
  } | null,
  schema_version: 2,
}
```

## System Prompt
> TODO（明明 v2）draft：
>
> 你是 Memory 树的项目归属判定器。把 episode 归到对的 project。
>
> 【判定维度】
> - 实体重合度 (0.4 权重)：episode 的 entities ∩ project.entities / project.entities
> - 时间相邻度 (0.2 权重)：episode 时间 vs project 最近 episodes 时间
> - 主题相似度 (0.4 权重)：基于 search_summary 的语义相似
>
> 【confidence 阈值】
> - confidence < 0.6 → needs_user_choice=true（M1 灵感卡上显示"请确认归属"）
> - 全部候选 < 0.4 → suggest_create_new
>
> 【用户校正学习】
> - 用户最近 5 次校正过的 project，权重 +0.15（针对相似 episode）
>
> 【新建 project 时】
> - display_name ≤ 8 字（"个人健康"、"读书计划"），人话不要行话
> - search_definition：信息密集描述，给后续 episode 归属时做参考

## 决策规则
- 实体重合 + 时间相邻 + 主题相关三个维度，权重 0.4 / 0.2 / 0.4
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
- v2 (2026-05-03): suggest_create_new 拆 display_name + search_definition；scene 拆出去独立 prompt

## Eval
见 `eval/episode-to-project-fixtures.md`
