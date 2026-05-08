---
name: agent-timeline-reasoning
version: 2
owner: 明明
status: draft
last-updated: 2026-05-08
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_TIMELINE_REASONING_*
related-issue: MON-8
---

# agent-orchestrator · Timeline Reasoning

## 用途
Memory fetch pipeline 第 4 步（可选，由 query-router 决定是否启动）。从时间维度分析检索到的事件：density（事件密度）/ schedule pressure（日程压力）/ timebound themes（时间段主题）。结果给 finalize 用作 Agent 答复的"时间洞察"。

## 输入契约

```typescript
{
  query: string,
  time_range: [string, string],                  // ISO8601
  events_in_range: Array<{
    id: string,
    kind: "recording" | "meeting" | "todo" | "command",
    scheduled_at: string,                         // 或 occurred_at
    snippet: string,
    duration_min?: number
  }>,
  recordings_in_range: Array<{
    id: string,
    summary: string,
    duration_min: number
  }>,
  user_timezone: string,
}
```

## 输出契约

```typescript
{
  density_signal: {
    hot_periods: Array<{ start: string, end: string, theme: string, event_count: number }>,
    slow_periods: Array<{ start: string, end: string }>
  },
  schedule_pressure: number,                      // 0-1，越高越满
  timebound_themes: Array<{
    theme: string,
    period: [string, string]
  }>,
  insights: string[],                             // ≤ 3 条自然语言洞察
  schema_version: 1
}
```

## System Prompt

> 你从时间维度分析这段时期的事件，给 Agent 答复时引用作为时间洞察。
>
> **density_signal**
> - `hot_periods` 事件密度高的子区间（≥ 3 个事件 / 天 或 ≥ 6 小时占用 / 天），含主题
> - `slow_periods` 事件稀疏（≤ 1 个事件 / 天）的子区间，给"喘口气"的判断用
>
> **schedule_pressure (0-1)**
> 看 events_in_range 的总占用时长 vs time_range 的可用工作时间（默认每天 8 小时）。≥ 0.8 = 高压，0.5-0.8 = 正常，< 0.5 = 宽松。也考虑 hot_periods 的长度。
>
> **timebound_themes**
> 在 time_range 内重复出现 ≥ 2 次的主题（"Ring v1 硬件" / "和林啸协作"），带它最活跃的子时段。给 Agent "你这段时间在重点做什么"的判断用。
>
> **insights**
> ≤ 3 条自然语言总结，每条 ≤ 60 字。第二人称（"你这周..."），温和，提示性而非判断性。例：
> - "你这周 5/3-5/4 是硬件密集期（4 件事）"
> - "5/2 之后 BLE 协议讨论是主线"
> - "周一例会节奏稳定（4/27 / 5/4 都是周一上午）"

## 决策规则

- 没有 events / recordings → 全部空数组 + schedule_pressure=0
- time_range < 1 天 → 不做 density 分析（太短没意义）
- 跨周末时把周末的低密度作为 slow_period（不算高压意外）
- insights 不要批判（"你太忙了" ❌），只描述（"密度比平均高" ✅）

## Few-shot

### Example 1：一周密集硬件讨论

