---
name: agent-dialogue-writeback
version: 2
owner: 明明
status: draft
last-updated: 2026-05-08
backend-service: agent-orchestrator-service
backend-env-flag: ENABLE_MEMORY_TREE_AGENT_DIALOGUE_WRITEBACK, AGENT_WRITEBACK_MEMORY_ENABLED
related-issue: MON-7
---

# agent-orchestrator · Dialogue Writeback

## 用途
Agent 跟用户聊完一回合后，决定哪些对话内容值得写回 memory（"主动学习"）。不能照抄对话原文。

## 输入契约

```typescript
{
  task_id: string,
  dialogue_turns: Array<{
    turn_id: string,
    role: "user" | "agent",
    content: string,
    created_at: string
  }>,
  retrieved_memory_excerpt: string,    // 这次对话用了哪些 memory，用来去重
  user_profile_excerpt: string,        // 当前 user_profile 摘要，用来判断是否首次表达
  user_timezone: string,
}
```

## 输出契约

```typescript
{
  writeback_candidates: Array<{
    target_layer: "raw" | "description" | "user_profile_update",
    text: string,
    evidence_turn_ids: string[],
    importance: number,                 // 0-1
    rationale: string                   // ≤ 30 字解释为什么值得写回
  }>,
  schema_version: 1
}
```

## System Prompt

> 你判断这轮对话有没有值得写回 memory 的内容。
>
> **三个写回层**
> - `raw` — 用户讲了一段较长的叙事 / 背景故事，原话本身有价值
> - `description` — 客观事实，压成两段结构（≤ 30 字摘要 + 详细）。例："我下周去深圳" → "5/14 出差深圳"
> - `user_profile_update` — 首次表达的偏好 / 关系 / 目标 / 习惯
>
> **不写回**
> - 闲聊、寒暄、口头禅
> - 重复确认（"嗯嗯"、"好的"、"知道了"）
> - 已在 retrieved_memory_excerpt 里的内容（去重）
> - Agent 自己说的话 — 除非用户明确认可（"对"、"正是"、"没错"）才写回为 description
>
> **importance 评分（0-1）**
> 信息密度 ×0.6 + 用户主动表达强度 ×0.4。"我决定 / 我喜欢 / 我不要" → 高。Agent 提问后用户附和 → 中。寒暄 → 0~0.1。
>
> **user_profile_update 单 evidence 即可**
> dialogue 是用户主动表达的最强信号，不需要等 ≥ 2 evidence 阈值（跟 user-profile-extractor 不同）。但要排除硬黑名单。
>
> **硬黑名单 — 不上 user_profile（写到 raw 仍 OK）**
> 健康病史/用药/心理诊断、性取向/性偏好、政治倾向、宗教信仰、财务收入/资产。
> 用户在对话里说"我最近焦虑" → target_layer="raw"（保留原话给 Agent 后续上下文），不写 user_profile。
>
> **rationale ≤ 30 字**
> 解释这条为什么值得写回。例："首次表达 LLM 偏好"、"客观时间安排，未来引用"。

## 决策规则

- 一轮对话内多个候选 → 都返回（数组多项）
- 全部不值得 → 返回空数组
- target_layer="description" 时 text 走两段结构（≤ 30 字摘要 + \n\n + 详细），跟 MON-5 一致
- target_layer="raw" 时 text 保留接近原话（最多去 Agent 引导句）
- target_layer="user_profile_update" 时 text 用第二人称（"你最近..."），跟 MON-5 user-profile-extractor 一致

## Few-shot

### Example 1：用户首次表达偏好 → user_profile_update

**Input**:
```json
{
  "dialogue_turns": [
    { "turn_id": "t1", "role": "agent", "content": "你想用 GPT-4 还是 Claude？" },
    { "turn_id": "t2", "role": "user", "content": "Claude 吧，我决定项目里全用 Anthropic 不用 OpenAI 了" }
  ],
  "user_profile_excerpt": "preferences: {} (no llm_provider yet)"
}
```

**Output**:
```json
{
  "writeback_candidates": [
    {
      "target_layer": "user_profile_update",
      "text": "你决定项目里 LLM 全部从 OpenAI 改用 Anthropic\n\nuser switched llm_provider preference to Anthropic; explicit decision in dialogue 2026-05-08",
      "evidence_turn_ids": ["t2"],
      "importance": 0.88,
      "rationale": "首次表达 LLM 偏好 + 强决策语气"
    }
  ],
  "schema_version": 1
}
```

**为什么这样**：
- "我决定" + 项目级决策 → 高 importance
- user_profile_excerpt 显示首次表达 → user_profile_update（不是 description）
- 单 evidence 即可（dialogue 信号强）
- text 用第二人称，两段结构

---

### Example 2：客观事实 → description

**Input**:
```json
{
  "dialogue_turns": [
    { "turn_id": "t1", "role": "user", "content": "我下周三去深圳出差，周五回来" },
    { "turn_id": "t2", "role": "agent", "content": "好的，我帮你看下飞机票？" }
  ],
  "user_profile_excerpt": "habits: {} (no travel pattern yet)"
}
```

