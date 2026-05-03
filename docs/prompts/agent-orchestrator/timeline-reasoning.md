---
name: agent-timeline-reasoning
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_TIMELINE_REASONING_*
related-issue: MON-8
---

# agent-orchestrator · Timeline Reasoning

## 用途
Memory fetch pipeline 第 4 步（可选）。从时间维度分析：density（事件密度）/ schedule pressure（日程压力）/ timebound themes（时间段主题）。

## 输入契约
```typescript
{
  query: string,
  time_range: [string, string],
  events_in_range: Array<{ id, kind, scheduled_at, snippet }>,
  recordings_in_range: Array<{ id, summary }>,
}
```

## 输出契约
```typescript
{
  density_signal: { hot_periods: Array<{ start, end, theme }>, slow_periods: [...] },
  schedule_pressure: number,    // 0-1
  timebound_themes: Array<{ theme, period }>,
  insights: string[],           // 自然语言洞察，给 finalize 用
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
> TODO

## Few-shot
> TODO

## 版本历史
- v1 (2026-05-02): 初版骨架
