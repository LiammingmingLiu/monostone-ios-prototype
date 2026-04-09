# API 契约清单

> **范围**：本文档基于 `index.html` 原型代码反推，列出 iOS App 在完整后端落地时需要的所有 HTTP / WebSocket 接口。
>
> **实现状态说明**：原型所有接口 **均为未实现**——`FULL_SUMMARIES`、`CARDS`、`ACTION_ITEMS` 等都是 JS 里 hardcode 的对象，UI 行为（如"左滑删除"、"勾选完成"、"发给 Agent"）都只是本地状态切换 + toast 反馈，不会产生任何网络请求。本文档列出的每一条都是**原型行为所暗含的后端契约**。
>
> **版本规划**：接口路径统一以 `/v1` 为前缀，JSON 为默认 Content-Type。时间戳统一 ISO 8601 带时区。

---

## 约定

- **认证**：所有接口（除 `POST /v1/auth/*`）都要求 `Authorization: Bearer <jwt>` header
- **错误响应**：统一 `{ code: string, message: string, details?: object }`
- **分页**：使用 cursor-based，`?cursor=xxx&limit=20`，响应带 `next_cursor`
- **实时推送**：部分场景（录音处理进度、daily digest 更新）需要 WebSocket 或 SSE

---

## 认证与用户

### `POST /v1/auth/apple`
- **用途**：通过 Sign in with Apple 完成登录 / 注册
- **触发场景**：`splash` 页点击"开始"后首次启动引导；`profile` 页"退出登录"后重新登录
- **请求参数**：
  ```json
  {
    "identity_token": "string — Apple 返回的 ID token",
    "authorization_code": "string — Apple 授权码",
    "nonce": "string — 客户端生成的防重放 nonce"
  }
  ```
- **响应结构**：
  ```json
  {
    "access_token": "string — JWT",
    "refresh_token": "string",
    "expires_in": "number — 秒",
    "user": {
      "id": "string",
      "name": "string",
      "avatar": "string | null",
      "subscription": "'free' | 'pro' | 'max'",
      "onboarded_at": "string | null — ISO 8601"
    }
  }
  ```
- **实现状态**：未实现但需要

### `GET /v1/me`
- **用途**：拉取当前用户基本信息
- **触发场景**：`profile` 页进入时、App 冷启动 `splash` 期间预加载
- **响应结构**：
  ```json
  {
    "id": "string",
    "name": "string",
    "avatar": "string | null",
    "subscription": "'free' | 'pro' | 'max'",
    "day_count": "number — 从注册至今的天数",
    "ring_status": {
      "connected": "boolean",
      "battery_pct": "number — 0-100",
      "firmware_version": "string",
      "last_sync_at": "string — ISO 8601"
    }
  }
  ```
- **实现状态**：未实现但需要（原型里 `第 12 天`、`戒指已连接`、`87%` 都是 hardcode 在 `#s2` 和 `#s10`）

### `POST /v1/me/logout`
- **用途**：注销登录
- **触发场景**：`profile` 页"退出登录"按钮
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

---

## Feed · 卡片列表

### `GET /v1/cards`
- **用途**：拉取首页 Feed 卡片列表（长录音 / 指令 / 灵感 / 待办 混合流）
- **触发场景**：`home_feed` 页进入时、下拉刷新、切换 filter chip
- **请求参数**（query string）：
  ```json
  {
    "type": "'all' | 'long_rec' | 'cmd' | 'idea' | 'todo' — 筛选；默认 all",
    "cursor": "string | null — 分页游标",
    "limit": "number — 默认 20, 最大 50"
  }
  ```
- **响应结构**：
  ```json
  {
    "items": "Card[] — 见数据模型定义",
    "next_cursor": "string | null",
    "counts": {
      "all": "number",
      "long_rec": "number",
      "cmd": "number",
      "idea": "number",
      "todo": "number"
    }
  }
  ```
- **实现状态**：未实现但需要（原型 `CARDS` 数组是写死的）

