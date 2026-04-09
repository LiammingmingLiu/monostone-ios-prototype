# 数据模型定义

> **范围**：从 `index.html` 原型代码反推的所有核心数据实体。字段类型基于代码中的实际使用方式推断，可能在真实后端实现时需要微调。
>
> **标记规则**：
> - 必填列用 `✓` / `✗`
> - 字段类型使用 TypeScript 风格表示
> - 字符串常量类型（union）在"说明"列列出完整枚举

---

## 1. User · 用户

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | 唯一标识（后端 UUID 或 Apple ID hash） |
| `name` | `string` | ✓ | 显示名，原型里写死为"明明" |
| `avatar` | `string \| null` | ✗ | 头像 URL；原型直接显示单字"明" |
| `subscription` | `'free' \| 'pro' \| 'max'` | ✓ | 订阅档位；原型 hardcode 为 `'max'` |
| `day_count` | `number` | ✓ | 从注册至今的天数（原型"第 12 天"） |
| `onboarded_at` | `string (ISO 8601)` | ✗ | 完成引导的时间戳 |
| `created_at` | `string (ISO 8601)` | ✓ | 注册时间 |

**枚举值**：
- `subscription`：`free` / `pro` / `max`

---

## 2. RingStatus · 戒指状态

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `connected` | `boolean` | ✓ | BLE 是否已连接 |
| `battery_pct` | `number` | ✓ | 电量百分比 0-100；原型 hardcode 87 |
| `firmware_version` | `string` | ✓ | 固件版本号 |
| `last_sync_at` | `string (ISO 8601)` | ✓ | 最后同步时间 |
| `local_storage_used_mb` | `number` | ✗ | 戒指本地已用存储 |
| `local_storage_total_mb` | `number` | ✗ | 戒指总存储（原型定义为 ≈ 64 MB Byte = 512 Mb，4 小时压缩录音） |

**关联**：`RingStatus.user_id → User.id`（1:1）

---

## 3. Card · 卡片（核心聚合根）

所有 Feed 里的条目都是 Card，用 `type` 判别子类。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | 格式如 `rec-1` / `cmd-1` / `idea-1` / `todo-1` |
| `user_id` | `string` | ✓ | 所属用户 |
| `type` | `'long_rec' \| 'cmd' \| 'idea' \| 'todo'` | ✓ | 卡片子类型 |
| `title` | `string` | ✓ | 卡片标题 |
| `status` | `'processing' \| 'done' \| 'failed'` | ✓ | 处理状态；决定是否显示 shimmer |
| `processing_meta` | `string \| null` | ✗ | 处理中的描述文案，如"上传中" / "ASR 运行中" / "结构化分析中" |
| `created_at` | `string (ISO 8601)` | ✓ | 创建时间 |
| `time_relative` | `string` | ✓ | 相对时间文案"2 小时前" / "刚刚" —— **可由 client 本地计算，不必存** |
| `duration_sec` | `number` | ✗ | 仅 `long_rec` 有效，录音时长 |
| `participants_count` | `number` | ✗ | 仅 `long_rec` 有效 |
| `owner` | `string` | ✗ | 仅 `cmd` / `todo` 有效，负责人 |
| `deadline` | `string` | ✗ | 仅 `cmd` / `todo` 有效 |
| `project` | `string` | ✗ | 所属项目名 |
| `pending_action_count` | `number` | ✗ | 仅 `long_rec` 有效，待处理 action items 数 |
| `deleted_at` | `string \| null` | ✗ | 软删除时间 |

**枚举值**：
- `type`：`long_rec`（长录音） / `cmd`（指令） / `idea`（灵感） / `todo`（待办）
- `status`：`processing` / `done` / `failed`

**关联关系**：
- `Card.user_id → User.id` （N:1）
- `Card` 1:1 `LongRecDetail` / `CommandDetail` / `IdeaDetail` / `ScheduleDetail`（根据 type）
- `Card` 1:N `ActionItem`（仅 `long_rec` 类型有）
- `Card` 1:1 `FullSummary`（仅 `long_rec` 类型有）

