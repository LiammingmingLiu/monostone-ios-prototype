---
name: agent-pattern-reasoning
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_PATTERN_REASONING_*
related-issue: MON-8
---

# agent-orchestrator · Pattern Reasoning

## 用途
Memory fetch pipeline 第 5 步（可选）。挖重复信号：repeat signal / habit candidates。例如"用户每周三都开 sync 会"。

## 输入契约
```typescript
{
  query: string,
  candidate_signals: Array<{ episode_id, theme, occurred_at, entities }>,
}
```

## 输出契约
```typescript
{
  repeat_signals: Array<{
    pattern_kind: "weekly" | "monthly" | "topic_recurrence" | "entity_recurrence",
    description: string,
    confidence: number,
    evidence_episode_ids: string[],
  }>,
  habit_candidates: Array<{
    description: string,
    suggested_user_profile_update: object | null,
  }>,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
- 至少 3 次 evidence 才报 pattern
- habit_candidate 要主动让用户确认（不直接写入 user_profile）

## Few-shot
> TODO

## 版本历史
- v1 (2026-05-02): 初版骨架
