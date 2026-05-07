---
name: llm-worker-summary
version: 2
owner: 明明
status: deprecated · 复用 App 现有实现
last-updated: 2026-05-07
backend-service: llm-worker
related-issue: MON-6
related-data-schema: docs/data/card-recording.md (RecordingSummary)
---

# llm-worker · Summary Prompt

## ⚠️ 状态：废弃（v2 ─ 2026-05-07）

**完整总结的 LLM prompt 已在 iOS App 内部实现并部署**（明明 setup，输出 markdown 格式），不在本 spec 维护。

→ 本文件保留作历史归档，**林啸 vibecoding 时不要再写这个 prompt**。

## 现状

- App 内部已有的 prompt 已跑通，用户对效果满意
- 输出格式：markdown
- 触发：长录音点开详情页时（或后台预生成 + 缓存）
- 缓存策略：`card.full_summary_cached` 命中即返回，否则调 LLM 生成

详见：[`docs/sharing-spec.md` §4](../../sharing-spec.md) 关于 full_summary prompt 的早期 spec（**注意：实际 App 实现可能跟 spec §4 略有差异，以 App 实现为准**）。

## 替代方案

| 之前的字段 | 现在怎么得到 |
|---|---|
| `title` | 由 understanding-prompt 输出（参与人 / 议题 / 第一句话） |
| `one_line_summary` | 同上 |
| `structured_summary` | **删除**。完整总结由 App 内部 prompt 直接输出 markdown |

## 版本历史
- v1 (2026-05-02): 初版骨架（含 system prompt + structured_summary）
- **v2 (2026-05-07): 废弃 — App 内部 prompt 已部署，本文件不维护**

## Eval
N/A — 本文件不再演进