---

## 4. LongRecDetail · 长录音详情

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `card_id` | `string` | ✓ | 外键 → Card.id |
| `participants` | `Participant[]` | ✓ | 参与人列表 |
| `summary_bullets` | `SummaryBullet[]` | ✓ | 结构化摘要的 bullet points |
| `decisions` | `Decision[]` | ✗ | 会议中的关键决策 |
| `memory_insights` | `MemoryInsight[]` | ✓ | 本次会议学到的新信息 |
| `audio_url` | `string \| null` | ✗ | 原始音频 URL（根据隐私配置决定是否上传） |
| `transcript` | `string \| null` | ✗ | 完整转写 |

### 4.1 Participant · 参与人

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | ✓ | 显示名 |
| `avatar` | `string \| null` | ✗ | 头像 URL 或单字（如"敦"） |
| `role` | `string \| null` | ✗ | 身份，如"Linear Capital 合伙人" |

### 4.2 SummaryBullet · 摘要点

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `text` | `string` | ✓ | bullet 文本 |
| `order` | `number` | ✓ | 显示顺序 |

### 4.3 Decision · 决策

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `content` | `string` | ✓ | 决策内容 |
| `suggested_by` | `string` | ✗ | 提议人 |
| `status` | `'approved' \| 'pending_review'` | ✓ | 决策状态 |

### 4.4 MemoryInsight · 记忆洞察

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `entity` | `string` | ✓ | 实体名（人 / 概念 / 项目） |
| `learning` | `string` | ✓ | 新学到的信息 |
| `confidence` | `number` | ✗ | 置信度 0-1 |

**关联**：`LongRecDetail.card_id → Card.id`（1:1，仅 `type=long_rec`）

---

## 5. FullSummary · 完整会议纪要

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `card_id` | `string` | ✓ | 外键 → Card.id |
| `title` | `string` | ✓ | 纪要总标题（H1） |
| `meta` | `Record<string, string>` | ✓ | 基本信息键值对 |
| `sections` | `FullSummarySection[]` | ✓ | 分章节内容 |
| `generated_at` | `string (ISO 8601)` | ✓ | 生成时间 |
| `model_version` | `string` | ✓ | 生成使用的模型版本 |

### 5.1 `meta` 的固定 key

| Key | 说明 |
|---|---|
| `会议时间` | 例"2026 年 4 月 9 日（周三） 10:30 – 11:12" |
| `会议时长` | 例"42 分 18 秒" |
| `参会人员` | 例"敦敏（Linear Capital 合伙人）、明明（Monostone CEO）…" |
| `会议项目` | 例"Series A 融资 · D-Day" |
| `会议形式` | 例"线下会议 · Linear Capital 上海办公室" |

### 5.2 FullSummarySection · 章节

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `h` | `string` | ✓ | H2 标题（如"会议背景"、"议题一 · Infrastructure vs Closed-Loop 产品定位"） |
| `paragraphs` | `string[]` | ✓ | 每一项为原始 HTML 块：`<p>` / `<h3>` / `<blockquote>` / `<ul>` / `<ol>` / `<table>` / `<strong>` 等 |

**层级契约（渲染约定）**：
- 仅 1 个 `<h1>` = 纪要总标题
- `<h2>` = section.h
- `<h3>` = section.paragraphs 里的子标题
- **禁止跳级**

**关联**：`FullSummary.card_id → Card.id`（1:1，仅 `type=long_rec`）

---

