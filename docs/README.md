# Monostone iOS Prototype · 文档索引

> **仓库作用**：这是 Monostone（AI 记忆戒指）iOS App 的**单文件 HTML 原型**。所有屏幕、模态、动效都写在 `index.html` 里，mock 数据抽到 `data/mock.js`。目的是**在接入真实后端和写 native 代码之前**，用最快的方式把产品形态、交互、数据流完整走通一遍。
>
> **部署地址**：https://monostone-ios-prototype.vercel.app
>
> **这个 `docs/` 文件夹**是给后续接手的同事（特别是 iOS native 版工程师和后端工程师）看的 reference set，9 份文档按主题分工，下面是推荐阅读顺序。

---

## 文档列表与阅读顺序

按**新工程师进组第一天**的推荐阅读顺序排列：

### 第一阶段 · 理解产品是什么（30 分钟）

1. **[architecture.md](architecture.md)** — 5 层系统架构：戒指硬件 → iOS/macOS → 云 → 外部集成。读完就知道"这家公司到底在做什么"
2. **[semantic-map.md](semantic-map.md)** — 产品的语义地图：什么是 capture / memory / agent / context，四个核心概念的边界在哪里
3. **[data-flow.md](data-flow.md)** — 从录音一帧音频到 Agent 生成一封邮件的完整链路，包含 Memory Tree L0-L4 层级，是理解"为什么要做 memory 子系统"的关键

### 第二阶段 · 看懂原型代码（1 小时）

4. **[pages-and-interactions.md](pages-and-interactions.md)** ⭐️ — **所有 17 个页面 / modal** 的用途、UI 区块、数据依赖、导航关系（含 mermaid 图），以及后半段 **"非平凡交互清单"**（每个动效的 iOS 实现复杂度估计）。**这是 iOS 工程师最应该读的一份**
5. **[data-models.md](data-models.md)** — 25+ 个核心实体的 TypeScript 类型定义 + 必填 / 枚举 / 关联关系图，外加"原型 mock 数据映射表"（哪个 mock 对应哪个实体）
6. **[api-contract.md](api-contract.md)** — 50+ 条 HTTP / WebSocket 接口契约，按 auth / feed / memory / agent / recording / integrations / privacy / export 分区。**所有接口都标注"未实现但需要"**——原型全用 hardcoded mock

### 第三阶段 · 接入外部系统时查（按需）

7. **[oauth-flows.md](oauth-flows.md)** — 第三方 OAuth 接入细节（Apple Calendar / Google / Linear / Notion / Gmail / Obsidian）
8. **[events-protocol.md](events-protocol.md)** — 戒指 ↔ 手机的 BLE 事件协议
9. **[sharing-spec.md](sharing-spec.md)** — 分享功能规范（Markdown / PDF / 平台降级策略）

---

## 文档交叉引用矩阵

下表说明各文档之间的依赖关系，方便跨文档跳转查询：

| 当你在读... | 可能需要同时参考 |
|---|---|
| `architecture.md` | `semantic-map.md`、`data-flow.md` |
| `semantic-map.md` | `data-flow.md`、`data-models.md` |
| `data-flow.md` | `events-protocol.md`（BLE 层）、`data-models.md`（Memory 实体）、`api-contract.md`（recording 接口） |
| `pages-and-interactions.md` | `data-models.md`（每个页面的数据依赖）、`api-contract.md`（接口契约）、`data-flow.md`（新卡片入场动画背后的 pipeline） |
| `data-models.md` | `api-contract.md`（响应 schema 应完全匹配实体定义） |
| `api-contract.md` | `data-models.md`（请求 / 响应 body 的字段类型定义）、`oauth-flows.md`（integrations 接口） |
| `oauth-flows.md` | `api-contract.md` 的 `/v1/integrations/*` 接口 |
| `events-protocol.md` | `data-flow.md` 的 capture 阶段 |
| `sharing-spec.md` | `api-contract.md` 的 `/v1/cards/{id}/share` |

---

## 快速导航 · 按任务找文档

### "我要实现一个新的 iOS 屏幕"
1. 查 `pages-and-interactions.md` 找到对应 screen 的 UI 区块 + 数据依赖
2. 查 `data-models.md` 拿到需要的实体类型
3. 查 `api-contract.md` 拿到对应接口契约
4. 查 `pages-and-interactions.md` 后半段"非平凡交互清单"评估动效复杂度

### "我要实现 Agent 聊天功能"
1. `pages-and-interactions.md` 的 `agent_tab` 章节 + "Agent agent_tab" 交互小节
2. `data-models.md` 的 `AgentConversation` / `AgentMessage` 实体
3. `api-contract.md` 的"Agent 聊天（IM 会话）"小节
4. 原型 `data/mock.js` 的 `window.AGENT_CONVERSATION` 看实际数据形态

