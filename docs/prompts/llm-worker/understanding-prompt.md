---
name: llm-worker-understanding
version: 2
owner: 明明
status: draft
last-updated: 2026-05-07
backend-service: llm-worker
related-issue: MON-6
related-data-schema: docs/data/card-recording.md (RecordingUnderstanding)
---

# llm-worker · Understanding Prompt

## 用途
从 transcript 提取结构化理解：参与人、Action Items、决策、需要写入 memory 的节点候选、suggested_actions（仅 idea mode）。结果存为 understanding artifact，由 understanding-service 暴露给 iOS。

⚠️ **完整总结（full_summary）不在本 prompt 范围**。完整总结的 LLM prompt 已在 iOS App 内部实现（明明已 setup，输出 markdown），跟本 prompt 解耦。

## 输入契约

```typescript
{
  recording_id: string,
  recording_mode: "command" | "cal" | "idea" | "longRec",
  transcript: string,
  user_profile_excerpt: string | null,   // 已有用户画像中相关片段，给 owner 识别用
  user_timezone: string,
  user_locale: string,
  recorded_at: string,                    // ISO8601, 给时间解析锚点
}
```

## 输出契约（v2 — 不调后端 schema，仅加 `suggested_actions`）

```typescript
{
  participants: Array<{
    display_name: string,
    confidence: number          // 0-1
  }>,
  action_items: Array<{
    text: string,               // ≤ 30 字
    owner: string | null,       // 责任人 display name；不明 = null
    due_at: string | null,      // ISO8601；模糊时间 = null
    status: "pending"
  }>,
  decisions: Array<{
    text: string,
    rationale: string | null    // 决策依据，可选展开
  }>,
  memory_candidates: Array<{
    layer: "raw" | "description",
    text: string                // raw 保留原话；description 走两段结构
  }>,
  suggested_actions: Array<{    // 仅 recording_mode="idea" 时有，最多 3 条
    title: string,              // ≤ 20 字 "让 Agent 调研 X"
    why: string,                // ≤ 30 字 "因为你最近在思考 v2 形态"
    action_type: "command" | "todo"
  }> | null,
  schema_version: 2
}
```

⚠️ **零后端 code 改动**：`suggested_actions` 是新字段，但 backend 只是 pass-through。M1 §4.7.h 已 LOCKED。

## System Prompt

> 你从 transcript 提取结构化理解，给 RecordingDetailView / IdeaDetailView 用，也给后续 Reminders / Linear 同步用。
>
> **participants**
> 谁说话了。confidence 来自说话人识别质量。如果没识别出 → 空数组。
>
> **action_items — 严格模式**
> 抽取规则：必须有明确 owner 或 deadline 之一才抽。
> - "周五前给敦敏发 follow-up 邮件" ✅（有 owner=我 + deadline）
> - "林啸去测一下续航" ✅（有 owner）
> - "下周三 15:00 面试 iOS 候选人" ✅（有 deadline）
> - "应该 review 一下设计稿" ❌（没 owner 没 deadline，模糊）
> - "得测一下" ❌（同上）
>
> Decision vs Action Item：能执行的优先归 action（如"我决定下周发邮件"= action item），纯主张归 decision（如"我决定改用 Anthropic"）。
>
> **owner 解析**
> "我..." → 用户本人 display name（从 user_profile_excerpt 取，否则填 "我"）
> "林啸/Sean..." → 显式人名
> "我们/大家/团队" → null
> 无主语 → null
>
> **due_at 解析（基于 user_timezone + recorded_at）**
> 严格模式：只解析有具体时间锚点的。
> - "周五前/明天/5/12/今天下午 3 点" → ISO8601
> - "尽快/早点/抓紧" → null
> - "下周/这两天" → null（避免猜错）
>
> **decisions**
> 已经定的事 + 决策人。rationale 是决策依据（如果说出来了），没说就 null。
>
> **memory_candidates**
> 这条录音里值得入 memory 树的关键 raw / description 节点。LLM 选 ≤ 5 条信息密集的。最终去重由后端 memory-tree-worker 做。
>
> **suggested_actions（仅 idea mode）**
> 灵感卡 §E "接下来你可以..." 用。最多 3 条，每条建议用户能直接点出去的事：
> - 让 Agent 做一次主题调研 → action_type="command"
> - 加一个待办 → action_type="todo"
> - 写成 RFC / 文档 → action_type="command"
> title ≤ 20 字（动词开头），why ≤ 30 字（解释相关性）。
> longRec / command / cal mode → suggested_actions = null。

