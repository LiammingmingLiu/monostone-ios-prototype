# Monostone · 事件协议

BLE 事件（戒指 → 手机）+ WebSocket 事件（云端 → App）的完整定义。

**版本**：v0.1 · 2026-04-09

---

## 1. BLE · 戒指 ↔ 手机

### 1.1 GATT 服务结构

```
Service: Monostone Primary Service
UUID: 0000A001-0000-1000-8000-00805F9B34FB (placeholder)

Characteristics:
├── [R]  Device Info         0000A002-...  — 固件版本 / 电量 / 序列号
├── [W]  Control Command     0000A003-...  — 手机下发指令（开始/停止录音、固件升级）
├── [N]  Ring Event          0000A004-...  — 戒指事件推送（手势识别结果）
├── [N]  Audio Stream        0000A005-...  — 音频 Opus 流
└── [N]  Sensor Data         0000A006-...  — accelerometer / battery
```

R = Read · W = Write · N = Notify

### 1.2 Ring Event payload（0000A004 characteristic）

每个事件是一个 JSON（或 MsgPack 编码以省 BLE 带宽）：

```json
{
  "event": "recording_started",
  "session_id": "uuid-v7",
  "mode": "long | short",
  "trigger": "double_tap | press_hold",
  "started_at": 1712649600123,
  "ring_battery": 87
}
```

**事件类型**：

| event | 触发条件 | payload 额外字段 |
|---|---|---|
| `recording_started` | 双击（long）或按下（short） | `mode`, `trigger` |
| `recording_stopped` | 第二次双击 / 松开 / 超时 / 强制停止 | `stopped_at`, `stop_reason` |
| `press_cancelled` | 按住 < 300ms 就松开 | — |
| `haptic_ack` | 戒指振动反馈确认（手机可据此显示 UI） | — |
| `battery_low` | 电量 ≤ 15% | `battery` |
| `battery_critical` | 电量 ≤ 5% | `battery` |
| `charging_started` | 放进充电底座 | — |
| `charging_completed` | 充满 | — |
| `disconnect_warning` | 信号弱将断开 | `rssi` |

### 1.3 Audio Stream payload（0000A005 characteristic）

```
Chunk header (2 bytes) + Opus payload (variable)

Header:
  bits 0-11  sequence number (0-4095, wrap around)
  bit  12    is_final (最后一包)
  bit  13    is_keyframe
  bits 14-15 reserved
```

**节流**：BLE 5.0 MTU 247，Opus 24kbps → 每 20ms 一包约 60 bytes → 用 BLE packet level 控制流。

### 1.4 Control Command（手机 → 戒指）

```json
// 手机端发送（write without response）
{
  "cmd": "stop_recording",
  "session_id": "uuid-v7"
}

{
  "cmd": "start_recording",
  "mode": "long"  // 应急情况下手机强制触发
}

{
  "cmd": "set_haptic",
  "enabled": true
}

{
  "cmd": "request_battery"
}

{
  "cmd": "ota_begin",
  "firmware_version": "0.3.2",
  "chunks": 1024
}
```

### 1.5 Audio pipeline on phone

```
BLE Audio Stream
  └─► Reorder buffer (按 sequence 排序)
       └─► Decoder check (Opus frame)
            └─► Local SQLite: audio_chunks table
                 └─► Upload worker (网络可用时)
                      └─► POST /audio/upload
                           └─► Cloud
```

丢包处理：
- 连续丢 3 个包 → 标记 session 为 `partial`
- 丢包率 > 5% → 触发"录音质量差"提示给用户
- 可以继续处理，Whisper 对小丢包鲁棒

---

## 2. WebSocket · 云端 → 客户端

### 2.1 连接

```
WSS wss://api.monostone.ai/v1/stream?token={jwt}
```

**握手**：
```
Client → Server: (connect)
Server → Client: { "type": "connected", "session_id": "...", "resume_token": "..." }
```

**心跳**：每 30 秒客户端发 `{"type":"ping"}`，服务器回 `{"type":"pong"}`。连续 3 次无回应则重连。

