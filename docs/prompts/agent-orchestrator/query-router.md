---
name: agent-query-router
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_QUERY_ROUTER_*
related-issue: MON-8
---

# agent-orchestrator · Query Router

## 用途
Memory fetch pipeline 第 1 步。决定要不要查 memory，查什么类型（factual / summary / broad），交给哪条 reasoner（timeline / pattern）。

## 输入契约
```typescript
{
  user_query: string,
  recent_dialogue: Array<{ role, content }>,  // 当前 task 最近 N 轮
  task_kind: "command_execute" | "brainstorm" | "clarification" | "dialogue",
}
```

## 输出契约
```typescript
{
  needs_memory: boolean,
  query_kind: "factual" | "summary" | "broad" | null,
  use_timeline_reasoner: boolean,
  use_pattern_reasoner: boolean,
  rewrite_query: string | null,        // 改写后的检索 query
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
- 简单聊天（"你好"）→ needs_memory=false
- 时间相关（"上周..."）→ use_timeline_reasoner=true
- 重复模式（"我每次..."）→ use_pattern_reasoner=true

## Few-shot
> TODO

## 版本历史
- v1 (2026-05-02): 初版骨架