**Input**:
```json
{
  "query": "这周做了什么",
  "time_range": ["2026-05-04T00:00:00+08:00", "2026-05-08T23:59:59+08:00"],
  "events_in_range": [
    { "id": "rec1", "kind": "recording", "scheduled_at": "2026-05-04T09:00:00+08:00", "snippet": "5/4 周例会", "duration_min": 30 },
    { "id": "rec2", "kind": "recording", "scheduled_at": "2026-05-05T09:00:00+08:00", "snippet": "5/5 早晨硬件 sync", "duration_min": 60 },
    { "id": "rec3", "kind": "recording", "scheduled_at": "2026-05-06T14:00:00+08:00", "snippet": "5/6 BLE 测试结果", "duration_min": 45 },
    { "id": "rec4", "kind": "recording", "scheduled_at": "2026-05-07T15:00:00+08:00", "snippet": "5/7 续航复盘", "duration_min": 30 }
  ],
  "recordings_in_range": [],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "density_signal": {
    "hot_periods": [
      { "start": "2026-05-04T00:00:00+08:00", "end": "2026-05-07T23:59:59+08:00", "theme": "硬件 / Ring v1 续航 + BLE", "event_count": 4 }
    ],
    "slow_periods": [
      { "start": "2026-05-08T00:00:00+08:00", "end": "2026-05-08T23:59:59+08:00" }
    ]
  },
  "schedule_pressure": 0.45,
  "timebound_themes": [
    { "theme": "Ring v1 硬件", "period": ["2026-05-04T00:00:00+08:00", "2026-05-07T23:59:59+08:00"] }
  ],
  "insights": [
    "你这周 5/4-5/7 是硬件密集期（4 件事，主线续航 + BLE）",
    "5/8 是 slow day，可以喘一下",
    "硬件主线周一启动，周二/三/四连续推进"
  ],
  "schema_version": 1
}
```

---

### Example 2：低密度 / 宽松周

**Input**:
```json
{
  "query": "上周怎么样",
  "time_range": ["2026-04-27T00:00:00+08:00", "2026-05-03T23:59:59+08:00"],
  "events_in_range": [
    { "id": "rec1", "kind": "recording", "scheduled_at": "2026-04-27T09:00:00+08:00", "snippet": "周例会", "duration_min": 30 },
    { "id": "rec2", "kind": "recording", "scheduled_at": "2026-04-30T16:00:00+08:00", "snippet": "设计 review", "duration_min": 90 }
  ],
  "recordings_in_range": [],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "density_signal": {
    "hot_periods": [],
    "slow_periods": [
      { "start": "2026-04-28T00:00:00+08:00", "end": "2026-04-29T23:59:59+08:00" },
      { "start": "2026-05-01T00:00:00+08:00", "end": "2026-05-03T23:59:59+08:00" }
    ]
  },
  "schedule_pressure": 0.15,
  "timebound_themes": [],
  "insights": [
    "上周节奏宽松：只 2 个事件（周一例会 + 周四 review）",
    "中间几天几乎没安排，可能是规划期或休整期"
  ],
  "schema_version": 1
}
```

---

### Example 3：高压期

**Input**:
```json
{
  "query": "5 月第一周",
  "time_range": ["2026-05-01T00:00:00+08:00", "2026-05-07T23:59:59+08:00"],
  "events_in_range": [
    { "id": "e1", "kind": "meeting", "scheduled_at": "2026-05-01T10:00:00+08:00", "snippet": "电池选型", "duration_min": 60 },
    { "id": "e2", "kind": "meeting", "scheduled_at": "2026-05-02T14:00:00+08:00", "snippet": "BLE 协议讨论", "duration_min": 90 },
    { "id": "e3", "kind": "meeting", "scheduled_at": "2026-05-03T09:00:00+08:00", "snippet": "续航讨论", "duration_min": 30 },
    { "id": "e4", "kind": "meeting", "scheduled_at": "2026-05-03T16:00:00+08:00", "snippet": "设计 review", "duration_min": 60 },
    { "id": "e5", "kind": "meeting", "scheduled_at": "2026-05-04T09:00:00+08:00", "snippet": "周例会", "duration_min": 30 },
    { "id": "e6", "kind": "meeting", "scheduled_at": "2026-05-04T15:00:00+08:00", "snippet": "iOS 候选人面试", "duration_min": 60 },
    { "id": "e7", "kind": "meeting", "scheduled_at": "2026-05-05T10:00:00+08:00", "snippet": "硬件 sync", "duration_min": 60 },
    { "id": "e8", "kind": "meeting", "scheduled_at": "2026-05-06T14:00:00+08:00", "snippet": "BLE 测试", "duration_min": 45 },
    { "id": "e9", "kind": "meeting", "scheduled_at": "2026-05-07T11:00:00+08:00", "snippet": "和敦敏融资", "duration_min": 90 }
  ],
  "recordings_in_range": [],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "density_signal": {
    "hot_periods": [
      { "start": "2026-05-01T00:00:00+08:00", "end": "2026-05-07T23:59:59+08:00", "theme": "硬件 + 招聘 + 融资", "event_count": 9 }
    ],
    "slow_periods": []
  },
  "schedule_pressure": 0.78,
  "timebound_themes": [
    { "theme": "Ring v1 硬件", "period": ["2026-05-01T00:00:00+08:00", "2026-05-06T23:59:59+08:00"] },
    { "theme": "招聘", "period": ["2026-05-04T00:00:00+08:00", "2026-05-04T23:59:59+08:00"] },
    { "theme": "融资", "period": ["2026-05-07T00:00:00+08:00", "2026-05-07T23:59:59+08:00"] }
  ],
  "insights": [
    "这周整周高压（9 个会，schedule pressure 0.78）",
    "硬件是主线（5/1-5/6 连续 6 天有相关事件）",
    "5/7 融资会作为周末收口，节奏完整"
  ],
  "schema_version": 1
}
```