**断线重连**：用 `resume_token` 拉取断开期间错过的事件：
```
Client → Server: { "type": "resume", "resume_token": "...", "since": 1712649600000 }
Server → Client: (replay missed events in order)
```

### 2.2 服务器 → 客户端事件

所有事件通用字段：
```ts
interface BaseEvent {
  type: string;
  event_id: string;        // 递增 uid, 用于 resume
  timestamp: number;       // ms since epoch
  user_id: string;
}
```

#### `card.created`

新卡出现（一般是 capturing 或 processing 状态）：
```json
{
  "type": "card.created",
  "event_id": "evt_01",
  "timestamp": 1712649600000,
  "card": {
    "id": "card_abc",
    "type": "long_rec",
    "state": "uploading",
    "created_at": 1712649600000,
    "audio_duration_ms": 0,
    "title": null,
    "trigger_context": {...}
  }
}
```

前端动作：在 Timeline 顶部插入新卡片（processing 样式）。

#### `card.updated`

任意字段变更：
```json
{
  "type": "card.updated",
  "event_id": "evt_02",
  "timestamp": 1712649605000,
  "card_id": "card_abc",
  "fields": {
    "state": "transcribing",
    "raw_transcript": "……"
  }
}
```

前端动作：找到 card_id 对应的 DOM，更新变化字段。

#### `card.processing_progress`

指令卡专用，实时推送执行步骤进度：
```json
{
  "type": "card.processing_progress",
  "event_id": "evt_03",
  "timestamp": 1712649610000,
  "card_id": "card_xyz",
  "step_index": 2,
  "step_title": "联网搜索最新信息",
  "step_detail": "并发调用 4 个数据源",
  "status": "running",
  "elapsed_ms": 3200
}
```

前端动作：如果当前打开了这张卡的详情，更新 timeline section 的对应 step。

#### `card.result_updated`

指令卡的 chat 对话后，result 被更新了：
```json
{
  "type": "card.result_updated",
  "event_id": "evt_04",
  "card_id": "card_xyz",
  "new_version": 2,
  "previous_version": 1,
  "changed_fields": ["result.body_markdown"],
  "diff_summary": "扩展 GTM 段为三句"
}
```

前端动作：刷新 "产出" section，显示 "v2 · 当前" 标签，激活"回到上一版"按钮。

#### `card.chat_message`

Agent 在卡片对话里回复了：
```json
{
  "type": "card.chat_message",
  "event_id": "evt_05",
  "card_id": "card_xyz",
  "message": {
    "id": "msg_abc",
    "role": "agent",
    "content": "好，我把 GTM 段扩展成三句…",
    "created_at": 1712649620000,
    "triggered_result_update": true
  }
}
```

前端动作：追加到 chat-chat .turns 区。

#### `card.classified`

短录音分类完成：
```json
{
  "type": "card.classified",
  "event_id": "evt_06",
  "card_id": "card_def",
  "classified_as": "command",
  "confidence": 0.82,
  "alternatives": [
    { "type": "idea", "confidence": 0.14 }
  ]
}
```

前端动作：
- confidence ≥ 0.85 → 静默更新卡片 type
- confidence < 0.85 → 在卡片上显示"看起来是指令？切换类型 ›"

#### `card.deleted`

```json
{ "type": "card.deleted", "event_id": "evt_07", "card_id": "card_abc" }
```

#### `ring.status_changed`

```json
{
  "type": "ring.status_changed",
  "event_id": "evt_08",
  "ring_id": "ring_xxx",
  "status": {
    "connected": true,
    "battery": 87,
    "firmware": "0.3.2"
  }
}
```

前端动作：更新首页 status-line（"第 12 天 · 戒指已连接"）。

#### `memory.inferred`

新记忆推断出来（可选 — 如果给用户记忆可见性）：
```json
{
  "type": "memory.inferred",
  "event_id": "evt_09",
  "memory": {
    "id": "mem_abc",
    "type": "person",
    "content": "蔡哥偏好 closed-loop 定位",
    "confidence": 0.92,
    "source_card_id": "card_abc"
  }
}
```