## 6. ActionItem · 待办项

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | 格式 `ai-1` / `ai-2` |
| `card_id` | `string` | ✓ | 外键 → Card.id（来源长录音） |
| `text` | `string` | ✓ | 待办正文 |
| `owner` | `string` | ✓ | 负责人 |
| `deadline` | `string` | ✓ | 截止时间文案（如"4 月底" / "本周"） |
| `status` | `'pending' \| 'done' \| 'rejected'` | ✓ | 状态 |
| `source_quote` | `string` | ✗ | 原话引用 |
| `source_card_id` | `string` | ✓ | 源卡片 id |
| `source_time` | `string \| null` | ✗ | 源时间戳（如"14:32"） |
| `agent_suggestions` | `string[]` | ✓ | 3 条 AI prompt 建议 |
| `created_at` | `string (ISO 8601)` | ✓ | |
| `done_at` | `string \| null` | ✗ | 完成时间 |
| `rejected_at` | `string \| null` | ✗ | 拒绝时间 |
| `rejection_reason` | `string \| null` | ✗ | 仅 `'user_reject_swipe'` |

**枚举值**：
- `status`：`pending` / `done` / `rejected`

**副作用（后端逻辑）**：
- `status → done`：自动同步到 Apple Reminders + Linear（若已连接）；Memory 写入 commitment
- `status → rejected`：软删除；**不**写入 Memory；反馈给分类器训练

**关联**：`ActionItem.source_card_id → Card.id`（N:1，仅 `type=long_rec`）

---

## 7. CommandDetail · 指令详情

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `card_id` | `string` | ✓ | 外键 → Card.id |
| `user_prompt` | `string` | ✓ | 用户原话 |
| `execution_time_ms` | `number` | ✓ | 总耗时（毫秒） |
| `contexts_used` | `Context[]` | ✓ | 使用到的 context 列表 |
| `steps` | `ExecutionStep[]` | ✓ | 执行步骤 |
| `output` | `CommandOutput \| null` | ✗ | 产出物 |
| `chat_history` | `ChatMessage[]` | ✗ | 后续追加对话 |

### 7.1 Context · 引用的上下文

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `name` | `string` | ✓ | 显示名（如"今早 Series A 跟进会"） |
| `source` | `string` | ✓ | 来源标识（如"42 分钟录音" / "Memory" / "自动学习" / "Notion"） |
| `confirmed` | `boolean` | ✓ | 是否被 Agent 实际使用 |
| `card_id` | `string \| null` | ✗ | 如果来自另一张卡片 |

### 7.2 ExecutionStep · 执行步骤

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | `string` | ✓ | 步骤标题（"解析指令意图"） |
| `description` | `string` | ✓ | 步骤描述（"识别为邮件起草任务 · 0.3s"） |
| `status` | `'done' \| 'running' \| 'pending'` | ✓ | |
| `duration_ms` | `number \| null` | ✗ | 该步骤耗时 |

### 7.3 CommandOutput · 产出

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `type` | `'email' \| 'report' \| 'code' \| 'doc' \| 'other'` | ✓ | |
| `body` | `string` | ✓ | HTML / Markdown / 纯文本 |
| `metadata` | `Record<string, string> \| null` | ✗ | 如 `{ recipient, subject, timestamp }` |

### 7.4 ChatMessage · 对话消息

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `role` | `'user' \| 'bot'` | ✓ | |
| `content` | `string` | ✓ | |
| `timestamp` | `string (ISO 8601)` | ✓ | |

**关联**：`CommandDetail.card_id → Card.id`（1:1，仅 `type=cmd`）

---

## 8. IdeaDetail · 灵感详情

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `card_id` | `string` | ✓ | 外键 → Card.id |
| `recording_url` | `string \| null` | ✗ | 原音频 URL |
| `transcript` | `string` | ✓ | 完整转写 |
| `duration_sec` | `number` | ✓ | 通常很短（8 秒级） |
| `creation_context` | `string` | ✓ | 捕捉场景（"走路时" / "开车时" / "电脑前"） |
| `confidence_pct` | `number` | ✓ | 自动归属置信度 0-100 |
| `auto_category` | `AutoCategory` | ✓ | 自动分类结果 |
| `related_ideas` | `RelatedIdea[]` | ✗ | 关联的同主题灵感 |
| `chat_history` | `ChatMessage[]` | ✗ | 与 Agent 的追问对话 |

