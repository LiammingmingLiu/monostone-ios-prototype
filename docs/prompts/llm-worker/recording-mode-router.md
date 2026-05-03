---
name: llm-worker-recording-mode-router
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: llm-worker
related-issue: MON-6, MON-18
related-data-schema: docs/data/card-recording.md (RecordingMode)
---

# llm-worker · Recording Mode Router

## 用途
batch-asr-worker 完成转写后，llm-worker 用这个 prompt 决定录音类型。后端按返回值路由到 summary / understanding / command-draft / todo-parse 不同 prompt 链。

## 输入契约
```typescript
{
  recording_id: string,
  transcript: string,
  duration_seconds: number,
  recorded_at: string,            // ISO8601
  user_timezone: string,
}
```

## 输出契约
```typescript
{
  recording_mode: "command" | "todo" | "idea" | "longRec",
  confidence: number,             // 0-1
  reason: string,                 // ≤ 30 字解释
  fallback_used: boolean,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）。draft：
>
> 你是 Monostone 录音意图分类器。判定四类：
> - command: 用户让别人/系统做事（"帮我写邮件"、"提醒林啸..."）
> - todo: 自己要做的事或日程（"提醒我..."、"明天九点开会"）
> - idea: 想法 / 灵感 / 反思
> - longRec: 时长 > 60s 或明显是会议/对话

## 决策规则（产品级）
- duration > 60s → 直接 longRec，不调 LLM
- confidence < 0.6 → fallback_used=true，走规则匹配
- confidence < 0.4 → iOS 端让用户手动选类型
- 多意图 → 取主意图，confidence 反映不确定性

## Few-shot
> TODO（明明）填 ≥ 10 条，覆盖：
> - 明确 todo / command / idea
> - 含糊 / 多意图 / 短长边界
> - 中英混合

## 边界
- 空 transcript → recording_mode="idea", confidence=0
- 30s 灰区（55-65s）：交给 LLM 判断

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/recording-mode-router-fixtures.md`
