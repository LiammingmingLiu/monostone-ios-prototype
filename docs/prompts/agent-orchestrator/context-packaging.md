---
name: agent-context-packaging
version: 2
owner: 明明
status: draft
last-updated: 2026-05-08
backend-service: agent-orchestrator-service
backend-env-flag: AGENT_CONTEXT_PACKAGING_*
related-issue: MON-8
---

# agent-orchestrator · Context Packaging

## 用途
Memory fetch pipeline 第 3 步。把检索到的证据 → 去重 → 截断 → 分桶 → 排序 → 打 importance 标签 → 生成 summary candidates。最终给到 finalize / planner 用。

## 输入契约

```typescript
{
  query: string,
  retrieved_nodes: Array<{
    id: string,
    layer: "raw" | "description" | "episode" | "project" | "scene" | "user_profile",
    text: string,
    importance: number,
    recency: number,         // 0-1，时间衰减
    entities: string[]
  }>,
  budget: { max_tokens: number },
  user_timezone: string,
}
```

## 输出契约

```typescript
{
  buckets: {
    primary: Array<{
      node_id: string,
      snippet: string,                                  // 已截断/精简
      importance_label: "critical" | "supporting" | "background"
    }>,
    timeline: Array<{ node_id, snippet }> | null,       // 时间相关证据，给 timeline-reasoner
    pattern: Array<{ node_id, snippet }> | null         // 重复/模式证据，给 pattern-reasoner
  },
  summary_candidates: string[],         // ≤ 3 条 abstract summary，给 finalize 选
  total_tokens: number,
  truncated: boolean,                   // 是否因 budget 截断
  schema_version: 1
}
```

## System Prompt

> 你把检索到的 memory nodes 打包成 Agent 能用的 context。
>
> **三步处理**
> 1. **去重**：embedding 相似度 > 0.92 视为重复，保留 importance 高的
> 2. **截断**：按 budget 截。先丢 background → supporting → 保 critical
> 3. **分桶 + 排序**：
>    - `primary` 主桶（占 60% budget）：跟 query 直接相关的证据
>    - `timeline`（占 25%）：跟时间相关的事件（给 timeline-reasoner）
>    - `pattern`（占 15%）：可能成模式的重复事件（给 pattern-reasoner）
>    - timeline / pattern 没有相关证据时返回 null
>
> **importance_label 三档**
> - `critical` — 直接回答 query 的核心证据。Agent 必看。
> - `supporting` — 提供上下文/背景。Agent 应看。
> - `background` — 弱相关，省 token 时优先丢。
>
> 映射：原 importance ≥ 0.7 → critical / 0.4-0.7 → supporting / < 0.4 → background。但 query 高度相关的可上调一档。
>
> **summary_candidates**
> 生成 ≤ 3 条候选 summary，每条 ≤ 100 字。给后续 finalize 选最合适的作为 Agent 答复的开头。覆盖不同 angle（事实复述 / 反思总结 / 直接回答）。
>
> **snippet**
> 从原 node text 里截关键句子，≤ 80 字。description 节点用 text 第一段（已是 ≤ 30 字摘要），episode 用 search_summary 段。

## 决策规则

- 去重阈值 embedding 0.92（接近重复但不完全一样的保留两条）
- truncate 顺序：background → supporting → critical（保 critical 不丢）
- query 含时间词 → timeline 桶必填
- query 含"我每次/总是/习惯" → pattern 桶必填
- 没相关证据的桶返回 null（不要强行填）

## Few-shot

### Example 1：factual query 标准打包

**Input**:
```json
{
  "query": "上次和敦敏聊融资定的估值",
  "retrieved_nodes": [
    { "id": "n1", "layer": "episode", "text": "和敦敏的 Series A 跟进会\n\n会议确定 Series A 估值 6000 万。林啸提议双麦 SNR 数据放主叙事。", "importance": 0.92, "recency": 0.95, "entities": ["敦敏", "Series A"] },
    { "id": "n2", "layer": "description", "text": "敦敏 Linear 合伙人\n\n敦敏是 Linear Capital 合伙人，本轮领投意向", "importance": 0.7, "recency": 0.9, "entities": ["敦敏"] },
    { "id": "n3", "layer": "description", "text": "马俊 marketing 建议\n\n马俊建议把 freestyle recording 作为主叙事", "importance": 0.6, "recency": 0.9, "entities": ["马俊"] }
  ],
  "budget": { "max_tokens": 2000 }
}
```