### 8.1 AutoCategory

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `project` | `string` | ✓ | 自动归类到的项目名 |
| `confidence_pct` | `number` | ✓ | 0-100 |

### 8.2 RelatedIdea

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | → Card.id |
| `type` | `'idea' \| 'long_rec' \| 'cmd'` | ✓ | |
| `created_at` | `string` | ✓ | |
| `similarity_pct` | `number` | ✓ | 相似度 0-100 |
| `snippet` | `string` | ✓ | 前 50 字预览 |

**关联**：`IdeaDetail.card_id → Card.id`（1:1，仅 `type=idea`）

---

## 9. ScheduleDetail · 日程详情

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `card_id` | `string` | ✓ | 外键 → Card.id |
| `datetime` | `string (ISO 8601)` | ✓ | 日程时间点 |
| `duration_min` | `number \| null` | ✗ | 时长（分钟） |
| `location` | `string \| null` | ✗ | 地点 |
| `source` | `string` | ✓ | 来源描述（"30 分钟前捕捉" / "Agent 建议"） |
| `synced_to` | `('apple_calendar' \| 'linear' \| 'notion')[]` | ✓ | 已同步到的平台 |
| `completed_at` | `string \| null` | ✗ | 完成时间 |

**关联**：`ScheduleDetail.card_id → Card.id`（1:1，仅 `type=todo`）

---

## 10. DailySummary · 今日速览

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `date` | `string (YYYY-MM-DD)` | ✓ | |
| `greeting` | `string` | ✓ | "早上好, 明明" |
| `day_count` | `number` | ✓ | 从注册至今的天数 |
| `interactions_today` | `number` | ✓ | 今日交互次数 |
| `time_saved_minutes` | `number` | ✓ | 今日节省时间 |
| `interaction_breakdown` | `InteractionBreakdown` | ✓ | 交互来源分布 |
| `card_counts` | `CardCounts` | ✓ | 按类型分组的卡片数量 |

### 10.1 InteractionBreakdown

| 字段 | 类型 | 说明 |
|---|---|---|
| `walking` | `number` | 走路时 |
| `post_meeting` | `number` | 会后 |
| `at_desk` | `number` | 电脑前 |

### 10.2 CardCounts

| 字段 | 类型 | 说明 |
|---|---|---|
| `all` | `number` | |
| `long_rec` | `number` | |
| `cmd` | `number` | |
| `idea` | `number` | |
| `todo` | `number` | |

---

## 11. DeliveryTarget · 投递目标

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `platform` | `'apple_calendar' \| 'linear' \| 'notion' \| 'gmail' \| 'obsidian' \| 'google_calendar'` | ✓ | |
| `status` | `'connected' \| 'not_connected'` | ✓ | |
| `connected_at` | `string \| null` | ✗ | |
| `metadata` | `DeliveryTargetMetadata` | ✗ | 平台相关参数 |
| `scopes` | `string[]` | ✗ | OAuth 授权范围 |
| `access_token` | `string (encrypted)` | ✗ | 加密存储的 OAuth token |
| `refresh_token` | `string (encrypted)` | ✗ | |

### 11.1 DeliveryTargetMetadata

| 字段 | 类型 | 说明 |
|---|---|---|
| `account_email` | `string \| null` | "mingming@icloud.com" |
| `workspace` | `string \| null` | "team:Monostone" |
| `project` | `string \| null` | "project:Hardware" |

---

## 12. APIKeyConfig · BYOK 配置

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `provider` | `'anthropic' \| 'openai' \| 'google_gemini'` | ✓ | |
| `encrypted_key` | `string` | ✓ | KMS 加密后的 key |
| `masked_key` | `string` | ✓ | 显示用（"sk-ant-****fh7Q"） |
| `configured_at` | `string` | ✓ | |
| `monthly_usage` | `APIKeyUsage` | ✗ | 本月用量统计 |

### 12.1 APIKeyUsage

