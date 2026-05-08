---
name: agent-retrieval-policy
version: 2
owner: 明明
status: draft
last-updated: 2026-05-08
backend-service: agent-orchestrator-service
backend-env-flag: ENABLE_AGENT_INTELLIGENT_RETRIEVAL_POLICY_V25, AGENT_INTELLIGENT_RETRIEVAL_POLICY_MODE
related-issue: MON-8
---

# agent-orchestrator · Intelligent Retrieval Policy V25

## 用途
Memory fetch pipeline 第 2 步。决定从 memory tree 哪一层（scene / project / episode / description / raw）开始检索，分别用什么 filter，要不要展开到 raw 层。

## 输入契约

```typescript
{
  query: string,                             // 来自 query-router 改写
  query_kind: "factual" | "summary" | "broad",
  user_recent_active_projects: string[],     // 最近活跃的 project_ids
  budget: { max_nodes: number, max_tokens: number },
  user_timezone: string,
}
```

## 输出契约

```typescript
{
  retrieval_plan: Array<{
    layer: "scene" | "project" | "episode" | "description" | "raw",
    filter: {
      entity_ids?: string[],
      time_range?: [string, string],         // ISO8601
      project_ids?: string[],
      keywords?: string[]
    },
    limit: number
  }>,
  expand_to_raw: boolean,                    // 找到候选后是否下钻到 raw 层
  rationale: string,                         // ≤ 60 字解释为什么这么取
  schema_version: 1
}
```

## System Prompt

> 你制定 memory tree 的检索计划。从 user 的 query 推断该查哪几层 + 用什么 filter。
>
> **三种 query_kind 的默认策略**
>
> - `factual` → 精确层为主：episode + description（实体名作 filter）。limit 各 5-10。expand_to_raw=false（factual 不需要原话）
> - `summary` → 聚合层为主：project + scene（time_range 作 filter）。limit 各 3-5。expand_to_raw=false（summary 用结构化即可）
> - `broad` → 多层混合：scene + project + episode 各取一些。expand_to_raw=true（broad 探索可能要原话）
>
> **filter 推断**
> - query 里出现人名 → entity_ids
> - query 里出现时间锚（"上周" / "5/3"）→ time_range（基于 user_timezone 解析）
> - query 里出现 project 名 → project_ids
> - 其他重要词 → keywords
>
> **budget 约束**
> 总 limit 之和 ≤ budget.max_nodes（默认 30）。优先低成本（聚合层 token 少）。
>
> **rationale**
> ≤ 60 字解释这次检索的整体策略，给后续 packaging 排序用。

## 决策规则

- query 提到具体事件名 → 优先 episode 层
- query 是 "X 项目最近怎么样" → 优先 project 层 + 该 project 的最近 episode
- factual + 无任何 filter（"我最重要的决定是什么"）→ 退化为 broad 处理
- expand_to_raw 只在 broad 或 query_kind=factual 但需要原话引用时打开

## Few-shot

### Example 1：factual — 找一个决策

**Input**:
```json
{
  "query": "上次和敦敏聊融资定的估值",
  "query_kind": "factual",
  "user_recent_active_projects": ["proj_funding", "proj_ring_v1"],
  "budget": { "max_nodes": 30, "max_tokens": 8000 }
}
```

**Output**:
```json
{
  "retrieval_plan": [
    {
      "layer": "episode",
      "filter": { "entity_ids": ["敦敏"], "keywords": ["融资", "估值"] },
      "limit": 8
    },
    {
      "layer": "description",
      "filter": { "entity_ids": ["敦敏"], "keywords": ["融资", "估值"] },
      "limit": 10
    }
  ],
  "expand_to_raw": false,
  "rationale": "factual 找具体估值数字，episode + description 精确层够用",
  "schema_version": 1
}
```

---

### Example 2：summary — 周报式查询