### `GET /v1/cards/{cardId}`
- **用途**：拉取单张卡片的完整详情（长录音详情 / 指令详情 / 灵感详情 / 日程详情共用）
- **触发场景**：点击首页任意卡片时进入详情页前预加载
- **响应结构**（联合类型，根据 `type` 字段区分）：
  ```json
  {
    "id": "string",
    "type": "'long_rec' | 'cmd' | 'idea' | 'todo'",
    "data": "LongRecDetail | CommandDetail | IdeaDetail | ScheduleDetail"
  }
  ```
- **实现状态**：未实现但需要

### `DELETE /v1/cards/{cardId}`
- **用途**：软删除一张卡片
- **触发场景**：详情页长按或下拉菜单"删除"（当前原型未实现 UI，但产品语义需要）
- **响应结构**：`{ "ok": true, "deleted_at": "string — ISO 8601" }`
- **实现状态**：未实现但需要

### `PATCH /v1/cards/{cardId}`
- **用途**：修改卡片类型（"重新分类"chip）
- **触发场景**：指令详情 `#s4` / 灵感详情 `#s5` 里的 reclass chip 切换
- **请求参数**：
  ```json
  {
    "type": "'cmd' | 'idea' | 'todo' — 新类型",
    "reason": "string — 可选, 用于训练分类器"
  }
  ```
- **响应结构**：更新后的 `Card`
- **实现状态**：未实现但需要

---

## Daily Digest / 今日速览

### `GET /v1/digest/today`
- **用途**：拉取首页顶部的"今日速览"数据
- **触发场景**：`home_feed` 页进入时、每次回到前台
- **响应结构**：
  ```json
  {
    "greeting": "string — '早上好, 明明'",
    "day_count": "number",
    "interactions_today": "number",
    "time_saved_minutes": "number",
    "interaction_breakdown": {
      "walking": "number",
      "post_meeting": "number",
      "at_desk": "number"
    }
  }
  ```
- **实现状态**：未实现但需要

---

## 长录音

### `POST /v1/recordings/start`
- **用途**：开始一次长录音会话，返回 session_id 供后续上传音频分片
- **触发场景**：`home_feed` FAB 快速点击进入 `record_long` 页面
- **请求参数**：
  ```json
  {
    "mode": "'long' | 'short' — 录音模式",
    "started_at": "string — ISO 8601",
    "current_project": "string | null — Agent 建议的项目归属",
    "context_hint": "object | null — 当前进入录音时的环境 context"
  }
  ```
- **响应结构**：
  ```json
  {
    "session_id": "string",
    "upload_url": "string — 预签名分片上传 URL",
    "chunk_size_bytes": "number"
  }
  ```
- **实现状态**：未实现但需要

### `POST /v1/recordings/{sessionId}/chunks`
- **用途**：上传音频分片（`multipart/form-data` 或直接 PUT 到预签名 URL）
- **触发场景**：录音进行中，每 2-5 秒上传一次
- **请求参数**：binary audio chunk + `sequence_number: number`
- **响应结构**：`{ "received": true, "next_sequence": "number" }`
- **实现状态**：未实现但需要

### `POST /v1/recordings/{sessionId}/stop`
- **用途**：结束录音，触发后端 ASR + 结构化 pipeline
- **触发场景**：`record_long` 页点击停止按钮
- **请求参数**：
  ```json
  {
    "ended_at": "string — ISO 8601",
    "duration_sec": "number"
  }
  ```
- **响应结构**：
  ```json
  {
    "card_id": "string — 新创建的 Card id",
    "status": "'processing'",
    "processing_stages": ["upload", "asr", "classify", "structure"]
  }
  ```
- **实现状态**：未实现但需要

### `DELETE /v1/recordings/{sessionId}`
- **用途**：取消录音，丢弃已上传数据
- **触发场景**：`record_long` 页点击取消按钮
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

