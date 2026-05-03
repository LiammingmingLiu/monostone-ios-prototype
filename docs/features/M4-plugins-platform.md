---
milestone: M4
deadline: 2026-05-06
status: draft
backend-services:
  - plugin-runtime-service
  - plugin-registry-service
  - plugin-platform-core（共享库）
  - 现有 first-party plugins:
    - calendar-create-event-plugin
    - email-sender-plugin
    - daily-brief-plugin
    - note-capture-plugin
    - pattern-miner-plugin
    - report-maker-plugin
    - web-search-plugin
ios-views:
  - PluginsView（商店 + 已安装）
  - PluginDetailView
  - PluginPermissionView（OAuth + scope）
  - ProfileView（plugin 入口）
linear-issues: [MON-25, MON-26, MON-27, MON-28, MON-29, MON-30, MON-31]
---

# M4 · Plugin 平台定义 + UX

> Backend 已经部署了 7 个 first-party 插件 Pod 和 plugin-runtime-service / plugin-registry-service。M4 不是从 0 建平台，而是**把已有的 backend 平台对齐成产品化的 spec**，让 iOS 商店 / 权限 / 安装 流程能落地。

## 1. Milestone 范围

**包含**
- Plugin manifest 格式（对齐 plugin-platform-core 现有格式）
- Plugin sandbox 决策（已是远程 Pod 模型，不动；spec 写清楚边界）
- iOS 商店 / 安装 / 权限授予 UX
- Plugin → Memory 读写权限模型（对齐 `/internal/proxy/*` 现有受控代理）
- Plugin 与 Agent 调用协议（对齐 `/internal/plugins/{id}/execute-active`）
- Starter 范例文档（基于 calendar-create-event 和 email-sender 现有代码写）
- 开发者文档结构

**不包含**
- 第三方插件市场上线（v0.5 范围内只暴露 first-party）
- Plugin 计费 / 订阅

## 2. Backend 模块对齐

### 现有架构（按 backend report §plugins 模块）

```
iOS
  │
  │ /plugins/products*                    ← 产品列表 / 详情 / 配置 / 状态
  │ /plugins/enablement/me                ← 启用/禁用
  │ /plugins/{id}/scope/me                ← 授权范围
  │ /plugins/{id}/connections/me/*        ← 连接管理
  │ /plugins/{id}/oauth/*                 ← OAuth 流
  │
  ├──→ plugin-runtime-service
  │      ├─ /internal/plugins/{id}/execute-active  ← agent 调
  │      ├─ /internal/plugins/{id}/execute-passive ← 触发器
  │      ├─ /internal/proxy/llm/complete           ← 远程插件代理 LLM
  │      ├─ /internal/proxy/memory/{read|write}    ← 远程插件代理 memory
  │      ├─ /internal/proxy/blob/presign           ← 远程插件代理对象存储
  │      ├─ /internal/proxy/oauth/{action|token}   ← OAuth 受控访问
  │      └─ /internal/proxy/state/{get|upsert|delete}
  │
  ├──→ plugin-registry-service
  │      └─ 注册表 / 部分控制面
  │
  └──→ 远程插件 Pod（统一 common_python.plugins.remote_server）
        ├─ POST /execute   ← 仅由 runtime 调
        ├─ GET  /healthz
        └─ GET  /manifest  ← 读 manifest.json
```

### 已退役 → 当前承接（写 spec / iOS 实现时不要用左侧旧 path）

| 旧 | 新 |
|---|---|
| `GET /plugins/catalog` | `GET /plugins/agent-catalog` |
| `GET /plugins/market` | `GET /plugins/products?view=market&include=state` |
| `PUT /users/me/plugins` | `PUT /plugins/enablement/me` |
| 宽泛 `GET /plugins` | 拆成 `/products` `/agent-catalog` `/oauth/status` `/products/{id}/state` |

## 3. iOS 用户旅程

### 3.1 浏览商店
- ProfileView 或独立 Plugins tab → PluginsView（`GET /plugins/products?view=market`）
- 列表 / 详情 / 截图 / 描述

### 3.2 安装 + 授权
1. 用户点 "安装" → 检查 OAuth 状态 `GET /plugins/{id}/oauth/status`
2. 如未连接 → `POST /plugins/{id}/oauth/authorize` 跳浏览器
3. 回调后 → `POST /plugins/{id}/connections/me/connect`
4. 设置授权范围 → `PUT /plugins/{id}/scope/me`
5. 启用 → `PUT /plugins/enablement/me`

### 3.3 使用（Agent 间接调用）
- 用户不直接调 plugin；在 command 卡片 / Agent 任务里被使用

### 3.4 撤销 / 卸载
- `POST /plugins/{id}/connections/me/revoke` → `PUT /plugins/enablement/me` (disabled)

## 4. 页面级 spec

### 4.1 PluginsView（商店）
- TODO

### 4.2 PluginDetailView
- TODO

### 4.3 PluginPermissionView
- 显示 plugin 要的 Memory 层（L0-L4）+ scope
- 必须明确"Plugin 能读哪些 memory，能写哪些"

## 5. Plugin → Memory 读写权限模型

> 对齐 backend `/internal/proxy/memory/{read|write}`

| Memory 层 | 读权限 | 写权限 |
|---|---|---|
| L0 raw | TODO 默认禁，需用户显式授权 | 禁止（防止污染原始数据） |
| L1 description | TODO | TODO |
| L2 episode | TODO | TODO |
| L3 project | TODO | TODO |
| L4 user_profile | TODO 默认禁 | TODO 默认禁 |

## 6. Manifest 格式

> 现有 first-party plugin 的 manifest.json 是权威源，spec 文档化它。

参考代码：
- `services/plugins/catalog/first_party/calendar_create_event/manifest.json`
- `services/plugins/catalog/first_party/email_sender/manifest.json`

字段（基于 backend 推断，林啸需在 monostone_backend 验证补全）：
- `name` / `version` / `icon` / `description` / `author`
- `service_ref`（Pod service 名）
- `execution_mode`（remote / local）
- `permissions`（memory layers / oauth providers / external network）
- `triggers`（active / passive event subscriptions）
- `inputs` / `outputs`（JSON Schema）

## 7. 与 Agent 调用协议

- `agent-orchestrator-service` 通过 `POST /internal/plugins/{id}/execute-active` 调
- 同步等结果（短任务）vs OAuth 中断 → `PLUGIN_OAUTH_RESUME_QUEUE_URL` 恢复
- TODO: 流式输出？

## 8. Starter 范例

不新建插件，直接用现有 2 个：
- **calendar-create-event-plugin** — 范例: M2 todo → 写日历
- **email-sender-plugin** — 范例: M2 command → 发邮件

为这两个写"插件设计文档"作为开发者参考。

## 9. Acceptance

- [ ] iOS 完整商店 / 安装 / 授权 / 撤销 4 流程跑通
- [ ] manifest 字段表 + 至少 1 个 first-party plugin 的 manifest 全字段说明
- [ ] Memory 权限矩阵（5 层 × 读写）填满
- [ ] 2 个 starter plugin 的设计文档写完（≤ 1 页 / 个）
- [ ] 开发者文档目录结构定下来（不需要内容齐全，结构 OK 即可）
