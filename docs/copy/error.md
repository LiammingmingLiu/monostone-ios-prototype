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

## Plugins (M4 · MON-28)

| key | 文案 |
|---|---|
| `plugin.oauth_failed` | 授权失败 · 在 {provider} 检查权限后重试 |
| `plugin.oauth_expired` | {plugin_name} 授权已过期 · 重新授权 |
| `plugin.disabled_by_admin` | 该插件暂时不可用 |
| `plugin.tool_disabled_by_user` | 我想做 X 但「{tool_name}」被你关了 · 去插件设置打开 |
| `plugin.no_oauth_provider` | 该插件不需要授权 · 直接使用 |
| `plugin.execute_failed` | {plugin_name} 调用失败 · 可在主页让我重试 |

## 录音错误细分（M1 · MON-15 LOCKED）

| key | 文案 | 触发 |
|---|---|---|
| `recording.asr_failed_detail` | 转写失败 · 原音频已保留，可重试 | ASR fail，详情页空白 + [重试转写][下载原音频] |
| `recording.understanding_failed_partial` | AI 未能整理结构化纪要 · 显示完整转写 | LLM 整理失败但 transcript OK，详情页顶部 banner |
| `recording.upload_paused_ring` | 已存戒指 · 联网后自动上传 | 上传中断（飞行模式 / 杀进程），戒指 4h 缓存兜底 |
| `recording.upload_resumed` | 正在补传…  | 网络恢复，自动续传中 |
| `idea.no_attribution_low_confidence` | 未归属 · 点击选项目 | confidence < 0.4，meta 显示"归属 · 未归属 ›" |

## 重试策略（MON-15 LOCKED）

| 错误类型 | 自动重试 | 用户介入 |
|---|---|---|
| 网络错误 (HTTP timeout / ECONNRESET) | 3 次 exponential backoff (1s / 3s / 10s) | 失败后 surface "重试" 按钮 |
| LLM / ASR 错误 (服务端报错) | ❌ 不自动 (可能是内容问题) | 直接 surface "重试" 按钮 |
| 权限错误 (401 / 403) | ❌ | 跳到对应授权页 |
| 戒指 BLE 中断 | iOS 自动重连 | 5s 后失败 toast |

## TODO（明明）

- [x] ~~短录音分类置信度 < 0.4 时的"请手动选类型"文案~~ → MON-18 v2 已 cover (recording-mode-router confidence < 0.4 → idea fallback)
- [ ] OAuth 中断后回到 App 的引导