### "我要实现 Memory 浏览页"
1. `pages-and-interactions.md` 的 `memory_tab` 章节
2. `data-models.md` 的 `Memory` / `Entity` / `MemoryOverview` 实体
3. `api-contract.md` 的"Memory"小节
4. `data-flow.md` 的 Memory Tree L0-L4 层级定义（理解数据怎么来的）
5. 原型 `data/mock.js` 的 `window.MEMORY_OVERVIEW`

### "我要接 Google Calendar 同步"
1. `oauth-flows.md` 找 Google OAuth 流程
2. `api-contract.md` 的 `/v1/integrations/delivery-targets` 和 `/v1/integrations/calendar`
3. `data-models.md` 的 `DeliveryTarget` / `CalendarConnection` / `ReminderPolicy` 实体

### "我要做戒指硬件 BLE 通信"
1. `architecture.md` 的硬件层
2. `events-protocol.md` 的 BLE 事件协议
3. `data-flow.md` 的 capture 阶段（音频分帧上传 pipeline）

### "我要理解 Memory 为什么这么设计"
1. `data-flow.md` 的 "为什么要做 memory 子系统" + Memory Tree 层级
2. `semantic-map.md` 的 memory vs context 边界
3. 看代码里的 `rec-2`（林啸 Memory A/B 测试会议纪要）—— 那是团队实际在讨论的 memory 架构决策

---

## 原型代码结构

```
monostone-ios-prototype/
├── index.html            ← 主文件：所有 17 个 screen / modal 的 HTML + CSS + 主 JS
├── data/
│   └── mock.js           ← 抽出来的 mock 数据（4 个 window 顶层对象）
│                           ├─ window.FULL_SUMMARIES  (长录音完整纪要)
│                           ├─ window.ACTION_ITEMS    (action items 映射 cardId → items[])
│                           ├─ window.MEMORY_OVERVIEW (记忆页数据)
│                           └─ window.AGENT_CONVERSATION (Agent 聊天记录)
├── ring.png              ← splash 页的戒指图
└── docs/                 ← 本文件夹
```

### 如何在本地跑原型

```bash
cd monostone-ios-prototype
python3 -m http.server 8000
# 打开 http://localhost:8000
```

**注意**：必须通过 HTTP server 访问，不能直接 `open index.html`，因为 `data/mock.js` 是通过 `<script src="data/mock.js">` 引入的，`file://` 协议下浏览器会拦截跨文件请求。

### 键盘快捷键（demo 用）

在原型里按 **← / →** 方向键可以在所有 screens 之间按顺序切换：`s1 → s2 → s3 → s4 → s5 → s6 → s7 → s8 → s9 → s10 → s11 → s12 → s13 → s14 → s15 → s16`

---

## 文档维护约定

1. **保持 mock 和文档同步**：如果修改 `data/mock.js` 的 schema，同步更新 `data-models.md` 对应实体定义
2. **新增页面时更新 3 份文档**：`pages-and-interactions.md`（页面描述 + 导航图）+ `data-models.md`（新实体） + `api-contract.md`（新接口）
3. **字段命名一致性**：mock 里的字段名、文档里的类型定义字段名、真实后端接口字段名 **三者必须一致**。如果分歧，以 `data-models.md` 为准
4. **标注实现状态**：新接口默认标注"未实现但需要"，落地后改成"mock"或"已实现"

---

## 反向索引 · 我看到这个概念在哪里能找到完整定义

| 概念 | 权威定义文档 |
|---|---|
| "Card" 卡片的 4 种 type | `data-models.md` §3 Card |
| Memory Tree L0-L4 层级 | `data-flow.md` + `data-models.md` §19 Memory |
| Entity（聚合了多条 memory 的实体） | `data-models.md` §19.a Entity |
| Agent 聊天消息 5 种类型 | `data-models.md` §19.d AgentMessage |
| Action Item 的 3 个用户操作（接受 / 拒绝 / 继续推进） | `pages-and-interactions.md` §3 recording_details |
| 左滑删除手势 | `pages-and-interactions.md` §A1 Action Item 左滑删除 |
| FAB 长按 vs 快点的状态机 | `pages-and-interactions.md` §F1 F2 |
| Modal 从底部滑入动画 | `pages-and-interactions.md` §M1 |
| Daily Digest 产品机制 | `data-flow.md` + `api-contract.md` §Daily Digest |
| BYOK LLM Gateway | `architecture.md` + `api-contract.md` §API Keys (BYOK) |
| Human Correction 机制 | `data-flow.md` + `api-contract.md` §POST /v1/memory/correct |
| FullSummary 的 HTML 渲染契约（H1/H2/H3） | `pages-and-interactions.md` §15 modal_full_summary |