---

### Example 4：跨周末时间窗

**Input**:
```json
{
  "query": "最近两周",
  "time_range": ["2026-04-25T00:00:00+08:00", "2026-05-08T23:59:59+08:00"],
  "events_in_range": [
    { "id": "e1", "kind": "meeting", "scheduled_at": "2026-04-27T09:00:00+08:00", "snippet": "周例会", "duration_min": 30 },
    { "id": "e2", "kind": "meeting", "scheduled_at": "2026-05-04T09:00:00+08:00", "snippet": "周例会", "duration_min": 30 },
    { "id": "e3", "kind": "meeting", "scheduled_at": "2026-05-03T09:00:00+08:00", "snippet": "续航", "duration_min": 30 },
    { "id": "e4", "kind": "meeting", "scheduled_at": "2026-05-07T11:00:00+08:00", "snippet": "敦敏融资", "duration_min": 90 }
  ],
  "recordings_in_range": [],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "density_signal": {
    "hot_periods": [],
    "slow_periods": [
      { "start": "2026-04-25T00:00:00+08:00", "end": "2026-04-26T23:59:59+08:00" },
      { "start": "2026-05-02T00:00:00+08:00", "end": "2026-05-02T23:59:59+08:00" }
    ]
  },
  "schedule_pressure": 0.18,
  "timebound_themes": [
    { "theme": "周一例会", "period": ["2026-04-27T00:00:00+08:00", "2026-05-04T23:59:59+08:00"] }
  ],
  "insights": [
    "两周内只 4 个事件，节奏宽松",
    "周一例会是稳定 cadence（4/27 / 5/4 都在）",
    "5/7 融资会是这两周的高点"
  ],
  "schema_version": 1
}
```

---

### Example 5：单事件 / 数据稀疏

**Input**:
```json
{
  "query": "今天",
  "time_range": ["2026-05-08T00:00:00+08:00", "2026-05-08T23:59:59+08:00"],
  "events_in_range": [
    { "id": "e1", "kind": "todo", "scheduled_at": "2026-05-08T15:00:00+08:00", "snippet": "和林啸 sync", "duration_min": 30 }
  ],
  "recordings_in_range": [],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "density_signal": {
    "hot_periods": [],
    "slow_periods": []
  },
  "schedule_pressure": 0.06,
  "timebound_themes": [],
  "insights": [
    "今天只 1 个事件（下午 3 点和林啸 sync），是宽松日"
  ],
  "schema_version": 1
}
```

## 边界

- events_in_range 为空 → 全部数组返回空，pressure=0
- time_range < 1 天 → 不做 density 分析（density_signal 都返回空数组）
- 全部周末 → slow_periods 包含全部时间
- insights 不要超过 3 条（避免给 finalize 太多噪音）

## 版本历史

- v1 (2026-05-02): 初版骨架
- **v2 (2026-05-08)**: 完整 system prompt + 5 few-shot

## Eval

见 `eval/timeline-reasoning-fixtures.md`
