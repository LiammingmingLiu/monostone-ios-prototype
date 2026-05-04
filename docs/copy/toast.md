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

## Live Activity 5 状态文案（M1, MON-14）

> Live Activity 范围：iOS 灵动岛 + 锁屏浮动卡片。home feed 内卡片状态文案另见 §HomeView 卡片 meta-min。

| key | 文案 | 触发 / 视觉 |
|---|---|---|
| `la.uploading` | 上传中 | iOS PUT S3 中 · spinner |
| `la.transcribing` | 转写中 | batch-asr-worker · spinner |
| `la.structuring` | 整理中 | llm-worker / understanding-service · spinner |
| `la.done` | 已完成 | understanding-service 返回 · ✓ |
| `la.failed` | 失败 · 点击重试 | task.status=failed · ! |

**视觉规则**：
- 锁屏 / 灵动岛展开：图标 + 标题 + 副标题（"和敦敏的 Series A · 处理 1 条录音"）+ trail (spinner / ✓ / !)
- 灵动岛紧凑态 (Dynamic Island compact)：状态 emoji + 数字（处理几条）
- 多录音并发：合并显示 "处理 N 条录音中"（不堆叠 / 不丢失）
- ETA "还剩 X 分钟" v0.5 不显示（后端无字段, MON-32 已决定）
- failed 不显示具体原因（极简, 详细原因看卡片错误态 MON-15）

**交互**：
- 处理中 3 状态：仅显示，不可 dismiss
- done 状态：**停留 5 秒后自动收起**（点击进入 = 立即收起 + 跳详情）
- failed 状态：点击 → 跳首页对应卡片，在卡片上重试（Live Activity 不承载 [重试] 按钮）

## RecordingDetailView 分享（M1, MON-9）

| key | 文案 | 触发 |
|---|---|---|
| `share.transcript_copied` | 已复制原文到剪贴板 | 点底部 `分享原文` |
| `share.summary_sheet_opened` | （无 toast，弹 share sheet） | 点底部 `分享纪要` |

## IdeaDetailView 灵感详情页（M1, MON-10）

| key | 文案 | 触发 |
|---|---|---|
| `idea.attribution_changed` | 已归属到「{project}」 · Agent 会学习 | 点 §C 归属 → 弹框选项目 |
| `attribution.changed` | 已归属到「{project}」 · Agent 会学习 | 点 meta line 归属 → 弹 sheet 选 (rec + idea 通用) |
| `attribution.new_project` | 新建项目 · 开发中 | 点 "+ 新建项目"（v0.5 mock） |
| `idea.to_command_created` | 已创建指令任务 · 跳到确认页 | 点 §E action card "让 Agent 做 X" / "写成 X" |
| `idea.to_todo_added` | 已加入待办 · 已写入 Apple 提醒事项 | 点 §E action card "加成 todo" |

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

## 日程 / Smart Calendar（M2 · MON-17）

> v0.5 不存在 todo / 待办类型；语音里"提醒我 X 时 Y"全部归"日程"。日程不只是日历事件，是 Smart Calendar（带 Smart Brief）。
> 全 App 禁止 emoji（明明强调），冲突视觉用红色 + 排版承载，不用 ⚠️。

| key | 文案 | 触发 |
|---|---|---|
| `cal.added` | 已加入日历 · 撤销 | EventKit 写入成功（5s toast 含撤销） |
| `cal.undone` | 已撤销 | 5s 内点撤销 |
| `cal.parse_failed` | 时间没识别出来 · 在主页跟我说一句 | cal_parse.parse_failed = true |
| `cal.removed` | 已从日历移除 | navbar `···` → 从日历移除 |
| `cal.brief_loading` | 正在为你想想… | §C Smart Brief async loading |
| `cal.opened_in_apple` | 打开 Apple 日历 | §D 点 `打开` 按钮 |

## 通用

| key | 文案 |
|---|---|
| `network.offline` | 离线 · 网络恢复后自动同步 |
| `network.retrying` | 正在重试 |
| `permission.granted` | 已授权 |
| `permission.denied` | 已拒绝 · 设置中开启 |

## Plugins (M4 · MON-28)

> 关键原则：toggle 是即时操作，不用感叹号 / 不用"成功"。toast 仅在用户主动 toggle 时弹（自动状态变化不弹）。

| key | 文案 | 触发 |
|---|---|---|
| `plugin.tool_enabled` | 已开启「{tool_name}」 | 单个 tool toggle on |
| `plugin.tool_disabled` | 已关闭「{tool_name}」 | 单个 tool toggle off |
| `plugin.all_enabled` | 已开启 {plugin_name} 全部能力 | 顶部"全部能力" toggle on |
| `plugin.all_disabled` | 已停用 {plugin_name} | 顶部"全部能力" toggle off |
| `plugin.oauth_relinking` | 正在重新授权… | 点"重新授权"链接 |
| `plugin.oauth_success` | {plugin_name} · 重新授权完成 | OAuth 回调成功 |
| `plugin.oauth_failed` | 授权失败 · 在 {provider} 检查权限 | OAuth 回调失败 |
| `plugin.installing` | 正在连接 {plugin_name}… | 首次安装 OAuth 跳浏览器前 |
| `plugin.installed` | {plugin_name} 已就绪 | 首次安装 + scope 配置完成 |

## TODO（明明）

- [x] ~~HomeView 卡片 5 状态 meta-min 文案~~（2026-05-03 完成 MON-32）
- [ ] M1 上传链路文案补全（含 5 状态 toast）
- [ ] M2 command 详细执行步骤的 inline status 文案
- [ ] 灵感卡 auto-attribution 反馈文案
