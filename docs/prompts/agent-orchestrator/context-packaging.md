---
name: agent-context-packaging
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_CONTEXT_PACKAGING_*
related-issue: MON-8
---

# agent-orchestrator · Context Packaging

## 用途
Memory fetch pipeline 第 3 步。把检索到的证据 → 去重 → 截断 → 分桶 → 排序 → 打 importance 标签 → 生成 summary candidates。最终给到 finalize / planner 用。

## 输入契约
```typescript
{
  query: string,
  retrieved_nodes: Array<{ id, layer, text, importance, recency, entities }>,
  budget: { max_tokens: number },
}
```

## 输出契约
```typescript
{
  buckets: {
    primary: Array<{ node_id, snippet, importance_label: "critical" | "supporting" | "background" }>,
    timeline: Array<{ node_id, snippet }> | null,
    pattern: Array<{ node_id, snippet }> | null,
  },
  summary_candidates: string[],   // Abstraction LLM 生成的 N 个候选 summary，给 finalize 选
  total_tokens: number,
  truncated: boolean,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）— 包含 Structuring LLM + Abstraction LLM 两步

## 决策规则
- 去重：embedding 相似度 > 0.92
- 截断：先丢 background → supporting → 保 critical
- 分桶大小比例：primary 60% / timeline 25% / pattern 15%

## Few-shot
> TODO

## 版本历史
- v1 (2026-05-02): 初版骨架