## 决策规则

- action_items 严格模式：宁缺勿滥（"应该 / 得 ..." 一律不抽）
- 模糊时间词不解析为 due_at（避免错的同步到 Reminders）
- sync_target 字段不在本 prompt 输出（由 iOS 端根据 owner 判定）
- decisions 跟 action_items 互斥（同一句话不重复抽）
- memory_candidates 不超过 5 条，避免后端处理压力

## Few-shot

### Example 1：长会议典型抽取

**Input** (recording_mode="longRec"):
```
（00:00）林啸：戒指续航这周测出来 38 小时。
（00:30）我：BLE 协议优化的事？
（00:42）林啸：我准备把心率上报频率从 1Hz 降到 0.2Hz，能省 18%。明天测试。
（02:10）我：另外 Sean 推了个 iOS 候选人，下周想聊一下。
（02:30）林啸：我能不能也参加？
（02:45）我：可以。周三下午 3 点。
（10:30）我：我决定 LLM 全用 Anthropic 不用 OpenAI 了。
（11:00）林啸：行。
```

**Output**:
```json
{
  "participants": [
    { "display_name": "林啸", "confidence": 0.95 },
    { "display_name": "明明", "confidence": 0.95 }
  ],
  "action_items": [
    {
      "text": "明天测试 BLE 心率 1Hz→0.2Hz 降频",
      "owner": "林啸",
      "due_at": "2026-05-08T00:00:00+08:00",
      "status": "pending"
    },
    {
      "text": "周三 15:00 面试 iOS 候选人",
      "owner": "明明",
      "due_at": "2026-05-13T15:00:00+08:00",
      "status": "pending"
    }
  ],
  "decisions": [
    {
      "text": "项目内 LLM 全部从 OpenAI 切换到 Anthropic",
      "rationale": null
    }
  ],
  "memory_candidates": [
    { "layer": "description", "text": "续航 38h vs 50h 目标差 12h\n\nBLE 心率 1Hz→0.2Hz 预计省 18%，明天测试" },
    { "layer": "description", "text": "iOS 候选人面试周三 15:00\n\nSean 推荐，林啸一同参加考察 SwiftUI" },
    { "layer": "description", "text": "切换 LLM 到 Anthropic\n\n项目内 LLM 全部从 OpenAI 改用 Anthropic" }
  ],
  "suggested_actions": null,
  "schema_version": 2
}
```

**为什么这样**：
- "林啸去测续航" → owner=林啸，"明天" → 解析 ISO8601
- "周三下午 3 点面试" → 隐含 owner=明明（用户本人），"周三 15:00" → 解析
- "我决定改用 Anthropic" → 是 decision 不是 action（没有具体执行步骤）
- 没有"我们想..."这种模糊抽出

---

### Example 2：模糊时间词不解析

**Input** (recording_mode="longRec"):
```
我：林啸抓紧时间把续航问题搞定，尽快。
林啸：行，下周一定搞完。
```

**Output**:
```json
{
  "participants": [],
  "action_items": [
    {
      "text": "把续航问题搞定",
      "owner": "林啸",
      "due_at": null,
      "status": "pending"
    }
  ],
  "decisions": [],
  "memory_candidates": [
    { "layer": "raw", "text": "我：林啸抓紧时间把续航问题搞定，尽快。\n林啸：行，下周一定搞完。" }
  ],
  "suggested_actions": null,
  "schema_version": 2
}
```

