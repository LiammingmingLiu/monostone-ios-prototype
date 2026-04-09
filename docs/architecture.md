# Monostone · 系统架构全景

给后端一份"整个系统由哪些组件组成、它们怎么说话"的概览。

**版本**：v0.1 · 2026-04-09
**配套**：[semantic-map.md](./semantic-map.md) · [data-flow.md](./data-flow.md) · [events-protocol.md](./events-protocol.md)

---

## 1. 五层总览

```
┌─────────────────────────────────────────────────────────────┐
│                      外部服务 External                      │
│  Apple Calendar · Linear · Notion · Gmail · LinkedIn        │
│  OpenAI · Anthropic · Google Gemini · Crunchbase …          │
└───────────────▲─────────────────────────────────────────────┘
                │ OAuth / REST / GraphQL
                │
┌───────────────┴─────────────────────────────────────────────┐
│                        Cloud 云端                            │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │  API Server  │ │  WebSocket   │ │  Async Worker Pool   │ │
│  │  (REST)      │ │  (Realtime)  │ │  (Processing Queue)  │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │   Postgres   │ │    Redis     │ │  Object Storage (S3) │ │
│  │  (Cards/     │ │  (Session/   │ │  (Audio blobs)       │ │
│  │   Memory)    │ │   Queue)     │ │                      │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         LLM Gateway (可切换供应商 + BYOK)            │   │
│  │   Claude · GPT · Gemini · 本地 Whisper ASR           │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────▲─────────────────────────────────────────────┘
                │ HTTPS/WSS (TLS 1.3)
                │ X-Device-Id · X-Device-Type: ios | macos | web
                │
┌───────────────┴─────────────────────────────────────────────┐
│                     Client 客户端                            │
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────────┐   │
│  │  iOS App      │ │  macOS App    │ │  Web Demo       │   │
│  │  (Swift/SwiftUI) (Swift/AppKit) │ (HTML/JS 原型)   │   │
│  │                                                      │   │
│  │  · BLE client      · File system integration         │   │
│  │  · Local SQLite    · Deep editor                     │   │
│  │  · EventKit        · Plugin host                     │   │
│  │  · Keychain        · Shell / CLI bridge              │   │
│  └───────┬───────┘ └───────┬───────┘ └─────────────────┘   │
└──────────┼─────────────────┼─────────────────────────────────┘
           │ BLE 5.0 GATT    │
           │                 │ (macOS 也可直连 BLE)
           │                 │
┌──────────▼─────────────────▼──────────┐
│           Ring 戒指                    │
│  ┌──────────────────────────────────┐ │
│  │  Ambiq Apollo + BLE 双芯         │ │
│  │  Infineon 双麦阵列 (15dB SNR)    │ │
│  │  双击 / 按住 手势识别             │ │
│  │  Opus 实时编码推送                │ │
│  │  ≥12h 待机 · 4h 本地 buffer       │ │
│  └──────────────────────────────────┘ │
└────────────────────────────────────────┘
```

---

## 2. 核心组件职责

### 2.1 Ring · 戒指
- **采集**：双麦 16kHz PCM → Opus 编码 → BLE notify
- **手势识别**：本地识别双击（长录音）vs 按住（短录音），不上云
- **本地 buffer**：≤4 小时音频，防止手机离线时丢数据
- **状态广播**：电量、连接、固件版本通过 BLE characteristic read

### 2.2 iOS App · 前端
- **BLE client**：订阅戒指事件，接收音频流
- **本地 SQLite**：`audio_sessions`（临时音频）+ `cards`（本地缓存）+ `chat_messages`
- **EventKit**：读写 Apple 日历，用于会议识别和待办写入
- **Keychain**：存储 OAuth tokens、BYOK API keys
- **trigger_context 采集**：CoreMotion（走路/驾驶/静止）+ CoreLocation（家/公司）+ EventKit（会后）
- **WebSocket client**：长连接接收后端推送
- **UI 渲染**：参考 [semantic-map.md](./semantic-map.md) 中的 10 个 screen

### 2.3 macOS App · 桌面端
- 继承 iOS 全部能力
- **文件系统集成**：`~/Monostone/` 下有 Recordings/ Artifacts/ Projects/
- **深度编辑**：长录音和指令结果的完整编辑器（iOS 只能轻量改）
- **Plugin host**：支持 Processor / Destination / Agent plugins
- **Shell 桥**：可以唤起 Claude Code、Cursor 等本地 CLI

### 2.4 Cloud · 云端后端

