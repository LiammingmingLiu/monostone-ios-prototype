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

### 3.2 安装 + 授权（首次一次性配，MON-28 §C 决策）

**链路**：
1. 用户点 "安装" → 检查 OAuth 状态 `GET /plugins/{id}/oauth/status`
2. 如未连接 → `POST /plugins/{id}/oauth/authorize` 跳浏览器
3. 回调后 → `POST /plugins/{id}/connections/me/connect`
4. 自动跳到 PluginPermissionView，**所有 tools 默认 ON**（用户可关掉单个）
5. 用户确认 → `PUT /plugins/{id}/scope/me`（提交 enabled tools 列表）+ `PUT /plugins/enablement/me`

**关键 UX 原则**：
- 用户**只在首次安装时**做一次配置，之后 Agent 调用时不再二次确认（不弹 confirm）
- 默认全开：要让用户体验"plugin 即开即用"的丝滑感，不是"每装一个 plugin 都要做选择题"
- 用户随时可在 PluginPermissionView 修改，改动立即生效
- 写操作 toggle 跟读操作 toggle 视觉差异化（写 = 橙色 verb tag），让用户扫一眼能识别"哪些能改东西"

### 3.3 使用（Agent 间接调用）
- 用户不直接调 plugin；在 command 卡片 / Agent 任务里被使用

### 3.4 调整 / 停用（v0.5 没有"卸载"概念）

**核心决策（MON-28）**：first-party plugin 不允许"卸载"——7 个官方 plugin 永远在已装列表里。用户不想用某个能力 = 在 PluginPermissionView 里关掉对应 tool 的 toggle。

理由：
- v0.5 只有 7 个 first-party plugin，列表不会膨胀
- "卸载/重装" 引入额外状态（已撤销 OAuth 但又想用 → 重新走授权流），增加用户认知负担
- 跟 ChatGPT MCP / Notion Connectors UX 一致（toggle 关停 vs 卸载）

操作矩阵：
| 用户意图 | UX 操作 | 后端调用 |
|---|---|---|
| 暂时不想 Agent 用某个 plugin | PluginPermissionView 顶部"全部能力"toggle 关 | `PUT /plugins/enablement/me` (disabled) |
| 不想 Agent 用某个具体 tool | 该 tool 行 toggle 关 | `PUT /plugins/{id}/scope/me` (从 scope 列表移除该 tool) |
| OAuth 失效需重连 | 详情页顶部 OAuth strip 上的"重新授权" | `POST /plugins/{id}/oauth/authorize` |
| 完全断开账号 | （v0.5 不暴露这个动作；v1.0 加） | `POST /plugins/{id}/connections/me/revoke` |

## 4. 页面级 spec

### 4.1 PluginsView（商店）
- TODO

### 4.2 PluginDetailView
- TODO

### 4.3 PluginPermissionView（MON-28 决策落地）

**屏幕结构**（自上而下）：

1. **Plugin 头部**：icon (48×48 圆角方块) + 名字 + 一句话描述
2. **OAuth 连接 strip**（淡绿背景）：连接状态 + 账号 + "重新授权"链接（仅当 plugin 需要 OAuth 时显示）
3. **能力区块**：
   - 标题"能力"
   - **"全部能力"主 toggle** — 一键全开 / 全关，等价于 plugin enable/disable
   - **每个 tool 一行**，结构：`[verb tag] [tool 名 + 一句话描述] [toggle]`
     - verb tag：`写`（橙色背景白字 `var(--accent)`）/ `读`（灰色背景灰字）
     - 描述用人话写："创建日历事件" + 子标题"'明天下午 3 点和 Sean 开会' → 直接进日历"
     - 描述来源 = plugin manifest 的 `tools[].description_zh` 字段（first-party 由明明 / 林啸 写）
4. **底部说明**（settings-desc 灰小字）：
   > 橙色"写"标签 = 这个能力会改东西。
   > 灰色"读"标签 = 只读不改。
   > 关掉的能力 Agent 不会再调用，再打开恢复。

**视觉设计原则（MON-28 §B-C 决策）**：
- 不分组（不做 read/write section）—— 让 plugin 提供方决定 tool 顺序
- 视觉差异通过 **verb tag 颜色**（不是 toggle 颜色）—— toggle 全用统一橙色，避免"开关有颜色 = 危险"的误导
- 用户单独 toggle tool 时立即生效 + toast 反馈

**HTML 锚点**：`#s18` in `monostone-ux05/index.html`

## 5. Plugin tool-level 权限模型（MON-28 §A-§D 决策）

> **核心决策**：v0.5 **不向用户暴露 Memory 层（L0-L4）权限矩阵**。Memory 读写由 memory-tree-worker 统一守门，plugin 默认全量读、写入走标准 raw → description 抽象 pipeline。

### 5.1 Memory 侧（往内 — 用户不可见）

| 维度 | 决策 |
|---|---|
| **plugin 读 memory** | 默认全量。memory-api 不对 plugin 做层级过滤。理由：orchestrator 需要把完整 context 推给 plugin |
| **plugin 写 memory** | 走 `/internal/proxy/memory/write` 进入 raw 层 → memory-tree-worker 自动抽象到 description / episode / project。**plugin 不能直接写更高层节点** |
| **污染防御** | 不做 plugin-level 隔离。依赖 memory-tree-worker 自身的去重 / importance 加权 / multi-evidence 要求（见 MON-5 prompt 套件） |
| **暴露给用户的 UI** | 无。"Plugin 会改 memory" 是默认行为 / 产品承诺，不是可选项 |