| 字段 | 类型 | 说明 |
|---|---|---|
| `token_count` | `number` | 240 万 |
| `cost_usd` | `number` | |
| `period_start` | `string (ISO 8601)` | |

**安全要求**：`encrypted_key` 必须经过 KMS envelope 加密，不可明文日志

---

## 13. ModelConfig · 模型配置

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `model` | `string` | ✓ | 如 `claude-opus-4-6` / `gpt-4o` / `claude-haiku-4-5` |
| `is_default` | `boolean` | ✓ | 是否为当前默认 |
| `use_case` | `string` | ✓ | 说明（"长录音结构化 · 指令执行默认"） |

---

## 14. CalendarConnection · 日历连接

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `platform` | `'apple_calendar' \| 'google_calendar' \| 'outlook'` | ✓ | |
| `status` | `'connected' \| 'not_connected'` | ✓ | |
| `metadata` | `string \| null` | ✗ | "主日历 · 通过 EventKit" |

---

## 15. ReminderPolicy · 提醒策略

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `auto_remind` | `boolean` | ✓ | 自动提前提醒 |
| `meeting_advance_min` | `number` | ✓ | 会议提前 10 分钟 |
| `task_advance_min` | `number` | ✓ | 待办提前 60 分钟 |
| `commute_correction` | `boolean` | ✓ | 通勤时间修正 |
| `default_write_target_type` | `'calendar' \| 'reminders'` | ✓ | |
| `default_write_target_platform` | `string` | ✓ | |

---

## 16. PrivacyConfig · 隐私配置

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `audio_storage` | `'device_only' \| 'cloud_encrypted'` | ✓ | |
| `retention_days` | `number \| null` | ✓ | `30` / `90` / `null`（永久） |
| `permissions` | `PermissionStatus[]` | ✓ | iOS 系统权限状态镜像 |

### 16.1 PermissionStatus

| 字段 | 类型 | 说明 |
|---|---|---|
| `permission` | `'microphone' \| 'bluetooth' \| 'location' \| 'calendar'` | |
| `status` | `'authorized' \| 'denied' \| 'not_determined'` | |
| `usage` | `string` | 用途说明，如"用于手动录音按钮" |

---

## 17. ExportJob · 数据导出任务

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | |
| `user_id` | `string` | ✓ | |
| `scope` | `'full' \| 'long_rec_only' \| 'cmd_only' \| 'idea_only'` | ✓ | |
| `format` | `'markdown' \| 'json'` | ✓ | |
| `include_audio` | `boolean` | ✓ | |
| `status` | `'pending' \| 'running' \| 'ready' \| 'failed'` | ✓ | |
| `progress_pct` | `number` | ✓ | 0-100 |
| `estimated_size_mb` | `number` | ✓ | |
| `download_url` | `string \| null` | ✗ | 仅 `ready` 状态有 |
| `created_at` | `string` | ✓ | |
| `completed_at` | `string \| null` | ✗ | |

---

## 18. AdvancedSettings · 高级设置

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `user_id` | `string` | ✓ | |
| `classification` | `ClassificationPolicy` | ✓ | |
| `hardware` | `HardwareSettings` | ✓ | |
| `dev` | `DevSettings` | ✓ | |

### 18.1 ClassificationPolicy

| 字段 | 类型 | 说明 |
|---|---|---|
| `auto_classify` | `boolean` | 由 AI 判断短录音类型 |
| `confirm_low_confidence` | `boolean` | 置信度低时询问用户 |
| `confidence_threshold_pct` | `number` | 默认 70 |

### 18.2 HardwareSettings

| 字段 | 类型 | 说明 |
|---|---|---|
| `haptic_feedback` | `boolean` | |
| `hold_confirm_duration_ms` | `number` | 默认 300 |

### 18.3 DevSettings

| 字段 | 类型 | 说明 |
|---|---|---|
| `debug_logging` | `boolean` | |
| `mock_ring` | `boolean` | |
| `local_cache_size_mb` | `number` | |

---

## 19. Memory · 记忆条目

