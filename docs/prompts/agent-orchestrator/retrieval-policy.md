---
name: agent-retrieval-policy
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: agent-orchestrator-service
backend-env-flag: ENABLE_AGENT_INTELLIGENT_RETRIEVAL_POLICY_V25, AGENT_INTELLIGENT_RETRIEVAL_POLICY_MODE
related-issue: MON-8
---

# agent-orchestrator · Intelligent Retrieval Policy V25

## 用途
Memory fetch pipeline 第 2 步。决定从 memory tree 哪一层（scene / project / episode）开始检索，需不需要展开到 raw 证据。

## 输入契约
```typescript
{
  query: string,                     // 来自 query-router 改写
  query_kind: "factual" | "summary" | "broad",
  user_recent_active_projects: string[],
  budget: { max_nodes: number, max_tokens: number },
}
```

## 输出契约
```typescript
{
  retrieval_plan: Array<{
    layer: "scene" | "project" | "episode" | "description" | "raw",
    filter: { entity_ids?: string[], time_range?: [string, string], project_ids?: string[] },
    limit: number,
  }>,
  expand_to_raw: boolean,
  rationale: string,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
- factual → 优先 description / episode 精确层
- summary → 优先 project / scene 聚合层
- broad → 多层混合 + expand_to_raw=true

## Few-shot
> TODO

## 版本历史
- v1 (2026-05-02): 初版骨架
