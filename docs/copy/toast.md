---
type: copy
category: toast
---

# Toast 文案库

> 规则：≤ 14 字，`·` 分隔，无句号无感叹号

## 录音 / 上传（M1）

| key | 文案 | 触发 |
|---|---|---|
| `recording.uploaded` | 已上传 · 正在转写 | iOS PUT S3 完成 |
| `recording.transcribed` | 转写完成 · 整理中 | UNDERSTANDING_READY 前 |
| `recording.done` | 已完成 | `understanding-service` 200 |
| `recording.upload_failed` | 上传失败 · 重试 | iOS 网络错误 |

## HomeView 卡片 meta-min 状态文案（MON-32）

> 极简版首页：卡片只显示 title + meta-min 一行。meta-min 默认是相对时间，状态非 done 时改成状态文案。

| key | 文案 | 触发 |
|---|---|---|
| `card.meta.relative_time` | `{2 小时前}` / `{45 分钟前}` / `{昨天 22:14}` | done 卡片，默认显示 |
| `card.meta.processing` | 处理中 · 还剩 {X} 分钟 | task status = transcribing/structuring/executing，**ETA 后端没字段时降级为** "处理中" |
| `card.meta.processing_no_eta` | 处理中 | 没 ETA 时的 fallback |
| `card.meta.needs_input` | 需要确认 · {2 小时前} | task status = needs_input/awaiting_input，配右上角黄点 |
| `card.meta.failed` | 失败 · 点击重试 · {3 小时前} | task status = failed，配右上角红点 |

**视觉规则**：
- meta-min 字号 12px，颜色 `--text-dimmer`
- needs_input 时颜色覆盖为 `#d4a868`（暖黄）
- failed 时颜色覆盖为 `--red`

## Action Items（M1）

> ⚠️ MON-9 (2026-05-03) 起，长录音详情页不再显示 Action Items。这些 toast 仅用于 Memory tab 或其他可能展示 Action Item 的场景。

| key | 文案 | 触发 |
|---|---|---|
| `actionItem.accepted` | 已接受 · 同步到提醒事项 | ✓ 勾选 |
| `actionItem.deleted` | 已删除 · Agent 会学习 | 左滑删 |
| `actionItem.undo` | 撤销 | 5s 内 |

## RecordingDetailView 分享（M1, MON-9）

| key | 文案 | 触发 |
|---|---|---|
| `share.transcript_copied` | 已复制原文到剪贴板 | 点底部 `分享原文` |
| `share.summary_sheet_opened` | （无 toast，弹 share sheet） | 点底部 `分享纪要` |

## Command（M2）

> CommandDetailView 极简 V2（MON-16）：底部永远只有 `[拒绝]` `[允许]` 两个按钮，所有 plugin 通用。

| key | 文案 | 触发 |
|---|---|---|
| `command.draft_ready` | 等待你确认 | needs_input 进入 detail |
| `command.allowed` | 已允许 · 正在执行 | 用户点 `允许` |
| `command.rejected` | 已拒绝 | 用户点 `拒绝` |
| `command.executing_cancelled` | 已取消执行 | 用户点 `取消执行`（executing 态） |
| `command.executed` | 已完成 | plugin 执行成功 |
| `command.failed` | 失败 · 点击重试 | task.status = failed |
| `command.context_overflow` | … 还有 {N} 项 › | 上下文 > 4 项时的省略行 |

## Todo（M2）

| key | 文案 | 触发 |
|---|---|---|
| `todo.calendar_added` | 已加入日历 · {时间} | EventKit 写入成功 |
| `todo.conflict` | 和 `{event}` 重叠 · 仍要添加？ | 冲突检测 |
| `todo.calendar_removed` | 已从日历删除 | 卡片删除时 |

## 通用

| key | 文案 |
|---|---|
| `network.offline` | 离线 · 网络恢复后自动同步 |
| `network.retrying` | 正在重试 |
| `permission.granted` | 已授权 |
| `permission.denied` | 已拒绝 · 设置中开启 |

## TODO（明明）

- [x] ~~HomeView 卡片 5 状态 meta-min 文案~~（2026-05-03 完成 MON-32）
- [ ] M1 上传链路文案补全（含 5 状态 toast）
- [ ] M2 command 详细执行步骤的 inline status 文案
- [ ] 灵感卡 auto-attribution 反馈文案