#### API Server (REST)
- 用户认证、卡片 CRUD、配置管理、OAuth 回调
- 详见 [api-contract.md](./api-contract.md)

#### WebSocket Server
- 每个用户一个长连接
- 推送 `card.created / card.updated / card.processing_progress / ring.status_changed`
- 详见 [events-protocol.md](./events-protocol.md)

#### Async Worker Pool
- 从 Redis 队列消费任务
- 执行 pipeline：transcribe → classify → type-specific processing → deliver
- 详见 [data-flow.md](./data-flow.md) 阶段 3-5

#### Postgres
- `users / cards / chat_messages / memories / projects / integrations`
- 详见 [data-flow.md §3](./data-flow.md)

#### Redis
- Session tokens
- Processing queue（BullMQ 或 Celery 或自建）
- Rate limiting
- 实时在线用户表

#### Object Storage (S3 兼容)
- 原始 Opus 音频 blob
- 导出的 zip/json 文件（临时）
- 加密存储 · 用户可控是否上云

#### LLM Gateway
- 统一抽象多家 LLM 供应商
- 支持 BYOK：用户提供 key → 请求直接打到用户的 quota
- 回退策略：主模型超时 → 切备用模型
- 缓存层：相同上下文的分类请求去重

### 2.5 External Services · 外部服务
- **日历**：Apple (EventKit 本地) / Google Calendar (OAuth) / Outlook (OAuth)
- **投递目标**：Notion (OAuth) / Linear (OAuth) / Gmail (OAuth) / Obsidian (local)
- **LLM**：OpenAI / Anthropic / Google (各自 API)
- **数据富集**：Crunchbase / LinkedIn（灵感的项目归属可能用到）

---

## 3. 数据流向（简化版）

```
Ring → BLE → iOS → Upload → Cloud → Worker → Postgres → WebSocket → iOS → UI
 │                    │                           │
 └─ 本地 buffer      └─ S3 audio blob           └─ LLM Gateway (BYOK)
                                                     │
                                                     └─ External OAuth (Notion/Linear/…)
```

详细数据流见 [data-flow.md](./data-flow.md)。

---

## 4. 关键技术栈推荐

| 层 | 推荐 | 备注 |
|---|---|---|
| iOS | Swift + SwiftUI + Combine | — |
| macOS | Swift + SwiftUI + AppKit | 可复用 iOS 70% 代码 |
| Web Demo | HTML/CSS/Vanilla JS | **当前原型就是** |
| API Server | Node.js (Hono/Fastify) 或 Python (FastAPI) | 任选 |
| WebSocket | Socket.IO 或原生 ws | — |
| Worker | BullMQ (Node) 或 Celery (Python) | — |
| DB | Postgres 15+ | pgvector 扩展用于 memory 向量检索 |
| Cache | Redis 7+ | — |
| Object Store | S3 / R2 / MinIO | — |
| LLM SDK | Anthropic SDK / OpenAI SDK | + 自写 BYOK gateway |
| ASR | OpenAI Whisper API (主) + 本地 Whisper.cpp (隐私可选) | — |

---

## 5. 部署拓扑

```
                    ┌──────────────┐
                    │  CloudFront  │
                    │    (CDN)     │
                    └──────┬───────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  API x N  │    │  WS x N   │    │  Worker x M│
    │ (auto-    │    │  (sticky  │    │  (queue    │
    │  scaled)  │    │  session) │    │  consumer) │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                │
          └───────┬────────┴────────┬───────┘
                  │                 │
            ┌─────▼─────┐    ┌──────▼──────┐
            │ Postgres  │    │    Redis    │
            │  (HA)     │    │  (Cluster)  │
            └───────────┘    └─────────────┘
                  │
            ┌─────▼─────┐
            │  S3/R2    │
            │ (audio)   │
            └───────────┘
```

---

## 6. 安全要点

1. **端到端原则**：音频默认只在设备本地，除非用户明确授权上云
2. **零信任 LLM**：BYOK 时，用户的 key 永远不碰我们的数据库；每次请求前从 Keychain 拉取
3. **TLS 1.3 强制**：所有 HTTPS 和 WSS
4. **OAuth token rotation**：Notion/Linear/Google 的 refresh token 定期轮换
5. **Postgres 行级安全 (RLS)**：确保用户只能读写自己的 cards / memories
6. **Audit log**：任何对 memory / chat 的修改都记录
7. **Rate limiting**：按 user_id + endpoint 限流
8. **GDPR / EO 14117**：见 [privacy-compliance.md]（待写）