> **注**：原型 `memory_tab` 页面显示 Memory tree 统计 + entities + insights + corrections，Memory 作为独立实体需要完整建模。详见 `docs/data-flow.md` 的 Memory Tree L0-L4 层级。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | |
| `user_id` | `string` | ✓ | |
| `entity_id` | `string \| null` | ✗ | 关联的实体 id（见 Entity 实体） |
| `entity` | `string` | ✓ | 冗余显示名 |
| `learning` | `string` | ✓ | 学到的内容 |
| `confidence` | `number` | ✓ | 0-1 |
| `source_card_id` | `string` | ✓ | 首次被学到的源卡片 |
| `first_seen_at` | `string (ISO 8601)` | ✓ | |
| `last_confirmed_at` | `string (ISO 8601)` | ✗ | 最后一次被引用 / 确认的时间 |
| `corrections_count` | `number` | ✓ | 被用户纠正过几次 |
| `status` | `'active' \| 'corrected' \| 'deprecated'` | ✓ | |
| `level` | `'L0' \| 'L1' \| 'L2' \| 'L3' \| 'L4'` | ✓ | Memory Tree 层级 |

**关联**：
- `Memory.source_card_id → Card.id`（N:1）
- `Memory.user_id → User.id`（N:1）
- `Memory.entity_id → Entity.id`（N:1）
- Memory 之间存在 parent-child 关系（L0 Scene → L1 Project → L2 Episode → L3 Description → L4 Raw）

---

## 19.a Entity · 实体

> **场景**：`memory_tab` 页面的高频实体列表。Entity 是 Memory 之上的聚合——同一个"敦敏"下可能有几十条独立的 Memory 记录，但对用户而言他们会把"敦敏"视为一个整体来浏览。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | |
| `user_id` | `string` | ✓ | |
| `name` | `string` | ✓ | 显示名 |
| `avatar` | `string \| null` | ✗ | 单字 / 首字母 / URL |
| `kind` | `'人' \| '项目' \| '组织' \| '概念' \| '事件'` | ✓ | 实体类型 |
| `memory_count` | `number` | ✓ | 聚合到该实体的 memory 数量（冗余字段，便于列表快速显示） |
| `sub` | `string` | ✗ | 一行副标题 |
| `first_seen_at` | `string` | ✓ | |
| `last_seen_at` | `string` | ✓ | |
| `mentioned_in_cards` | `string[]` | ✓ | 提及过该实体的卡片 id 列表 |

**枚举值**：
- `kind`：`人` / `项目` / `组织` / `概念` / `事件`

**关联**：
- `Entity.user_id → User.id`（N:1）
- `Entity` 1:N `Memory`

---

## 19.b MemoryOverview · 记忆页概览 (页面聚合结构)

> **用途**：`memory_tab` 页面一次性拉取的聚合数据（对应 `GET /v1/memory/overview`）。这是一个**页面视图模型**，不是持久化实体——后端可以实时聚合计算。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `stats` | `MemoryTreeStats` | ✓ | Memory Tree 5 层计数 |
| `insights` | `MemoryInsight[]` | ✓ | 今天新学到的 N 条（通常 3-5 条） |
| `entities` | `Entity[]` | ✓ | Top-N 高频实体 |
| `corrections` | `CorrectionRecord[]` | ✓ | 最近 N 条 human correction |

### 19.b.1 MemoryTreeStats

| 字段 | 类型 | 说明 |
|---|---|---|
| `L0_scenes` | `number` | L0 场景层级条数 |
| `L1_projects` | `number` | L1 项目层级条数 |
| `L2_episodes` | `number` | L2 片段层级条数 |
| `L3_descriptions` | `number` | L3 描述层级条数 |
| `L4_raw` | `number` | L4 原始层级条数 |

### 19.b.2 CorrectionRecord

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | |
| `body` | `string` | 纠正描述（HTML 片段） |
| `source` | `string` | 时间戳 + 状态描述 |
| `effect` | `string` | `propagated_N` 表示级联更新了 N 条 memory |
| `corrected_by_user_at` | `string (ISO 8601)` | |

