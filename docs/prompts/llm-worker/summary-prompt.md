---
name: llm-worker-summary
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: llm-worker
backend-trigger: LLM_EVENTS_QUEUE_URL
related-issue: MON-6
related-data-schema: docs/data/card-recording.md (RecordingSummary)
---

# llm-worker · Summary Prompt

## 用途
batch-asr-worker 完成转写后，llm-worker 用这个 prompt 把 transcript 压成 summary（title + one_line_summary + 长 mode 的 structured_summary）。

## 输入契约
```typescript
{
  recording_id: string,
  recording_mode: "command" | "todo" | "idea" | "longRec",  // 来自 recording-mode-router
  transcript: string,                  // ASR 原文
  duration_seconds: number,
  recorded_at: string,                 // ISO8601
  user_locale: string,
  user_timezone: string,
}
```

## 输出契约
```typescript
{
  title: string,                       // ≤ 20 字
  one_line_summary: string,            // ≤ 60 字
  structured_summary: {                // 仅 longRec 有
    sections: Array<{
      heading: string,
      bullets: string[]
    }>
  } | null,
  schema_version: 1,
}
```

## System Prompt

> TODO（明明）写正式 prompt。draft：
>
> 你是 Monostone 的录音摘要器。用户对着戒指说话，你把转写文本压成一个能让用户 1 秒看懂的标题和概览。
> 长录音（longRec）额外生成 6 段结构化摘要：参与人 / 议题 / 决策 / 行动 / 风险 / 下一步。
> 严格按输出 JSON schema 返回，不要 markdown，不要解释。

## Few-shot

> TODO（明明）填 3-5 条覆盖：
> - 长录音正常会议
> - 灵感独白
> - 含数字 / 人名 / 公司名
> - 中英混合
> - 含糊 / 重复表达

## 决策规则
- title 不能包含人名隐私敏感信息（除非用户已显式同意，由 user-profile 决定）
- 检测到完全无法理解的 transcript → 用第一句话作 title

## 边界
- 空 transcript → title="（无内容）", structured_summary=null
- transcript < 10 字 → 不生成 structured_summary

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/llm-worker-summary-fixtures.md`（MON-23）
