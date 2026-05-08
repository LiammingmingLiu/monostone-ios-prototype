---
name: agent-query-router
version: 2
owner: 明明
status: draft
last-updated: 2026-05-08
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_QUERY_ROUTER_*
related-issue: MON-8
---

# agent-orchestrator · Query Router

## 用途
Memory fetch pipeline 第 1 步。决定要不要查 memory，查什么类型，交给哪条 reasoner（timeline / pattern）。

## 输入契约

```typescript
{
  user_query: string,
  recent_dialogue: Array<{ role, content }>,    // 当前 task 最近 5-10 轮
  task_kind: "command_execute" | "brainstorm" | "clarification" | "dialogue",
  user_timezone: string,
}
```

## 输出契约

```typescript
{
  needs_memory: boolean,
  query_kind: "factual" | "summary" | "broad" | null,
  use_timeline_reasoner: boolean,
  use_pattern_reasoner: boolean,
  rewrite_query: string | null,        // 改写后的检索 query，null = 用原 query
  schema_version: 1
}
```

## System Prompt

> 你判断这个 user query 要不要查 memory，怎么查。这是 fetch pipeline 入口，影响后续所有步骤。
>
> **needs_memory 判断**
> - 简单聊天 / 寒暄 / 通用知识问题 → false
> - 涉及"我 / 你"（用户自己的事）/ 引用过往 / 用过的人名项目 → true
> - 不确定时偏 true（多查比少查好，后续 packaging 会截断）
>
> **query_kind 三类**
> - `factual` 找一个具体事实（"上次和敦敏聊了什么决策？"）→ 检索精确层
> - `summary` 要一段时间 / 主题的总结（"这周做了哪些事？"）→ 检索聚合层
> - `broad` 发散 / 探索性（"我最近的工作状态怎么样？"）→ 多层混合
> - needs_memory=false 时 query_kind=null
>
> **reasoner 触发**
> - 含时间锚（"上周 / 5 月 / 最近 / 这两天"）→ use_timeline_reasoner=true
> - 含重复模式词（"每次 / 我总是 / 我习惯"）→ use_pattern_reasoner=true
> - factual + 短查询通常两个都 false（直接 context-packaging）
>
> **rewrite_query**
> 如果原 query 含口语 / 代词 / 模糊指代（"那个会"、"上次的事"），从 recent_dialogue 推断具体所指，改写成更易检索的句子。否则 null。

## 决策规则

- 需要时间或人名锚点的查询 → 优先 `factual` + 不开 reasoner
- 跨周/月统计或主题汇总 → `summary` + 时间 reasoner
- 自我反思/探索类 → `broad` + 两个 reasoner 都开
- task_kind="command_execute" 时 → needs_memory=true（一定要查 user_profile + 相关历史）

## Few-shot

### Example 1：简单寒暄 — 不查 memory

**Input**:
```json
{
  "user_query": "你好",
  "recent_dialogue": [],
  "task_kind": "dialogue"
}
```

**Output**:
```json
{
  "needs_memory": false,
  "query_kind": null,
  "use_timeline_reasoner": false,
  "use_pattern_reasoner": false,
  "rewrite_query": null,
  "schema_version": 1
}
```

---

### Example 2：factual — 具体事实

**Input**:
```json
{
  "user_query": "上次和敦敏聊融资定的估值是多少？",
  "recent_dialogue": [],
  "task_kind": "dialogue"
}
```

**Output**:
```json
{
  "needs_memory": true,
  "query_kind": "factual",
  "use_timeline_reasoner": false,
  "use_pattern_reasoner": false,
  "rewrite_query": null,
  "schema_version": 1
}
```

**为什么**：明确人名 + 主题，找一个具体数字 → factual 精确检索，不需要时间 reasoner。

---

### Example 3：summary + timeline reasoner

**Input**:
```json
{
  "user_query": "这周我都做了什么？",
  "recent_dialogue": [],
  "task_kind": "brainstorm",
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "needs_memory": true,
  "query_kind": "summary",
  "use_timeline_reasoner": true,
  "use_pattern_reasoner": false,
  "rewrite_query": null,
  "schema_version": 1
}
```

---

### Example 4：broad + 两个 reasoner

**Input**:
```json
{
  "user_query": "我最近的工作状态怎么样？是不是太满了？",
  "recent_dialogue": [],
  "task_kind": "brainstorm"
}
```

**Output**:
```json
{
  "needs_memory": true,
  "query_kind": "broad",
  "use_timeline_reasoner": true,
  "use_pattern_reasoner": true,
  "rewrite_query": null,
  "schema_version": 1
}
```

**为什么**：含时间词 + "状态" 含模式词 + 自我反思类 → broad + 双 reasoner

---

### Example 5：rewrite_query 改写

**Input**:
```json
{
  "user_query": "那个事后来怎么样了？",
  "recent_dialogue": [
    { "role": "user", "content": "我让 Sean 出 v3 设计稿" },
    { "role": "agent", "content": "好的，他说下周一前出。" }
  ],
  "task_kind": "dialogue"
}
```

**Output**:
```json
{
  "needs_memory": true,
  "query_kind": "factual",
  "use_timeline_reasoner": false,
  "use_pattern_reasoner": false,
  "rewrite_query": "Sean v3 设计稿进展",
  "schema_version": 1
}
```

**为什么**：原 query "那个事" 模糊，从 recent_dialogue 推断指 v3 设计稿。

## 边界

- 空 query / 只有标点 → needs_memory=false
- task_kind="command_execute" 永远 needs_memory=true（要查偏好/历史决策）
- recent_dialogue 长 > 20 turns → 只看最近 10 turns 推断指代

## 版本历史

- v1 (2026-05-02): 初版骨架
- **v2 (2026-05-08)**: 完整 system prompt + 5 few-shot

## Eval

见 `eval/query-router-fixtures.md`