---

## 19.c AgentConversation · Agent 聊天会话

> **场景**：`agent_tab` 页面的 IM 聊天视图。每天自动开一个新 conversation（也可以手动跨天串起来）。

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | conversation id |
| `user_id` | `string` | ✓ | |
| `agent_model` | `string` | ✓ | 如 `Claude Opus 4.6` |
| `context_days_loaded` | `number` | ✓ | 加载了多少天的 context |
| `started_at` | `string (ISO 8601)` | ✓ | |
| `last_message_at` | `string (ISO 8601)` | ✓ | |
| `message_count` | `number` | ✓ | |

**关联**：
- `AgentConversation.user_id → User.id`（N:1）
- `AgentConversation` 1:N `AgentMessage`

---

## 19.d AgentMessage · Agent 聊天消息

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `id` | `string` | ✓ | |
| `conversation_id` | `string` | ✓ | |
| `role` | `'date' \| 'system' \| 'user' \| 'agent'` | ✓ | |
| `type` | `'text' \| 'steps' \| 'attachment' \| 'actions' \| 'typing'` | ✓ | 消息子类型 |
| `text` | `string \| null` | ✗ | `type=text/date/system` 时使用（HTML 片段，允许 `<b>` / `<br>`） |
| `steps` | `AgentThinkingStep[] \| null` | ✗ | `type=steps` 时使用 |
| `attachment` | `AgentAttachment \| null` | ✗ | `type=attachment` 时使用 |
| `actions` | `AgentQuickAction[] \| null` | ✗ | `type=actions` 时使用 |
| `timestamp` | `string (ISO 8601)` | ✓ | |
| `input_mode` | `'text' \| 'voice' \| null` | ✗ | 仅 `role=user` 时有意义 |
| `source_audio_url` | `string \| null` | ✗ | 语音输入时的原音频 |

**枚举值**：
- `role`：`date`（日期分隔符）/ `system`（系统提示）/ `user`（用户）/ `agent`（AI）
- `type`：`text`（普通文本气泡）/ `steps`（可折叠的思考步骤）/ `attachment`（附件卡片）/ `actions`（快捷按钮组）/ `typing`（正在输入动画）

### 19.d.1 AgentThinkingStep

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | `'pending' \| 'running' \| 'done' \| 'failed'` | 步骤状态 |
| `text` | `string` | 步骤描述（可带前缀标记如 ✓） |
| `duration_ms` | `number \| null` | 执行耗时 |

### 19.d.2 AgentAttachment

| 字段 | 类型 | 说明 |
|---|---|---|
| `icon` | `string` | 字符或 emoji |
| `title` | `string` | 附件标题 |
| `sub` | `string` | 一行副标题 |
| `attachment_type` | `'email' \| 'deck' \| 'report' \| 'doc' \| 'link'` | |
| `attachment_url` | `string \| null` | 打开后跳转的 URL |
| `card_id` | `string \| null` | 若附件来自某张卡片 |

### 19.d.3 AgentQuickAction

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | `string` | |
| `label` | `string` | 按钮文字 |
| `action_type` | `'follow_up_prompt' \| 'send' \| 'open' \| 'save'` | |
| `params` | `object \| null` | 执行时传给后端的参数 |
| `toast` | `string \| null` | 成功后的 toast 文案（原型演示用） |

---

## 20. AnalyticsEvent · 埋点事件

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `event_name` | `string` | ✓ | 事件标识 |
| `user_id` | `string` | ✓ | |
| `timestamp` | `string (ISO 8601)` | ✓ | |
| `properties` | `Record<string, any>` | ✗ | 事件属性 |
| `session_id` | `string` | ✓ | |
| `device_id` | `string` | ✓ | |
| `app_version` | `string` | ✓ | |

