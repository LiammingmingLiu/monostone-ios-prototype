---
name: llm-worker-understanding
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: llm-worker
related-issue: MON-6
related-data-schema: docs/data/card-recording.md (RecordingUnderstanding)
---

# llm-worker · Understanding Prompt

## 用途
从 transcript + summary 提取结构化理解：参与人、Action Items、决策、需要写入 memory 的节点候选。结果存为 understanding artifact，由 understanding-service 暴露给 iOS。

## 输入契约
```typescript
{
  recording_id: string,
  recording_mode: "command" | "todo" | "idea" | "longRec",
  transcript: string,
  summary: <Summary prompt 的输出>,
  user_profile_excerpt: string | null,   // 已有用户画像中相关片段
}
```

## 输出契约
```typescript
{
  participants: Array<{ display_name, confidence }>,
  action_items: Array<{ text, owner?, due_at?, status: "pending" }>,
  decisions: Array<{ text, rationale? }>,
  memory_candidates: Array<{ layer: "raw" | "description", text }>,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）写

## Few-shot
> TODO

## 决策规则
- Action Item 必须能用一句话表达"谁，什么时候，做什么"
- 决策 vs Action Item：决策是"已经决定的事"，Action Item 是"要做的事"
- 不重复抽取（去重靠 LLM 自己 + 后端二次去重）

## 边界
- 没有 action items → 返回空数组
- 责任人识别不出 → owner=null

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/llm-worker-understanding-fixtures.md`