### `WS /v1/recordings/{cardId}/progress`
- **用途**：订阅录音处理进度（骨架屏 shimmer 期间）
- **触发场景**：`home_feed` 里出现 `.card.processing` 的卡片时自动订阅
- **推送消息**：
  ```json
  {
    "stage": "'upload' | 'asr' | 'classify' | 'structure' | 'done'",
    "progress_pct": "number — 0-100",
    "eta_sec": "number | null",
    "message": "string — '上传中' / 'ASR 运行中...' / '结构化分析中'"
  }
  ```
- **实现状态**：未实现但需要（原型 `simulateIncomingCard()` 用 `setTimeout` 模拟的逻辑）

---

## Full Summary / 完整会议纪要

### `GET /v1/cards/{cardId}/full-summary`
- **用途**：拉取某条长录音的完整会议纪要（用于 `modal_full_summary` 模态框）
- **触发场景**：长录音详情页点击"查看完整总结"按钮
- **响应结构**：
  ```json
  {
    "card_id": "string",
    "title": "string — '和敦敏的 Series A 跟进会 · 会议纪要'",
    "meta": {
      "会议时间": "string",
      "会议时长": "string",
      "参会人员": "string",
      "会议项目": "string",
      "会议形式": "string"
    },
    "sections": [
      {
        "h": "string — H2 标题",
        "paragraphs": "string[] — 每一项是原始 HTML 块 (p / h3 / blockquote / ul / ol / table / strong)"
      }
    ],
    "generated_at": "string — ISO 8601",
    "model_version": "string"
  }
  ```
- **实现状态**：未实现但需要（原型里 `FULL_SUMMARIES['rec-1']` 是 hardcode 对象，但其 schema 即为本接口的契约）

### `POST /v1/cards/{cardId}/full-summary/regenerate`
- **用途**：重新生成完整纪要（如果用户对结果不满意）
- **触发场景**：完整总结 modal 顶部的"重新生成"按钮（当前原型未实现 UI，但产品语义需要）
- **请求参数**：
  ```json
  {
    "instructions": "string | null — 可选, 用户额外要求"
  }
  ```
- **响应结构**：同上 `FullSummary`
- **实现状态**：未实现但需要

---

## Action Items

### `GET /v1/cards/{cardId}/action-items`
- **用途**：拉取某张卡片上的所有 action items
- **触发场景**：长录音详情 `#s3` 页加载时一并返回（也可以内嵌在 `GET /v1/cards/{cardId}` 里）
- **响应结构**：
  ```json
  {
    "items": [
      {
        "id": "string",
        "text": "string",
        "owner": "string",
        "deadline": "string",
        "status": "'pending' | 'done' | 'rejected'",
        "source_card_id": "string",
        "source_quote": "string",
        "source_time": "string",
        "agent_suggestions": "string[] — 3 条 AI prompt 建议"
      }
    ]
  }
  ```
- **实现状态**：未实现但需要

### `PATCH /v1/action-items/{itemId}`
- **用途**：标记 action item 完成 / 取消完成
- **触发场景**：首页 Action Items 区块点击 checkbox（`toggleActionItem`）
- **请求参数**：
  ```json
  {
    "status": "'pending' | 'done'"
  }
  ```
- **响应结构**：更新后的 ActionItem
- **副作用**：status=done 时后端应同步创建提醒事项 + Linear issue（参见 `sharing-spec.md` / `events-protocol.md`）
- **实现状态**：未实现但需要

### `DELETE /v1/action-items/{itemId}`
- **用途**：软删除 action item（用户"左滑删除"）
- **触发场景**：首页 Action Items 区块左滑 > 100px 松手触发 `rejectActionItemBySwipe`
- **请求参数**：
  ```json
  {
    "reason": "'user_reject_swipe' — 用于分类器训练的标签"
  }
  ```
- **响应结构**：`{ "ok": true, "rejected_at": "string — ISO 8601" }`
- **副作用**：
  - 软删除 `action_items[i].rejected = true`，不实删
  - 结构化摘要 "N 项待办" 计数 -1
  - 反馈给分类器 "这条 AI 推断是错的"
  - Memory：**不记录**任何 commitment（用户主动拒绝，不算承诺）
