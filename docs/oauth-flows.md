# Monostone · OAuth 授权流程

用户连接外部服务（Notion / Linear / Google Calendar / Outlook / Gmail 等）的授权流程。

**版本**：v0.1 · 2026-04-09

---

## 总体原则

1. **标准 OAuth 2.0 Authorization Code flow + PKCE**（防止 token 拦截）
2. **refresh_token 存 Postgres**（加密）· **access_token 只在内存**（按需换取）
3. **deep link 回调**：`monostone://oauth/callback/{provider}` · iOS 通过 URL Scheme 收回调
4. **Web Demo**：回调 URL 是 `https://monostone-ios-prototype.vercel.app/oauth/callback`
5. **失败处理**：用户取消或拒绝 → 前端显示错误 toast，后端不记录

---

## 通用流程

```
iOS App        后端 API        Provider OAuth       Provider API
   │               │                 │                    │
   │ 1 点"连接"    │                 │                    │
   ├──────────────►│                 │                    │
   │               │                 │                    │
   │ 2 返回 auth_url + state + PKCE │                    │
   │◄──────────────┤                 │                    │
   │               │                 │                    │
   │ 3 SFSafariViewController 打开 auth_url              │
   ├───────────────────────────────►│                    │
   │               │                 │                    │
   │ 4 用户登录 + 授权              │                    │
   │               │                 │                    │
   │ 5 回调 monostone://oauth/...?code=xxx&state=xxx    │
   │◄───────────────────────────────┤                    │
   │               │                 │                    │
   │ 6 POST /oauth/exchange {code,state,provider}       │
   ├──────────────►│                 │                    │
   │               │                 │                    │
   │               │ 7 exchange code → access+refresh token│
   │               ├────────────────►│                    │
   │               │                 │                    │
   │               │ 8 tokens        │                    │
   │               │◄────────────────┤                    │
   │               │                 │                    │
   │               │ 9 加密存 Postgres                     │
   │               │                 │                    │
   │ 10 成功 { integration_id, status: 'ok' }            │
   │◄──────────────┤                 │                    │
   │               │                 │                    │
   │ 11 UI 更新 setting page → 显示"已连接"              │
```

---

## 各 Provider 详细配置

### Notion

**用途**：投递长录音纪要、指令产出的 markdown 文档到指定 database。

**OAuth endpoint**：`https://api.notion.com/v1/oauth/authorize`
**Scopes**：Notion 的 OAuth 是 workspace-level 授权，不需要 scope 参数。用户在 Notion 侧选要授权哪些 pages。
**Client ID/Secret**：需要在 Notion Developers 建一个 "Public Integration"
**Redirect URI**：`https://api.monostone.ai/oauth/callback/notion`

**示例 auth_url**：
```
https://api.notion.com/v1/oauth/authorize?
  client_id={NOTION_CLIENT_ID}&
  response_type=code&
  owner=user&
  redirect_uri=https://api.monostone.ai/oauth/callback/notion&
  state={state}
```

**注意**：
- Notion 不发 refresh_token，access_token 长期有效直到用户撤销
- 建议定期检查 token 有效性（每 7 天一次 ping）

---

### Linear

**用途**：把长录音 action items 写入 Linear issue，把待办卡写入 Linear task。

**OAuth endpoint**：`https://linear.app/oauth/authorize`
**Scopes**：`read write issues:create`
**Redirect URI**：`https://api.monostone.ai/oauth/callback/linear`

**示例 auth_url**：
```
https://linear.app/oauth/authorize?
  client_id={LINEAR_CLIENT_ID}&
  response_type=code&
  redirect_uri=https://api.monostone.ai/oauth/callback/linear&
  scope=read+write+issues:create&
  state={state}&
  prompt=consent
```

**Token endpoint**：`https://api.linear.app/oauth/token`

**注意**：
- Linear 返回 `access_token` + `expires_in`（7776000s = 90 天）
- 建议每 60 天 refresh 一次（Linear 支持 refresh_token）

---

### Google Calendar

**用途**：读写 Google Calendar 事件、冲突检测、写入日程卡。

**OAuth endpoint**：`https://accounts.google.com/o/oauth2/v2/auth`
**Scopes**：
- `https://www.googleapis.com/auth/calendar.events` — 读写事件
- `https://www.googleapis.com/auth/calendar.readonly` — 读日历列表
- `openid email profile` — 获取用户基本信息

**Redirect URI**：`https://api.monostone.ai/oauth/callback/google`

**示例 auth_url**：
```
https://accounts.google.com/o/oauth2/v2/auth?
  client_id={GOOGLE_CLIENT_ID}&
  response_type=code&
  redirect_uri=https://api.monostone.ai/oauth/callback/google&
  scope=https://www.googleapis.com/auth/calendar.events openid email profile&
  access_type=offline&
  prompt=consent&
  state={state}&
  code_challenge={PKCE_CHALLENGE}&
  code_challenge_method=S256
```

**Token endpoint**：`https://oauth2.googleapis.com/token`

**注意**：
- `access_type=offline` + `prompt=consent` 才能拿到 refresh_token
- access_token 有效期 1 小时，需要用 refresh_token 定期换
- **iOS 端可以直接用 EventKit 读 Apple 日历（已同步的 Google 日历会自动出现）**，不需要单独 OAuth Google Calendar，除非用户明确想直连

---

### Gmail

**用途**：发送指令产出的邮件草稿。

**OAuth endpoint**：`https://accounts.google.com/o/oauth2/v2/auth`（和 Google Calendar 同一个）
**Scopes**：
- `https://www.googleapis.com/auth/gmail.send` — 仅发送权限（最小必要）
- `openid email profile`

**不要申请**：`gmail.readonly`、`gmail.modify` 等更广权限（Google 会触发额外审核）

