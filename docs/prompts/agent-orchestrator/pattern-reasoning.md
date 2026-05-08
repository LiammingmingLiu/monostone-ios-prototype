---
name: agent-pattern-reasoning
version: 2
owner: 明明
status: draft
last-updated: 2026-05-08
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_PATTERN_REASONING_*
related-issue: MON-8
---

# agent-orchestrator · Pattern Reasoning

## 用途
Memory fetch pipeline 第 5 步（可选）。挖重复信号：repeat signal / habit candidates。例如"用户每周三都开 sync 会"、"每次和林啸聊都是技术细节"。

## 输入契约

```typescript
{
  query: string,
  candidate_signals: Array<{
    episode_id: string,
    theme: string,                  // 主题词（"周例会"/"BLE 讨论"/"晨跑"）
    occurred_at: string,            // ISO8601
    entities: string[]
  }>,
  user_timezone: string,
}
```

## 输出契约

```typescript
{
  repeat_signals: Array<{
    pattern_kind: "weekly" | "monthly" | "topic_recurrence" | "entity_recurrence",
    description: string,            // ≤ 40 字
    confidence: number,             // 0-1
    evidence_episode_ids: string[]
  }>,
  habit_candidates: Array<{
    description: string,
    suggested_user_profile_update: {
      category: "habits" | "preferences" | "relationships",
      key: string,
      value: any
    } | null
  }>,
  schema_version: 1
}
```

## System Prompt

> 你从这批 episode 信号里挖重复模式，给 Agent 答复时引用。
>
> **4 种 pattern_kind**
> - `weekly` 每周固定时段重复（"每周一 9 点周例会"）
> - `monthly` 每月固定时段重复
> - `topic_recurrence` 主题反复出现（"BLE 协议讨论这个月出现 5 次"）
> - `entity_recurrence` 跟某人 / 某物相关的事件反复（"每次和林啸的会都聚焦硬件"）
>
> **confidence 评分**
> - 至少 3 次 evidence 才报 pattern（hard rule，< 3 次返回空）
> - 3 次 → confidence 0.5-0.7（弱模式）
> - 5 次 + 时间规律 → 0.7-0.9
> - 5 次 + 时间规律 + 其他维度（同实体）→ 0.9+
>
> **habit_candidates**
> 是 repeat_signal 的子集，专指可以**写入 user_profile.habits** 的稳定行为。判别：
> - 至少 5 次 evidence
> - 时间规律明显（每周固定 / 每天固定）
> - 用户自愿性（不是被会议邀请被动安排）
>
> 例：晨跑 4 天连续 → 还不算（不到 5 次），写描述里观察就行
> 例：晨跑 14 天连续 → 报为 habit_candidate + suggested_user_profile_update
>
> ⚠️ habit_candidate 不直接写入 user_profile，由 Agent finalize 时**主动让用户确认**（"我注意到你最近每天 6:30 跑步，要不要记到画像里？"）。本 prompt 只输出建议。
>
> **description**
> 第二人称，温和（"你每周一开例会"）。≤ 40 字。
>
> **不报的情况**
> - candidate_signals 不足 3 → 直接返回空数组
> - 主题太泛（"开会" 这种没具体主题）→ 不报
> - 时间散乱（5 次但没规律）→ 报 topic_recurrence 但 confidence 低

## 决策规则

- 硬阈值：repeat_signal ≥ 3 evidence；habit_candidate ≥ 5 evidence
- 时间规律检测：相邻间隔的标准差 / 平均值 < 0.3 视为有规律
- 跨长时段（≥ 30 天）才看 monthly pattern；否则归 topic_recurrence
- 不主动写入 user_profile（让用户确认）

## Few-shot

### Example 1：周一例会模式

**Input**:
```json
{
  "query": "我最近的工作节奏",
  "candidate_signals": [
    { "episode_id": "ep1", "theme": "周例会", "occurred_at": "2026-04-13T09:00:00+08:00", "entities": ["林啸", "Sean"] },
    { "episode_id": "ep2", "theme": "周例会", "occurred_at": "2026-04-20T09:00:00+08:00", "entities": ["林啸"] },
    { "episode_id": "ep3", "theme": "周例会", "occurred_at": "2026-04-27T09:00:00+08:00", "entities": ["林啸", "Sean"] },
    { "episode_id": "ep4", "theme": "周例会", "occurred_at": "2026-05-04T09:00:00+08:00", "entities": ["林啸", "Sean"] }
  ],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "repeat_signals": [
    {
      "pattern_kind": "weekly",
      "description": "你每周一 9 点开例会，主要和林啸/Sean",
      "confidence": 0.92,
      "evidence_episode_ids": ["ep1", "ep2", "ep3", "ep4"]
    }
  ],
  "habit_candidates": [],
  "schema_version": 1
}
```

**为什么没 habit_candidate**：周例会是工作节奏，不算个人习惯（写到 user_profile 价值低）。

---

### Example 2：晨跑习惯成型