- **实现状态**：未实现但需要

### `GET /v1/action-items/{itemId}`
- **用途**：拉取单条 action item 的完整详情（给 `modal_action_item` 模态框用）
- **触发场景**：首页 Action Items 区块点击某一行（非 checkbox 区域）
- **响应结构**：单个 ActionItem 对象（含 source_quote、agent_suggestions 完整字段）
- **实现状态**：未实现但需要

---

## Agent / Command 执行

### `POST /v1/agent/dispatch`
- **用途**：把一个用户 prompt 派给 Agent 执行（可以来自语音指令、Action Item 建议按钮、或手动文字输入）
- **触发场景**：
  - `modal_action_item` 里点击 "Agent 建议 prompt" 按钮（`sendToAgent`）
  - 短录音判定为 `cmd` 类型后自动派发
  - `home_feed` FAB 短录音松开后派发
- **请求参数**：
  ```json
  {
    "prompt": "string — 用户原话或 suggested prompt",
    "source": "'voice' | 'text' | 'suggestion'",
    "source_card_id": "string | null",
    "attach_context_ids": "string[] — 需要作为 context 引入的卡片 id"
  }
  ```
- **响应结构**：
  ```json
  {
    "card_id": "string — 新创建的 cmd 卡片 id",
    "stream_url": "string — WebSocket URL 用于订阅执行步骤"
  }
  ```
- **实现状态**：未实现但需要

### `WS /v1/agent/{cardId}/stream`
- **用途**：流式订阅 Agent 执行步骤（用于指令详情页 Timeline 实时更新）
- **触发场景**：进入 `command_details` 页且卡片状态为 `processing`
- **推送消息**：
  ```json
  {
    "type": "'step_start' | 'step_done' | 'output_delta' | 'complete' | 'error'",
    "step": {
      "title": "string",
      "description": "string",
      "duration_ms": "number"
    },
    "output_delta": "string | null — 增量内容, 用于打字机效果"
  }
  ```
- **实现状态**：未实现但需要

### `POST /v1/agent/{cardId}/continue`
- **用途**：在已有会话上追加一轮对话
- **触发场景**：指令详情 / 灵感详情页底部输入框发消息
- **请求参数**：
  ```json
  {
    "user_message": "string"
  }
  ```
- **响应结构**：新一轮的 step stream URL
- **实现状态**：未实现但需要

### `POST /v1/agent/{cardId}/send`
- **用途**：把指令产出（比如生成好的邮件）实际发出去
- **触发场景**：指令详情页底部"发送"按钮
- **请求参数**：
  ```json
  {
    "destination": "'email' | 'slack' | 'notion' | 'linear' | 'wechat'",
    "final_content": "string — 用户可能编辑过的最终内容",
    "metadata": {
      "email_to": "string | null",
      "email_subject": "string | null",
      "slack_channel": "string | null"
    }
  }
  ```
- **响应结构**：`{ "ok": true, "sent_at": "string — ISO 8601" }`
- **实现状态**：未实现但需要

### `POST /v1/agent/{cardId}/save-draft`
- **用途**：保存为草稿（不发送）
- **触发场景**：指令详情页底部"存草稿"按钮
- **响应结构**：`{ "ok": true, "draft_id": "string" }`
- **实现状态**：未实现但需要

---

## Memory

### `GET /v1/memory/search`
- **用途**：按 query 搜索 memory（用于显示 `memory-row` 的 "本次会议学到的信息"）
- **触发场景**：长录音详情页加载时，取 top-N 条新学到的 memory 显示
- **请求参数**：
  ```json
  {
    "source_card_id": "string — 只要从这张卡片里学到的",
    "limit": "number"
  }
  ```
- **响应结构**：
  ```json
  {
    "items": [
      {
        "id": "string",
        "entity": "string — '敦敏'",
        "learning": "string — '是 Linear Capital 合伙人, 偏好 closed-loop 定位'",
        "confidence": "number — 0-1",
        "source_card_id": "string",
        "first_seen_at": "string — ISO 8601"
      }
    ]
  }
  ```
