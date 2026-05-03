---
type: copy
category: error
---

# 错误文案

> 规则：≤ 40 字，必须告诉用户"为什么 + 怎么办"，不暴露技术细节（不写 `API` `500` `network`）

## 录音链路（M1）

| key | 文案 | 后端原因 |
|---|---|---|
| `recording.asr_failed` | 转写失败 · 原音频已保留，可重试 | batch-asr-worker 失败 |
| `recording.understanding_failed` | 整理失败 · 转写已成功，可手动查看 | llm-worker 失败 |
| `recording.upload_timeout` | 上传超时 · 检查网络后重试 | iOS 端超时 |

## Agent / Command（M2）

| key | 文案 |
|---|---|
| `command.plugin_not_connected` | 还没连接 `{plugin}` · 去授权 |
| `command.execution_failed` | 执行失败 · {reason}，可重试 |
| `agent.confirmation_timeout` | 确认超时 · 任务已暂停 |

## Todo / EventKit（M2）

| key | 文案 |
|---|---|
| `todo.calendar_permission_denied` | 需要日历权限 · 设置中开启 |
| `todo.calendar_write_failed` | 写入日历失败 · 重试或手动添加 |

## Memory

| key | 文案 |
|---|---|
| `memory.search_failed` | 搜索失败 · 稍后再试 |
| `memory.delete_failed` | 删除失败 · 稍后再试 |

## Plugins

| key | 文案 |
|---|---|
| `plugin.oauth_failed` | 授权失败 · 重新授权 |
| `plugin.disabled_by_admin` | 该插件暂时不可用 |

## TODO（明明）

- [ ] 短录音分类置信度 < 0.4 时的"请手动选类型"文案
- [ ] OAuth 中断后回到 App 的引导