### 2.3 客户端 → 服务器事件

#### `ping` / `pong`

心跳，见上。

#### `resume`

重连时拉取错过的事件。

#### `subscribe.card`

订阅某张卡的细粒度更新（打开详情时）：
```json
{ "type": "subscribe.card", "card_id": "card_abc" }
```

服务器会发送该卡更密集的 `processing_progress` / `chat_message` 事件。关闭详情时：
```json
{ "type": "unsubscribe.card", "card_id": "card_abc" }
```

---

## 3. 前端 WebSocket client 状态机

```
       ┌──────────────┐
       │ DISCONNECTED │◄─┐
       └───────┬──────┘  │
               │ connect │ error / ping timeout
               ▼         │
       ┌──────────────┐  │
       │  CONNECTING  │──┘
       └───────┬──────┘
               │ connected
               ▼
       ┌──────────────┐
       │   CONNECTED  │
       │  (receiving) │
       └───────┬──────┘
               │ ping timeout / network loss
               ▼
       ┌──────────────┐
       │  RECONNECTING│──► 指数回退：1s, 2s, 4s, 8s, 15s, ...
       └───────┬──────┘
               │ reconnect success (with resume_token)
               ▼
       ┌──────────────┐
       │   RESUMING   │──► 收 replay events, 更新本地状态
       └───────┬──────┘
               │ done
               ▼
          (CONNECTED)
```

### 客户端事件处理建议（伪代码）

```typescript
class MonostoneWS {
  private ws: WebSocket;
  private state: 'DISCONNECTED' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'RESUMING';
  private resumeToken: string | null;
  private lastEventTime: number;
  private backoff = 1000;

  connect() {
    this.state = 'CONNECTING';
    this.ws = new WebSocket(`wss://api.monostone.ai/v1/stream?token=${this.token}`);
    this.ws.onopen = () => {
      this.state = 'CONNECTED';
      this.backoff = 1000;
      this.startHeartbeat();
    };
    this.ws.onmessage = (e) => this.handle(JSON.parse(e.data));
    this.ws.onclose = () => this.reconnect();
  }

  handle(event: any) {
    this.lastEventTime = Date.now();
    switch (event.type) {
      case 'connected':
        this.resumeToken = event.resume_token;
        break;
      case 'card.created':
        store.prependCard(event.card);
        break;
      case 'card.updated':
        store.updateCard(event.card_id, event.fields);
        break;
      case 'card.processing_progress':
        store.updateCardStep(event.card_id, event.step_index, event);
        break;
      case 'card.chat_message':
        store.appendChatMessage(event.card_id, event.message);
        break;
      case 'card.classified':
        store.classifyCard(event.card_id, event.classified_as, event.confidence);
        break;
      case 'ring.status_changed':
        store.updateRingStatus(event.status);
        break;
      // ...
    }
  }

  reconnect() {
    setTimeout(() => {
      this.backoff = Math.min(this.backoff * 2, 15000);
      this.state = 'RECONNECTING';
      this.ws = new WebSocket(`wss://api.monostone.ai/v1/stream?token=${this.token}`);
      this.ws.onopen = () => {
        // Resume with token
        this.ws.send(JSON.stringify({
          type: 'resume',
          resume_token: this.resumeToken,
          since: this.lastEventTime
        }));
        this.state = 'RESUMING';
      };
    }, this.backoff);
  }
}
```

### Web Demo 版本（当前原型）

当前原型里的 `simulateIncomingCard()` 函数就是这个 WebSocket 机制的**本地模拟**。后端对接时，把 `simulateIncomingCard` 替换成真实 WebSocket handler 即可。

---

## 4. 事件顺序保证

WebSocket 事件可能乱序（网络原因），所以每个事件带 `event_id`。前端实现时：
- 维护 `lastProcessedEventId`
- 如果新事件的 `event_id` ≤ `lastProcessedEventId`，忽略
- 如果新事件跳号（有 gap），发 `resume` 请求补齐

对于同一张卡的多个 `card.updated` 事件，服务端保证顺序发送（同一 worker 处理同一 card）。