**关键 event_name**（基于原型行为）：
- `card_open`
- `card_filter_change`
- `action_item_swipe_delete`
- `action_item_toggle_done`
- `recording_start`
- `recording_stop`
- `recording_cancel`
- `full_summary_open`
- `agent_suggestion_clicked`
- `share_triggered`
- `delivery_target_connect`
- `api_key_added`

---

## 关联关系总览图

```
User
 ├── 1:1 RingStatus
 ├── 1:N Card
 │     ├── 1:1 LongRecDetail (type=long_rec)
 │     │     └── N:1 Participant / SummaryBullet / Decision / MemoryInsight
 │     ├── 1:1 FullSummary (type=long_rec)
 │     ├── 1:N ActionItem (type=long_rec)
 │     ├── 1:1 CommandDetail (type=cmd)
 │     ├── 1:1 IdeaDetail (type=idea)
 │     └── 1:1 ScheduleDetail (type=todo)
 ├── 1:1 DailySummary (每日一份)
 ├── 1:N DeliveryTarget
 ├── 1:N APIKeyConfig
 ├── 1:N ModelConfig
 ├── 1:N CalendarConnection
 ├── 1:1 ReminderPolicy
 ├── 1:1 PrivacyConfig
 ├── 1:1 AdvancedSettings
 ├── 1:N ExportJob
 ├── 1:N Memory
 │     └── N:1 Entity (同一个实体可以有多条 memory)
 ├── 1:N Entity
 ├── 1:N AgentConversation
 │     └── 1:N AgentMessage
 │           ├── N:1 AgentThinkingStep (type=steps)
 │           ├── N:1 AgentAttachment (type=attachment)
 │           └── N:1 AgentQuickAction (type=actions)
 └── 1:N AnalyticsEvent
```

---

## 原型中的 Mock 数据映射

| 原型位置 | 对应实体 | 备注 |
|---|---|---|
| `window.FULL_SUMMARIES['rec-1']` | `FullSummary` | 敦敏 Series A 跟进会，层级化内容示例（现在在 `data/mock.js`） |
| `window.FULL_SUMMARIES['rec-2']` | `FullSummary` | 林啸 Memory A/B 测试（现在在 `data/mock.js`） |
| `window.ACTION_ITEMS` 对象 | `ActionItem[]` | key 是 card id（现在在 `data/mock.js`） |
| `window.MEMORY_OVERVIEW` | `MemoryOverview` | memory_tab 的完整页面数据（`data/mock.js`） |
| `window.MEMORY_OVERVIEW.stats` | `MemoryTreeStats` | L0-L4 计数 |
| `window.MEMORY_OVERVIEW.insights` | `MemoryInsight[]` | 今天学到的 4 条示例 |
| `window.MEMORY_OVERVIEW.entities` | `Entity[]` | 7 个高频实体示例 |
| `window.MEMORY_OVERVIEW.corrections` | `CorrectionRecord[]` | 2 条最近纠正示例 |
| `window.AGENT_CONVERSATION` | `AgentConversation + AgentMessage[]` | 今天的 Agent 聊天记录（`data/mock.js`） |
| 首页卡片列表的 HTML | `Card[]` | 直接写成 DOM，未提取成 JS 对象 |
| `MEMORY_INSIGHTS` 片段 | `MemoryInsight[]` | 显示在长录音详情底部（仍然 inline 在 HTML） |
| `user = { name: '明明', subscription: 'max' }` | `User` | profile 页写死 |
| `battery_pct = 87` | `RingStatus` | profile 页写死 |
| `day_count = 12` | `DailySummary` | 首页写死 |

**共性特点**：
- 所有字段在原型中都是硬编码 JS 字面值，真实实现时都需要由后端接口供给
- 已提取到 `data/mock.js` 的：FULL_SUMMARIES、ACTION_ITEMS、MEMORY_OVERVIEW、AGENT_CONVERSATION（共 4 个顶层对象）
- 未提取（仍 inline 在 HTML 里）：首页卡片列表、profile 页的用户信息、各 settings 子页的静态配置值
