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

## Action Items（M1）

| key | 文案 | 触发 |
|---|---|---|
| `actionItem.accepted` | 已接受 · 同步到提醒事项 | ✓ 勾选 |
| `actionItem.deleted` | 已删除 · Agent 会学习 | 左滑删 |
| `actionItem.undo` | 撤销 | 5s 内 |

## Command（M2）

| key | 文案 | 触发 |
|---|---|---|
| `command.draft_ready` | 草稿已生成 · 检查后发送 | confirmation pending |
| `command.executed` | 已发送 | plugin 执行成功 |
| `command.cancelled` | 已取消 | 用户撤销 |
| `command.needs_input` | 需要补充 · 点击查看 | needs_input 状态 |

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

- [ ] M1 上传链路文案补全（含 5 状态）
- [ ] M2 command 详细执行步骤的 inline status 文案
- [ ] 灵感卡 auto-attribution 反馈文案