**为什么 due_at=null**：
- "抓紧/尽快/下周" 都是模糊时间词，不解析（避免错的同步到 Reminders）
- 仍抽出 action item，因为有明确 owner=林啸
- 用户在 Reminders 看到这条 task 时自己补 deadline

---

### Example 3：Decision vs Action 区分

**Input** (recording_mode="longRec"):
```
我：我决定下周给敦敏发 follow-up 邮件，重点说估值和 GTM。
我：另外，我们应该把 Series A 估值调到 6000 万。
```

**Output**:
```json
{
  "participants": [],
  "action_items": [
    {
      "text": "下周给敦敏发 follow-up 邮件 (估值+GTM)",
      "owner": "明明",
      "due_at": null,
      "status": "pending"
    }
  ],
  "decisions": [
    {
      "text": "Series A 估值调到 6000 万",
      "rationale": null
    }
  ],
  "memory_candidates": [
    { "layer": "description", "text": "下周给敦敏的 follow-up 邮件\n\n重点说估值和 GTM" },
    { "layer": "description", "text": "Series A 估值 6000 万决定\n\n明明决定的 Series A 估值定档" }
  ],
  "suggested_actions": null,
  "schema_version": 2
}
```

**为什么这样**：
- "我决定下周发邮件" → 能执行（有 owner+vague deadline）→ action item，due_at=null（"下周"模糊）
- "应该把估值调到 6000 万" → 主张性决策 → decision（虽然有"应该"语气）
- 区分原则：能列入 to-do list 的 = action；定调子的 = decision

---

### Example 4：纯 brainstorm 没有 action items

**Input** (recording_mode="longRec"):
```
我：今天想 v2 形态。我觉得不能再做戒指了，电池物理上限就在那。也许下一代要做项链或者夹子。
```

**Output**:
```json
{
  "participants": [],
  "action_items": [],
  "decisions": [],
  "memory_candidates": [
    { "layer": "description", "text": "v2 形态思考\n\n戒指物理电池上限受限，考虑过项链/夹子但牺牲随时随地。核心约束=无感佩戴。结论倾向更小更轻的戒指 + 充电更频繁。" }
  ],
  "suggested_actions": null,
  "schema_version": 2
}
```

**为什么 action_items 和 decisions 都空**：
- "也许下一代要做..." → 只是 brainstorm，没有"决定"也没有 action
- "我觉得不能再做戒指" → 纯主观判断，没有定调（用了"也许"），不是 decision
- 内容仍进 memory_candidates（这个 brainstorm 有产品价值）

---

### Example 5：灵感模式 — suggested_actions 抽取

**Input** (recording_mode="idea"):
```
刚才走路想到，戒指要不要做一个"心情快照"？就是用户主动按一下，记录这一刻的感觉。比每天的健康总结更有人味。
```

**Output**:
```json
{
  "participants": [],
  "action_items": [],
  "decisions": [],
  "memory_candidates": [
    { "layer": "description", "text": "心情快照灵感\n\n戒指增加心情快照按键，用户主动按一下记录此刻的感觉。比每天的健康汇总更有情绪温度。" }
  ],
  "suggested_actions": [
    {
      "title": "让 Agent 调研竞品的情绪记录",
      "why": "看 Oura/Whoop 怎么处理情绪信号",
      "action_type": "command"
    },
    {
      "title": "加一个 todo: 周二跟林啸讨论",
      "why": "硬件按键复用 vs 新增手势的可行性",
      "action_type": "todo"
    },
    {
      "title": "写成 v2 形态 RFC 草稿",
      "why": "你最近在思考 v2 整体形态",
      "action_type": "command"
    }
  ],
  "schema_version": 2
}
```

**为什么这样**：
- 灵感独白 → action_items / decisions 空（没有具体待办、没有定调）
- suggested_actions 3 条都是用户能直接点出去的事
- title 动词开头（"让 / 加 / 写"），why 解释相关性（接 user_profile）