- **实现状态**：未实现但需要

### `POST /v1/memory/correct`
- **用途**：用户纠正一条 memory（`human correction` 机制，见 `data-flow.md`）
- **触发场景**：Daily digest 里用户点击"这条不对"（当前原型未实现 UI，但数据流文档定义了此机制）
- **请求参数**：
  ```json
  {
    "memory_id": "string",
    "correction_type": "'miss' | 'wrong' | 'add'",
    "correction_text": "string"
  }
  ```
- **响应结构**：`{ "ok": true, "will_retrain_at": "string" }`
- **实现状态**：未实现但需要

---

## Schedule / 日程

### `POST /v1/schedules/{cardId}/complete`
- **用途**：标记待办完成
- **触发场景**：日程详情页 `#s6` 底部"完成"按钮
- **响应结构**：`{ "ok": true, "completed_at": "string" }`
- **副作用**：同步到 Apple Reminders / Linear（依 `synced_to` 字段）
- **实现状态**：未实现但需要

### `PATCH /v1/schedules/{cardId}`
- **用途**：修改待办时间 / 标题 / 地点
- **触发场景**：日程详情页"修改"按钮
- **请求参数**：
  ```json
  {
    "title": "string | null",
    "datetime": "string | null — ISO 8601",
    "location": "string | null"
  }
  ```
- **响应结构**：更新后的 ScheduleDetail
- **实现状态**：未实现但需要

### `POST /v1/schedules/{cardId}/cancel`
- **用途**：取消待办（软删除）
- **触发场景**：日程详情页"取消"按钮
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

---

## 分享

### `POST /v1/cards/{cardId}/share`
- **用途**：按指定格式和渠道分享卡片内容
- **触发场景**：`modal_share` 内点击任意分享目标
- **请求参数**：
  ```json
  {
    "format": "'md' | 'pdf' | 'txt'",
    "destination": "'copy' | 'email' | 'imessage' | 'notion' | 'slack' | 'wechat' | 'airdrop' | 'files'",
    "include_audio": "boolean"
  }
  ```
- **响应结构**：
  ```json
  {
    "share_url": "string | null — 若有服务端 hosted 版本",
    "content": "string | null — md/txt 时直接返回用于 UIActivityViewController"
  }
  ```
- **实现状态**：未实现但需要（原型点击只触发 toast，真实逻辑走 iOS `UIActivityViewController`）

---

## 投递目标 (Delivery Targets)

### `GET /v1/integrations/delivery-targets`
- **用途**：拉取当前已连接的投递平台列表
- **触发场景**：`delivery_targets` 页 `#s11` 进入时
- **响应结构**：
  ```json
  {
    "items": [
      {
        "platform": "'apple_calendar' | 'linear' | 'notion' | 'gmail' | 'obsidian' | 'google_calendar'",
        "status": "'connected' | 'not_connected'",
        "metadata": {
          "account_email": "string | null",
          "workspace": "string | null",
          "project": "string | null"
        },
        "connected_at": "string | null",
        "scopes": "string[]"
      }
    ]
  }
  ```
- **实现状态**：未实现但需要

### `POST /v1/integrations/delivery-targets/{platform}/connect`
- **用途**：发起某个平台的 OAuth 连接流程
- **触发场景**：`delivery_targets` 页点击"连接"按钮
- **响应结构**：
  ```json
  {
    "oauth_url": "string — 跳转到 OAuth 页的 URL"
  }
  ```
- **实现状态**：未实现但需要（配合 `docs/oauth-flows.md`）

### `DELETE /v1/integrations/delivery-targets/{platform}`
- **用途**：断开某个平台
- **触发场景**：`delivery_targets` 页点击"断开"按钮
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

---

## API Keys (BYOK)