**Output**:
```json
{
  "buckets": {
    "primary": [
      { "node_id": "n1", "snippet": "Series A 估值 6000 万，敦敏会议上确定", "importance_label": "critical" },
      { "node_id": "n2", "snippet": "敦敏是 Linear Capital 合伙人，本轮领投意向", "importance_label": "supporting" },
      { "node_id": "n3", "snippet": "马俊建议 freestyle recording 主叙事", "importance_label": "background" }
    ],
    "timeline": null,
    "pattern": null
  },
  "summary_candidates": [
    "Series A 估值在和敦敏的会议上确定为 6000 万",
    "Linear Capital 领投，敦敏主导，估值 6000 万",
    "上次会议确认了 6000 万估值，重点用双麦 SNR 数据论证"
  ],
  "total_tokens": 280,
  "truncated": false,
  "schema_version": 1
}
```

---

### Example 2：summary query + timeline 桶

**Input**:
```json
{
  "query": "这周做了什么",
  "retrieved_nodes": [
    { "id": "ep1", "layer": "episode", "text": "5/3 续航讨论\n\n硬件 + 招聘 + 设计", "importance": 0.85, "recency": 1, "entities": ["林啸"] },
    { "id": "ep2", "layer": "episode", "text": "5/4 周例会\n\n续航测试结果确认", "importance": 0.82, "recency": 1, "entities": ["林啸"] },
    { "id": "ep3", "layer": "episode", "text": "5/2 BLE 协议讨论\n\n心率上报频率优化方案", "importance": 0.78, "recency": 0.9, "entities": ["林啸"] },
    { "id": "ep4", "layer": "episode", "text": "5/3 心情快照灵感\n\n用戒指按一下记录此刻感觉", "importance": 0.75, "recency": 1, "entities": ["产品"] }
  ],
  "budget": { "max_tokens": 2000 }
}
```

**Output**:
```json
{
  "buckets": {
    "primary": [
      { "node_id": "ep1", "snippet": "5/3 续航讨论 — 硬件 + 招聘 + 设计", "importance_label": "critical" },
      { "node_id": "ep2", "snippet": "5/4 周例会 — 续航测试结果确认", "importance_label": "critical" },
      { "node_id": "ep4", "snippet": "5/3 心情快照灵感 — v2 形态探索", "importance_label": "supporting" }
    ],
    "timeline": [
      { "node_id": "ep1", "snippet": "5/3 续航讨论" },
      { "node_id": "ep2", "snippet": "5/4 周例会" },
      { "node_id": "ep3", "snippet": "5/2 BLE 协议讨论" },
      { "node_id": "ep4", "snippet": "5/3 心情快照灵感" }
    ],
    "pattern": null
  },
  "summary_candidates": [
    "本周主线是 Ring v1 续航优化（5/2-5/4 三天连续推进），同时 5/3 萌生 v2 心情快照灵感",
    "本周做了 4 件事：BLE 协议讨论、续航讨论、周例会、心情快照灵感",
    "Ring v1 硬件迭代是主旋律，林啸协作密度高，1 个产品灵感"
  ],
  "total_tokens": 320,
  "truncated": false,
  "schema_version": 1
}
```

**为什么 timeline 桶有内容**：query 是"这周"含时间词，timeline-reasoner 之后会用这桶分析时间密度。

---

### Example 3：broad query + pattern 桶

**Input**:
```json
{
  "query": "我最近是不是太累了",
  "retrieved_nodes": [
    { "id": "ep1", "layer": "episode", "text": "5/4 周例会", "importance": 0.7, "recency": 1, "entities": [] },
    { "id": "ep2", "layer": "episode", "text": "4/27 周例会", "importance": 0.7, "recency": 0.7, "entities": [] },
    { "id": "ep3", "layer": "episode", "text": "4/20 周例会", "importance": 0.7, "recency": 0.4, "entities": [] },
    { "id": "ep4", "layer": "episode", "text": "5/3 晨跑第 4 天连续", "importance": 0.6, "recency": 1, "entities": ["健康"] }
  ],
  "budget": { "max_tokens": 2000 }
}
```

**Output**:
```json
{
  "buckets": {
    "primary": [
      { "node_id": "ep4", "snippet": "5/3 起每天晨跑 6:30，连续 4 天", "importance_label": "supporting" }
    ],
    "timeline": [
      { "node_id": "ep1", "snippet": "5/4 周例会" },
      { "node_id": "ep2", "snippet": "4/27 周例会" },
      { "node_id": "ep3", "snippet": "4/20 周例会" }
    ],
    "pattern": [
      { "node_id": "ep1", "snippet": "5/4 周例会" },
      { "node_id": "ep2", "snippet": "4/27 周例会" },
      { "node_id": "ep3", "snippet": "4/20 周例会" }
    ]
  },
  "summary_candidates": [
    "周例会是稳定模式，加上每天晨跑 4 天连续，可见生活节奏密但有规律",
    "最近周节奏紧凑：每周一例会 + 每天晨跑",
    "不是单纯累，是密度高 — 工作 + 健康两条线都在运转"
  ],
  "total_tokens": 340,
  "truncated": false,
  "schema_version": 1
}
```