**Input**:
```json
{
  "query": "这周做了什么",
  "query_kind": "summary",
  "user_recent_active_projects": ["proj_ring_v1", "proj_app"],
  "budget": { "max_nodes": 30, "max_tokens": 8000 },
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "retrieval_plan": [
    {
      "layer": "project",
      "filter": { "project_ids": ["proj_ring_v1", "proj_app"] },
      "limit": 3
    },
    {
      "layer": "episode",
      "filter": { "time_range": ["2026-05-04T00:00:00+08:00", "2026-05-08T23:59:59+08:00"], "project_ids": ["proj_ring_v1", "proj_app"] },
      "limit": 15
    }
  ],
  "expand_to_raw": false,
  "rationale": "summary 一周时间窗，用 project 给框架 + episode 列具体事件",
  "schema_version": 1
}
```

---

### Example 3：broad — 自我反思

**Input**:
```json
{
  "query": "我最近的工作状态怎么样",
  "query_kind": "broad",
  "user_recent_active_projects": ["proj_ring_v1", "proj_app", "proj_growth"],
  "budget": { "max_nodes": 30, "max_tokens": 8000 }
}
```

**Output**:
```json
{
  "retrieval_plan": [
    {
      "layer": "scene",
      "filter": {},
      "limit": 2
    },
    {
      "layer": "project",
      "filter": { "project_ids": ["proj_ring_v1", "proj_app", "proj_growth"] },
      "limit": 5
    },
    {
      "layer": "episode",
      "filter": { "time_range": ["2026-04-25T00:00:00+08:00", "2026-05-08T23:59:59+08:00"] },
      "limit": 12
    }
  ],
  "expand_to_raw": true,
  "rationale": "broad 探索类，多层混合 + 展开 raw 让用户能看到原话证据",
  "schema_version": 1
}
```

---

### Example 4：人名 + 主题精确查询

**Input**:
```json
{
  "query": "林啸 BLE 续航讨论",
  "query_kind": "factual",
  "user_recent_active_projects": ["proj_ring_v1"],
  "budget": { "max_nodes": 30, "max_tokens": 8000 }
}
```

**Output**:
```json
{
  "retrieval_plan": [
    {
      "layer": "episode",
      "filter": { "entity_ids": ["林啸"], "keywords": ["BLE", "续航"], "project_ids": ["proj_ring_v1"] },
      "limit": 5
    },
    {
      "layer": "description",
      "filter": { "entity_ids": ["林啸"], "keywords": ["BLE", "续航"] },
      "limit": 10
    }
  ],
  "expand_to_raw": false,
  "rationale": "明确人名+主题+项目，三维度精确检索",
  "schema_version": 1
}
```

---

### Example 5：summary 跨月查询

**Input**:
```json
{
  "query": "5 月在 Ring v1 项目上的进展",
  "query_kind": "summary",
  "user_recent_active_projects": ["proj_ring_v1"],
  "budget": { "max_nodes": 30, "max_tokens": 8000 },
  "user_timezone": "Asia/Shanghai"
}
```

**Output**:
```json
{
  "retrieval_plan": [
    {
      "layer": "project",
      "filter": { "project_ids": ["proj_ring_v1"] },
      "limit": 1
    },
    {
      "layer": "episode",
      "filter": { "project_ids": ["proj_ring_v1"], "time_range": ["2026-05-01T00:00:00+08:00", "2026-05-31T23:59:59+08:00"] },
      "limit": 25
    }
  ],
  "expand_to_raw": false,
  "rationale": "5 月时间窗 + 单项目，project meta + episode 时间序",
  "schema_version": 1
}
```

## 边界

- query 含模糊指代但 query-router 没改写 → 退化用 keywords 模糊匹配
- budget.max_nodes 太小（< 10）→ 砍 limit，优先 episode 层
- 无任何 filter 可推断（query 太空）→ 默认按时间倒序拉最近 20 episode

## 版本历史

- v1 (2026-05-02): 初版骨架
- **v2 (2026-05-08)**: 完整 system prompt + 5 few-shot

## Eval

见 `eval/retrieval-policy-fixtures.md`