### `GET /v1/integrations/api-keys`
- **用途**：拉取已配置的 API key 列表 + 本月用量
- **触发场景**：`api_keys` 页 `#s12` 进入时
- **响应结构**：
  ```json
  {
    "keys": [
      {
        "provider": "'anthropic' | 'openai' | 'google_gemini'",
        "masked_key": "string — 'sk-ant-****fh7Q'",
        "configured_at": "string",
        "monthly_usage": {
          "token_count": "number",
          "cost_usd": "number"
        }
      }
    ],
    "default_model": {
      "model": "string",
      "use_case": "string"
    }
  }
  ```
- **实现状态**：未实现但需要

### `POST /v1/integrations/api-keys`
- **用途**：添加或替换一个 API key
- **触发场景**：`api_keys` 页点击"添加"按钮
- **请求参数**：
  ```json
  {
    "provider": "'anthropic' | 'openai' | 'google_gemini'",
    "key": "string — 明文, 后端加密存储"
  }
  ```
- **响应结构**：`{ "ok": true, "masked_key": "string" }`
- **安全要求**：后端必须加密存储（KMS envelope），不可日志化
- **实现状态**：未实现但需要

### `DELETE /v1/integrations/api-keys/{provider}`
- **用途**：移除一个 API key
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

### `PATCH /v1/integrations/default-model`
- **用途**：切换默认模型
- **触发场景**：`api_keys` 页模型单选切换
- **请求参数**：`{ "model": "string" }`
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

---

## 日历与提醒

### `GET /v1/integrations/calendar`
- **用途**：拉取日历连接状态 + 提醒策略
- **触发场景**：`calendar_settings` 页 `#s13` 进入时
- **响应结构**：
  ```json
  {
    "connections": [
      {
        "platform": "'apple_calendar' | 'google_calendar' | 'outlook'",
        "status": "'connected' | 'not_connected'",
        "metadata": "string | null"
      }
    ],
    "default_write_target": {
      "type": "'calendar' | 'reminders'",
      "platform": "string"
    },
    "reminder_policy": {
      "auto_remind": "boolean",
      "meeting_advance_min": "number",
      "task_advance_min": "number",
      "commute_correction": "boolean"
    }
  }
  ```
- **实现状态**：未实现但需要

### `PATCH /v1/integrations/calendar/reminder-policy`
- **用途**：更新提醒策略
- **触发场景**：`calendar_settings` 页 toggle / 下拉切换
- **请求参数**：完整的 `reminder_policy` 对象
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

---

## 隐私与数据

### `GET /v1/privacy/config`
- **用途**：拉取当前存储策略 + 权限状态
- **触发场景**：`privacy_data` 页 `#s14` 进入时
- **响应结构**：
  ```json
  {
    "audio_storage": "'device_only' | 'cloud_encrypted'",
    "retention_days": "number | null — null 表示永久",
    "permissions": [
      {
        "permission": "'microphone' | 'bluetooth' | 'location' | 'calendar'",
        "status": "'authorized' | 'denied' | 'not_determined'",
        "usage": "string"
      }
    ]
  }
  ```
- **实现状态**：未实现但需要（`permissions` 字段的 status 实际应由 iOS 系统 API 读取，不走网络）

### `PATCH /v1/privacy/config`
- **用途**：更新存储策略
- **触发场景**：`privacy_data` 页单选切换
- **请求参数**：
  ```json
  {
    "audio_storage": "'device_only' | 'cloud_encrypted'",
    "retention_days": "number | null"
  }
  ```
- **响应结构**：`{ "ok": true, "retroactive_cleanup_scheduled_at": "string | null" }`
- **实现状态**：未实现但需要

### `DELETE /v1/privacy/all-data`
- **用途**：删除所有用户数据并重置账户（危险操作，需要 double-confirm）
- **触发场景**：`privacy_data` 页"删除所有数据并重置"
- **请求参数**：
  ```json
  {
    "confirmation_phrase": "string — 用户手动输入的确认短语"
  }
  ```
- **响应结构**：`{ "ok": true, "scheduled_at": "string", "will_complete_at": "string" }`
- **实现状态**：未实现但需要