**Token endpoint**：同 Google Calendar

**注意**：
- 只要"发送"权限 → 审核更容易过
- 邮件签名由用户在 Monostone settings 里配置，不读 Gmail 的签名
- **可以和 Google Calendar 共用 OAuth session**，一次授权拿两个 scope

---

### Outlook / Microsoft 365

**用途**：读写 Outlook 日历、发送邮件。

**OAuth endpoint**：`https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
**Scopes**：
- `Calendars.ReadWrite`
- `Mail.Send`
- `offline_access`（拿 refresh_token）
- `openid email profile User.Read`

**Redirect URI**：`https://api.monostone.ai/oauth/callback/microsoft`

**Token endpoint**：`https://login.microsoftonline.com/common/oauth2/v2.0/token`

**注意**：
- Microsoft 的 OAuth 支持 PKCE
- 企业租户要注意 admin consent 问题（如果用户是企业账号，可能需要 IT 管理员授权）

---

### LinkedIn (未来)

**用途**：onboarding 时导入用户的 role / company / network，Day 1 就有 context。

**OAuth endpoint**：`https://www.linkedin.com/oauth/v2/authorization`
**Scopes**（最小必要集）：
- `r_liteprofile` — 姓名 + 头像
- `r_emailaddress` — 邮箱

**不要申请**：
- `r_basicprofile`（deprecated，需要 Partner）
- `r_network` 需要 Partner 审核
- `w_member_social` 发帖权限不需要

**注意**：
- Day 1 体验改进用的，不是 P0
- LinkedIn Partner 审核很严，先用基础 scope 跑通再申请更多

---

## OAuth State 管理

### 后端 state 存储（Redis）

```
key: oauth_state:{state_uuid}
value: {
  user_id: uuid,
  provider: 'notion' | 'linear' | ...,
  pkce_verifier: string,
  created_at: timestamp,
  redirect_after: string  // 登录后跳回前端哪个页面
}
ttl: 10 分钟
```

### 前端流程

```swift
// iOS Swift 示意
func connectProvider(_ provider: String) async {
  // 1. 向后端请求 auth_url
  let resp = await api.post("/oauth/start", body: ["provider": provider])
  let authUrl = resp.auth_url  // 已包含 state + PKCE

  // 2. 用 SFSafariViewController 打开
  let safari = SFSafariViewController(url: URL(string: authUrl)!)
  present(safari, animated: true)

  // 3. 监听 URL Scheme 回调 monostone://oauth/callback/...
  // 回调时后端已经处理完 exchange，前端只需刷新 integrations
}

// Scene Delegate
func scene(_ scene, openURLContexts URLContexts) {
  let url = URLContexts.first!.url
  if url.scheme == "monostone" && url.host == "oauth" {
    // 后端已处理 callback，这里只需 dismiss Safari + refresh UI
    refreshIntegrations()
  }
}
```

### Web Demo 流程（回调到 Vercel）

Web demo 不能用 URL scheme，改用 HTTPS 回调 + postMessage：

```javascript
// 1. popup window 打开 auth_url
const popup = window.open(authUrl, 'oauth', 'width=600,height=700');

// 2. 监听 postMessage
window.addEventListener('message', (event) => {
  if (event.origin === 'https://api.monostone.ai' && event.data.type === 'oauth_done') {
    popup.close();
    refreshIntegrations();
  }
});

// 3. 后端 callback 页面在成功后 window.opener.postMessage({type:'oauth_done'}, '*')
```

---

## Token 存储与使用

### Postgres schema

```sql
CREATE TABLE integrations (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  provider VARCHAR(32) NOT NULL,  -- 'notion' | 'linear' | 'google' | ...
  account_identifier VARCHAR(255), -- email or workspace name
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,
  expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB,  -- provider-specific extras (workspace_id, etc.)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,

  UNIQUE (user_id, provider, account_identifier)
);

CREATE INDEX ON integrations (user_id, provider);
```

### 加密

- 用 AES-256-GCM 加密 access_token / refresh_token
- 加密 key 存环境变量 `INTEGRATION_ENCRYPTION_KEY`（32 bytes base64）
- 用每个用户的 user_id 作为 AAD（额外认证数据）

### 请求时的 access_token 管理

```python
# 伪代码
async def call_provider_api(user_id, provider, path, **kwargs):
    integration = await db.get_integration(user_id, provider)

    # 如果 access_token 过期，用 refresh_token 换新的
    if integration.expires_at < now() + 60:  # 提前 60s 续期
        new_tokens = await refresh_token_for(provider, integration)
        await db.update_integration(integration.id, new_tokens)
        integration = new_tokens

    access_token = decrypt(integration.access_token_encrypted)

    # 实际调用
    resp = await http.request(
        method=kwargs.get('method', 'GET'),
        url=provider_base_url(provider) + path,
        headers={'Authorization': f'Bearer {access_token}'},
        json=kwargs.get('json'),
    )

    # 如果 401，强制 refresh 一次再重试
    if resp.status == 401:
        ...

    return resp
```

---

## 撤销 & 删除

当用户在 settings 里点"断开连接"：

```
POST /integrations/{id}/disconnect
```

后端：
1. 尝试调用 provider 的 revoke endpoint（Notion / Google 都支持）
2. 从 Postgres 删除 integrations 记录（或标记 `disconnected_at`）
3. 清理相关的 destination 配置

即使 revoke 失败，也要删除本地记录（provider 那边可能已失效）。

---

## 监控

- 每次 token refresh 记录 log
- refresh 失败率 > 5% 报警
- 每个 provider 的 API 调用成功率监控
- OAuth 流程的漏斗：点连接 → 开 auth_url → 回调 → exchange → 成功
