---
name: agent-dialogue-writeback
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: agent-orchestrator-service
backend-env-flag: ENABLE_MEMORY_TREE_AGENT_DIALOGUE_WRITEBACK, AGENT_WRITEBACK_MEMORY_ENABLED
related-issue: MON-7
---

# agent-orchestrator · Dialogue Writeback

## 用途
Agent 跟用户聊完一回合后，决定哪些对话内容值得写回 memory（"主动学习"）。不能照抄对话原文。

## 输入契约
```typescript
{
  task_id: string,
  dialogue_turns: Array<{ role, content, created_at }>,  // 最近 N 轮
  retrieved_memory_excerpt: string,
  user_profile_excerpt: string,
}
```

## 输出契约
```typescript
{
  writeback_candidates: Array<{
    target_layer: "raw" | "description" | "user_profile_update",
    text: string,                    // 提炼后的内容
    evidence_turn_ids: string[],     // 哪些对话回合支撑这条
    importance: number,
    rationale: string,
  }>,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）

## 决策规则
- 不写回闲聊 / 重复确认 / Agent 自己说的话（除非用户认可）
- 用户首次表达的偏好 / 关系 / 目标 → user_profile_update
- 客观事实（"我下周去深圳"）→ description
- 长段叙述 → raw

## Few-shot
> TODO

## 边界
- 一回合内多个写回候选 → 都返回
- 全部都不值得写回 → 空数组

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/dialogue-writeback-fixtures.md`