---

### Example 6：command 模式 — 无 suggested_actions

**Input** (recording_mode="command"):
```
帮我下周三给敦敏发一封 follow-up 邮件，重点说估值和 GTM。
```

**Output**:
```json
{
  "participants": [],
  "action_items": [
    {
      "text": "下周三发 follow-up 邮件给敦敏 (估值+GTM)",
      "owner": "明明",
      "due_at": "2026-05-13T09:00:00+08:00",
      "status": "pending"
    }
  ],
  "decisions": [],
  "memory_candidates": [
    { "layer": "raw", "text": "帮我下周三给敦敏发一封 follow-up 邮件，重点说估值和 GTM。" }
  ],
  "suggested_actions": null,
  "schema_version": 2
}
```

**为什么 suggested_actions=null**：
- recording_mode="command" → 已经是 command，不需要再"建议下一步"
- 命令本身就是要 Agent 执行 → 由 command_draft（另一字段）处理

---

### Example 7：跨语言 / 含数字术语

**Input** (recording_mode="longRec"):
```
Sean: 我下周一前出 v4 设计稿。
我：好。Memory tab 信息密度比 v3 降 50%。
我：另外 freestyle recording 这个 marketing 概念林啸你 review 一下。
```

**Output**:
```json
{
  "participants": [
    { "display_name": "Sean", "confidence": 0.92 },
    { "display_name": "明明", "confidence": 0.95 },
    { "display_name": "林啸", "confidence": 0.90 }
  ],
  "action_items": [
    {
      "text": "下周一前出 Memory tab v4 设计稿",
      "owner": "Sean",
      "due_at": "2026-05-12T00:00:00+08:00",
      "status": "pending"
    },
    {
      "text": "review freestyle recording marketing 概念",
      "owner": "林啸",
      "due_at": null,
      "status": "pending"
    }
  ],
  "decisions": [
    {
      "text": "Memory tab v4 信息密度比 v3 降 50%",
      "rationale": null
    }
  ],
  "memory_candidates": [
    { "layer": "description", "text": "Memory tab v4 信息密度降 50%\n\nSean 5/12 前出 v4 设计稿，比 v3 信息密度减半" },
    { "layer": "description", "text": "freestyle recording marketing 概念\n\n林啸 review，硬件核心卖点的主叙事候选" }
  ],
  "suggested_actions": null,
  "schema_version": 2
}
```

**为什么这样**：
- 中英混合 + 术语保留（"freestyle recording" 不翻译）
- "下周一前" → 解析（5/7 是周三 → 下周一是 5/12）
- "review 一下" → 没有 deadline 但有 owner=林啸，仍抽
- "降 50%" → 是 decision（具体数字定调）

## 边界

- 空 transcript → 全部数组返回 `[]`，suggested_actions=null
- 没有任何 action items / decisions / participants → 仍输出 memory_candidates（有内容就要进 memory 树）
- recording_mode="cal" → action_items 通常空（cal_parse 字段处理时间事件，不在本 prompt）
- 严格模式宁缺勿滥：用户校正错过的 action item 由 v0.6 反馈机制（不在本 prompt 范围）

## 版本历史

- v1 (2026-05-02): 初版骨架（含 system prompt + Action Item / Decision 区分草稿）
- **v2 (2026-05-07)**:
  - 严格 action_items 提取（A1+B1+C1+D1）
  - 加 `suggested_actions` 字段（M1 §4.7 已 LOCKED）
  - 删 full_summary 相关讨论（App 内部 prompt 已实现）
  - 删 todo_parse / command_draft（其他 prompt / 字段处理）
  - 7 个 few-shot 覆盖：长录音 / 模糊时间 / Decision 区分 / 纯 brainstorm / 灵感 / command / 跨语言

## Eval

见 `eval/llm-worker-understanding-fixtures.md`（待 MON-23 建）