---

### Example 4：budget 紧需要截断

**Input**:
```json
{
  "query": "Ring v1 项目最近怎么样",
  "retrieved_nodes": [
    { "id": "p1", "layer": "project", "text": "Ring v1 硬件\n\n硬件 MVP 5 月发布", "importance": 0.9, "recency": 1, "entities": [] },
    { "id": "ep1", "layer": "episode", "text": "5/3 续航讨论", "importance": 0.85, "recency": 1, "entities": [] },
    { "id": "ep2", "layer": "episode", "text": "5/2 BLE 协议", "importance": 0.78, "recency": 0.9, "entities": [] },
    { "id": "ep3", "layer": "episode", "text": "5/1 电池选型", "importance": 0.65, "recency": 0.8, "entities": [] },
    { "id": "ep4", "layer": "episode", "text": "4/30 设计 review", "importance": 0.5, "recency": 0.7, "entities": [] },
    { "id": "ep5", "layer": "description", "text": "硬件团队 daily standup", "importance": 0.3, "recency": 0.5, "entities": [] }
  ],
  "budget": { "max_tokens": 500 }
}
```

**Output**:
```json
{
  "buckets": {
    "primary": [
      { "node_id": "p1", "snippet": "Ring v1 硬件 MVP 5 月发布", "importance_label": "critical" },
      { "node_id": "ep1", "snippet": "5/3 续航讨论", "importance_label": "critical" },
      { "node_id": "ep2", "snippet": "5/2 BLE 协议", "importance_label": "supporting" },
      { "node_id": "ep3", "snippet": "5/1 电池选型", "importance_label": "supporting" }
    ],
    "timeline": null,
    "pattern": null
  },
  "summary_candidates": [
    "Ring v1 5 月发布在即，最近聚焦续航 + BLE 协议优化",
    "Ring v1 项目主线：续航 → BLE → 电池选型 三连推进"
  ],
  "total_tokens": 480,
  "truncated": true,
  "schema_version": 1
}
```

**为什么 truncated=true**：budget 500 token 紧，丢了 ep4 (设计 review, importance 0.5) 和 ep5 (daily standup, importance 0.3)，按 background → supporting → critical 顺序丢。

---

### Example 5：去重

**Input**:
```json
{
  "query": "和敦敏聊估值",
  "retrieved_nodes": [
    { "id": "ep1", "layer": "episode", "text": "5/8 和敦敏 Series A 跟进\n\n确定估值 6000 万", "importance": 0.92, "recency": 1, "entities": ["敦敏"] },
    { "id": "d1", "layer": "description", "text": "Series A 估值 6000 万\n\n5/8 和敦敏会议上定下", "importance": 0.85, "recency": 1, "entities": ["敦敏"] },
    { "id": "d2", "layer": "description", "text": "估值 6000 万 决定\n\n敦敏 Linear 5/8 会议确认", "importance": 0.83, "recency": 1, "entities": ["敦敏"] }
  ],
  "budget": { "max_tokens": 2000 }
}
```

**Output**:
```json
{
  "buckets": {
    "primary": [
      { "node_id": "ep1", "snippet": "5/8 和敦敏会议确定 Series A 估值 6000 万", "importance_label": "critical" }
    ],
    "timeline": null,
    "pattern": null
  },
  "summary_candidates": [
    "5/8 和敦敏会议确定 Series A 估值 6000 万"
  ],
  "total_tokens": 80,
  "truncated": false,
  "schema_version": 1
}
```

**为什么只剩 1 条**：3 条 node 内容高度重复（embedding 相似度 > 0.92），保留 importance 最高的 ep1，d1/d2 去重丢弃。

## 边界

- retrieved_nodes 为空 → buckets 三个都返回空数组 / null，summary_candidates 空数组
- budget 极小（< 100）→ 只保 1 条 critical
- 全部 importance < 0.4 → 仍保留最高的 1-2 条作 supporting

## 版本历史

- v1 (2026-05-02): 初版骨架
- **v2 (2026-05-08)**: 完整 system prompt + 5 few-shot

## Eval

见 `eval/context-packaging-fixtures.md`