**Output**:
```json
{
  "writeback_candidates": [
    {
      "target_layer": "description",
      "text": "5/14-5/16 深圳出差\n\n明明下周三（5/14）去深圳出差，周五（5/16）回来。",
      "evidence_turn_ids": ["t1"],
      "importance": 0.65,
      "rationale": "具体时间安排，未来 Agent 排会议时要规避"
    }
  ],
  "schema_version": 1
}
```

**为什么 description 不是 user_profile_update**：
- "下周深圳出差" 是一次性事件，不是模式（不算 habits）
- 给 Agent 后续在排会议 / 安排提醒时用 → description 层够用

---

### Example 3：闲聊 / 重复确认 → 空数组

**Input**:
```json
{
  "dialogue_turns": [
    { "turn_id": "t1", "role": "user", "content": "嗯嗯" },
    { "turn_id": "t2", "role": "agent", "content": "好的明白了" },
    { "turn_id": "t3", "role": "user", "content": "对，就这样吧" }
  ]
}
```

**Output**:
```json
{
  "writeback_candidates": [],
  "schema_version": 1
}
```

**为什么空**：纯确认 / 寒暄，没有信息含量。

---

### Example 4：用户认可 Agent 提议 → 写回 description

**Input**:
```json
{
  "dialogue_turns": [
    { "turn_id": "t1", "role": "user", "content": "下次和敦敏聊融资我重点应该说啥" },
    { "turn_id": "t2", "role": "agent", "content": "建议突出双麦 SNR 数据 + GTM 节奏。这两点你之前回答得最好。" },
    { "turn_id": "t3", "role": "user", "content": "对，正是这样。我也觉得双麦 + GTM 是核心" }
  ]
}
```

**Output**:
```json
{
  "writeback_candidates": [
    {
      "target_layer": "description",
      "text": "下次融资沟通核心：双麦 SNR + GTM\n\n明明认同 Agent 提议，下次和敦敏聊融资重点突出双麦 SNR 数据 + GTM 节奏，这两点是核心论证。",
      "evidence_turn_ids": ["t2", "t3"],
      "importance": 0.75,
      "rationale": "Agent 提议+用户明确认可，可作为未来对话引用"
    }
  ],
  "schema_version": 1
}
```

**为什么这样**：
- Agent 自己说的（t2）通常不写回，但用户在 t3 明确说"对，正是这样"+"我也觉得" → 触发"用户认可"路径，写回为 description
- evidence 包含 Agent turn 和用户认可 turn 两个

---

### Example 5：⚠️ 敏感信息 → 写到 raw 不上 user_profile

**Input**:
```json
{
  "dialogue_turns": [
    { "turn_id": "t1", "role": "user", "content": "我最近在吃 SSRI 调焦虑情绪，工作上你帮我留意下别给我塞太满的会" },
    { "turn_id": "t2", "role": "agent", "content": "明白，我会帮你看日程密度，避免连续 3 个会以上。" }
  ],
  "user_profile_excerpt": "..."
}
```

**Output**:
```json
{
  "writeback_candidates": [
    {
      "target_layer": "raw",
      "text": "我最近在吃 SSRI 调焦虑情绪，工作上你帮我留意下别给我塞太满的会",
      "evidence_turn_ids": ["t1"],
      "importance": 0.7,
      "rationale": "敏感信息（健康/用药），写 raw 保留对话上下文，不上 user_profile"
    },
    {
      "target_layer": "user_profile_update",
      "text": "你不希望日程被塞太满，连续会议数有压力\n\nuser prefers low schedule density; avoid 3+ consecutive meetings",
      "evidence_turn_ids": ["t1"],
      "importance": 0.65,
      "rationale": "可观察的工作偏好（不涉敏感），独立写"
    }
  ],
  "schema_version": 1
}
```

**为什么拆 2 条**：
- 健康/用药内容 → raw（保留原话给 Agent 后续上下文，但**不上 user_profile**）
- 衍生的"日程密度偏好" → 这是工作偏好（不是健康），可以独立写到 user_profile
- 关键拆分点：**敏感事实保留在 raw，可观察的非敏感偏好独立 update profile**

## 边界

- dialogue_turns 长度 0 → 返回空数组
- 全部 turn 都是 Agent 自己说的（无用户认可）→ 空数组
- retrieved_memory_excerpt 已包含的内容 → 不重复写回
- user 提到敏感黑名单内容 → target_layer 强制 "raw"，不允许 "user_profile_update"

## 版本历史

- v1 (2026-05-02): 初版骨架
- **v2 (2026-05-08)**: 完整 system prompt + 5 few-shot
  - 单 evidence 即可写 user_profile（dialogue 场景信号强）
  - Agent 自己的话需用户明确认可才写
  - 硬黑名单 5 类只写 raw 不上 profile（跟 MON-5 user-profile-extractor 对齐）

## Eval

见 `eval/dialogue-writeback-fixtures.md`（待 MON-23 建）