---

## 数据导出

### `POST /v1/export/request`
- **用途**：请求一次数据导出
- **触发场景**：`export_data` 页 `#s15` 点击任一导出按钮
- **请求参数**：
  ```json
  {
    "scope": "'full' | 'long_rec_only' | 'cmd_only' | 'idea_only'",
    "format": "'markdown' | 'json'",
    "include_audio": "boolean"
  }
  ```
- **响应结构**：
  ```json
  {
    "export_id": "string",
    "estimated_size_mb": "number",
    "status_url": "string"
  }
  ```
- **实现状态**：未实现但需要

### `GET /v1/export/{exportId}/status`
- **用途**：查询导出进度
- **响应结构**：
  ```json
  {
    "status": "'pending' | 'running' | 'ready' | 'failed'",
    "progress_pct": "number",
    "download_url": "string | null — 仅 ready 时有"
  }
  ```
- **实现状态**：未实现但需要

---

## 高级设置

### `GET /v1/settings/advanced`
- **用途**：拉取高级设置配置
- **触发场景**：`advanced_settings` 页 `#s16` 进入时
- **响应结构**：
  ```json
  {
    "classification": {
      "auto_classify": "boolean",
      "confirm_low_confidence": "boolean",
      "confidence_threshold_pct": "number"
    },
    "hardware": {
      "haptic_feedback": "boolean",
      "hold_confirm_duration_ms": "number"
    },
    "dev": {
      "debug_logging": "boolean",
      "mock_ring": "boolean",
      "local_cache_size_mb": "number"
    }
  }
  ```
- **实现状态**：未实现但需要

### `PATCH /v1/settings/advanced`
- **用途**：更新高级设置
- **请求参数**：完整或部分 advanced config
- **响应结构**：`{ "ok": true }`
- **实现状态**：未实现但需要

### `POST /v1/settings/clear-cache`
- **用途**：清除本地缓存（实际是前端操作，但需要同步清理 server 侧 cache 标记）
- **响应结构**：`{ "ok": true, "cleared_bytes": "number" }`
- **实现状态**：未实现但需要

---

## 戒指 (Ring Hardware) 相关

### `GET /v1/ring/status`
- **用途**：拉取戒指实时状态（电量、连接、固件版本）
- **触发场景**：`profile` 页进入、`home_feed` 定期轮询
- **响应结构**：
  ```json
  {
    "connected": "boolean",
    "battery_pct": "number",
    "firmware_version": "string",
    "last_sync_at": "string",
    "local_storage_used_mb": "number",
    "local_storage_total_mb": "number"
  }
  ```
- **实现状态**：未实现但需要（戒指本身通过 BLE 协议直连 iOS，此接口实际是云端缓存的镜像）

### `POST /v1/ring/firmware/check`
- **用途**：检查 OTA 固件更新
- **响应结构**：
  ```json
  {
    "has_update": "boolean",
    "new_version": "string | null",
    "release_notes": "string | null"
  }
  ```
- **实现状态**：未实现但需要

---

## WebSocket 频道汇总

| 频道 | 用途 | 订阅时机 |
|---|---|---|
| `/v1/recordings/{cardId}/progress` | 录音处理管线进度 | 出现 `.card.processing` 时 |
| `/v1/agent/{cardId}/stream` | Agent 执行步骤流 | 进入指令详情页且 processing 时 |
| `/v1/ring/events` | 戒指实时事件（按键、碰撞、电量告警） | App 进入前台时 |
| `/v1/notifications` | 全局推送通知 | 登录后 |

---

## 客户端埋点（非核心接口但需要）

### `POST /v1/analytics/events`
- **用途**：批量上报客户端埋点（筛选切换、Action Item 滑删、分享触达等）
- **请求参数**：
  ```json
  {
    "events": [
      {
        "event_name": "string",
        "timestamp": "string",
        "properties": "object"
      }
    ]
  }
  ```
- **响应结构**：`{ "received": "number" }`
- **实现状态**：未实现但需要