> ⚠️ **未来安全 issue**（MON-28 完成时 spawn）：审计日志 + 异常写入告警 + 第三方 plugin 引入时的 Memory 隔离策略 — 见独立 issue。

### 5.2 Plugin 对外能力（往外 — 用户可见，PluginPermissionView 控制）

每个 plugin 在 manifest 里声明它暴露的 **tools**（对应 backend `/plugins/{id}/scope/me` 的 scope items）。用户在 PluginPermissionView **按 tool 粒度** toggle：

| Tool 类型 | 例子 | UX 处理 |
|---|---|---|
| **read** | calendar.list_events / mail.list / web.search | verb tag = `读`（灰） |
| **write** | calendar.create_event / mail.send / note.save | verb tag = `写`（橙） |

**关闭某 tool 后的 plugin 行为**：plugin 在调用时收到该能力的 401，自行 graceful degrade（manifest 里要写"如果没有 X 能力，会怎么样"）。Agent 端遇到 plugin 报"能力未授权"时，换 plugin 或告诉用户"我想做 X 但 calendar 插件的'创建事件'能力被你关了"。

### 5.3 v0.5 不做的事（明确范围）

| 不做的事 | 原因 | 何时做 |
|---|---|---|
| Memory 层级权限矩阵 UI | 默认全量读写，UX 不暴露 | 第三方 plugin 上线时（v1.0+） |
| 每次调用 confirm 弹窗 | 对 first-party 信任 + 减少打扰 | 第三方 plugin 上线时 |
| 用户可见审计日志 | first-party 信任度高，UI 投资回报比低 | v1.0；后端从 v0.5 开始记 |
| 必需 / 可选 tool 区分 | 简化用户决策，全部"装就授权" | 第三方 plugin 上线时 |
| 卸载 plugin | 7 个 first-party 永远在 | v1.0 第三方时 |

## 6. Manifest 格式

> 现有 first-party plugin 的 manifest.json 是权威源，spec 文档化它。

参考代码：
- `services/plugins/catalog/first_party/calendar_create_event/manifest.json`
- `services/plugins/catalog/first_party/email_sender/manifest.json`

字段（基于 backend 推断，林啸需在 monostone_backend 验证补全）：
- `name` / `version` / `icon` / `description` / `author`
- `service_ref`（Pod service 名）
- `execution_mode`（remote / local）
- `oauth_provider`（如需要 — google / microsoft / apple / null）
- `triggers`（active / passive event subscriptions）
- `inputs` / `outputs`（JSON Schema）
- **`tools[]`** — 用户在 PluginPermissionView 看到的能力列表（MON-28 §B-§D）

### 6.1 `tools[]` 字段（MON-28 决策落地）

每个 tool 一个 entry：

```json
{
  "id": "calendar.create_event",
  "verb": "write",                          // "read" | "write" — 决定 UX verb tag 颜色
  "name_zh": "创建日历事件",                  // PluginPermissionView 一行的标题
  "description_zh": "「明天下午 3 点和 Sean 开会」→ 直接进日历",  // 子标题，要写成"用户怎么用上"的人话
  "endpoint": "POST /execute?action=create_event",  // 远程 plugin Pod 的实际调用
  "default_enabled": true,                  // 安装时默认是否开（v0.5 全是 true）
  "memory_access": ["read:project", "write:raw"]  // 仅供后端 / 林啸参考，不暴露给用户
}
```

**写规范（明明 / 林啸 写 manifest 时遵循）**：
1. `verb` 严格按"会不会改外部状态"判定：
   - 改外部（日历事件、邮件发送、笔记写入、文件上传）= `write`
   - 只读外部（列日程、读邮件、搜网页）= `read`
   - **写 memory 不算 `write`**（默认行为，所有 plugin 都会写 memory，不算单独能力）
2. `name_zh` ≤ 12 字
3. `description_zh` ≤ 30 字 + 必须举一个具体场景例子
4. **不能自定义 verb tag 文案**（避免 plugin 用"轻轻地保存"这种词诱导授权）— 平台只渲染"读"/"写"两种

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

### MON-28（完成）
- [x] §5 Plugin 权限模型重写：从 6 层 memory 矩阵改为"memory 默认全量 + tool-level 用户控制"
- [x] §4.3 PluginPermissionView 写完整（屏幕结构 + 视觉差异规范）
- [x] §3.2 安装 + 授权链路重写（首次一次性配 + tool 默认全开）
- [x] §3.4 改"撤销/卸载"→"调整/停用"（v0.5 没有卸载概念）
- [x] §6.1 manifest `tools[]` 字段规范定下来
- [x] ux05 prototype 新增 PluginsView (s17) + PluginPermissionView (s18) + Profile 入口
- [x] spawn 后续安全 issue（plugin 调用审计 + 第三方隔离策略）

### MON-27（下一个）
- [ ] PluginsView 商店列表（已经有骨架，需补"商店 vs 已装" tab + 单个 plugin 详情页）
- [ ] 6 步安装流程的每步 UI + 文案（OAuth 跳转的 loading state、回调成功的过渡）

### v0.5 整体（其他 issue 收口）
- [ ] manifest 字段表 + 至少 1 个 first-party plugin 的 manifest 全字段说明（MON-25 cancel，转为林啸 verify backend 实际格式）
- [ ] 2 个 starter plugin 的设计文档（MON-30 cancel）
- [ ] 开发者文档目录结构（MON-31 cancel）