**Input**:
```json
{
  "query": "我最近的健康状态",
  "candidate_signals": [
    { "episode_id": "r1", "theme": "晨跑", "occurred_at": "2026-04-25T06:30:00+08:00", "entities": [] },
    { "episode_id": "r2", "theme": "晨跑", "occurred_at": "2026-04-26T06:30:00+08:00", "entities": [] },
    { "episode_id": "r3", "theme": "晨跑", "occurred_at": "2026-04-27T06:30:00+08:00", "entities": [] },
    { "episode_id": "r4", "theme": "晨跑", "occurred_at": "2026-04-28T06:30:00+08:00", "entities": [] },
    { "episode_id": "r5", "theme": "晨跑", "occurred_at": "2026-05-01T06:30:00+08:00", "entities": [] },
    { "episode_id": "r6", "theme": "晨跑", "occurred_at": "2026-05-02T06:30:00+08:00", "entities": [] },
    { "episode_id": "r7", "theme": "晨跑", "occurred_at": "2026-05-03T06:30:00+08:00", "entities": [] },
    { "episode_id": "r8", "theme": "晨跑", "occurred_at": "2026-05-08T06:30:00+08:00", "entities": [] }
  ],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "repeat_signals": [
    {
      "pattern_kind": "weekly",
      "description": "你最近基本每天早 6:30 晨跑",
      "confidence": 0.88,
      "evidence_episode_ids": ["r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8"]
    }
  ],
  "habit_candidates": [
    {
      "description": "每天早 6:30 晨跑（已观察到 8 天，跨 4/25-5/8）",
      "suggested_user_profile_update": {
        "category": "habits",
        "key": "morning_run",
        "value": { "schedule": "daily 06:30", "started_at": "2026-04-25" }
      }
    }
  ],
  "schema_version": 1
}
```

**为什么有 habit_candidate**：≥ 5 evidence + 时间规律强（都是 6:30）+ 个人自愿（晨跑不是被安排）。但仍是"建议"，由 Agent 主动询问用户确认才写入 profile。

---

### Example 3：topic_recurrence — BLE 反复出现

**Input**:
```json
{
  "query": "最近在搞什么",
  "candidate_signals": [
    { "episode_id": "ep1", "theme": "BLE 协议", "occurred_at": "2026-05-02T14:00:00+08:00", "entities": ["林啸"] },
    { "episode_id": "ep2", "theme": "BLE 测试", "occurred_at": "2026-05-04T11:00:00+08:00", "entities": ["林啸"] },
    { "episode_id": "ep3", "theme": "BLE 调优", "occurred_at": "2026-05-06T15:00:00+08:00", "entities": ["林啸"] },
    { "episode_id": "ep4", "theme": "BLE 复盘", "occurred_at": "2026-05-08T10:00:00+08:00", "entities": ["林啸"] }
  ],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "repeat_signals": [
    {
      "pattern_kind": "topic_recurrence",
      "description": "BLE 主题最近一周出现 4 次，全部和林啸",
      "confidence": 0.85,
      "evidence_episode_ids": ["ep1", "ep2", "ep3", "ep4"]
    },
    {
      "pattern_kind": "entity_recurrence",
      "description": "和林啸的协作主线是 BLE 优化（4 次）",
      "confidence": 0.78,
      "evidence_episode_ids": ["ep1", "ep2", "ep3", "ep4"]
    }
  ],
  "habit_candidates": [],
  "schema_version": 1
}
```

**为什么报两个 pattern**：BLE 主题反复（topic_recurrence）+ 都和林啸（entity_recurrence），都满足 ≥ 3 evidence。

---

### Example 4：信号不足 — 返回空

**Input**:
```json
{
  "query": "我有什么习惯",
  "candidate_signals": [
    { "episode_id": "ep1", "theme": "看电影", "occurred_at": "2026-05-01T20:00:00+08:00", "entities": [] },
    { "episode_id": "ep2", "theme": "看电影", "occurred_at": "2026-05-05T20:00:00+08:00", "entities": [] }
  ],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "repeat_signals": [],
  "habit_candidates": [],
  "schema_version": 1
}
```

**为什么空**：只 2 次"看电影"，不到 3 evidence 阈值。

---

### Example 5：散乱信号 — 报但置信度低

**Input**:
```json
{
  "query": "我和敦敏的接触模式",
  "candidate_signals": [
    { "episode_id": "ep1", "theme": "和敦敏聊融资", "occurred_at": "2026-04-09T10:30:00+08:00", "entities": ["敦敏"] },
    { "episode_id": "ep2", "theme": "和敦敏餐叙", "occurred_at": "2026-04-21T19:00:00+08:00", "entities": ["敦敏"] },
    { "episode_id": "ep3", "theme": "和敦敏 follow-up", "occurred_at": "2026-05-07T11:00:00+08:00", "entities": ["敦敏"] }
  ],
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "repeat_signals": [
    {
      "pattern_kind": "entity_recurrence",
      "description": "和敦敏的接触每月 1 次左右，都是融资相关",
      "confidence": 0.55,
      "evidence_episode_ids": ["ep1", "ep2", "ep3"]
    }
  ],
  "habit_candidates": [],
  "schema_version": 1
}
```

**为什么 confidence 0.55**：刚到 3 evidence 阈值，时间间隔（12 / 16 天）不够规律 → 弱模式。

## 边界

- candidate_signals 长度 < 3 → 全部返回空数组
- 主题词太泛（"开会" / "见面"）→ 不报（confidence 会低于 0.4，过滤）
- habit_candidate **不**自动写入 user_profile（由 Agent finalize 时让用户确认）
- 触及硬黑名单（健康用药 / 性向 / 政治 / 宗教 / 财务）→ 不报为 habit_candidate（即使时间规律强）

## 版本历史

- v1 (2026-05-02): 初版骨架
- **v2 (2026-05-08)**: 完整 system prompt + 5 few-shot

## Eval

见 `eval/pattern-reasoning-fixtures.md`
