---
name: memory-tree-description-to-episode
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=episode)
---

# memory-tree-worker · description → episode

## 用途
把若干 L1 description 聚合成 L2 episode：一段"事件"。聚合粒度由时间窗 / 主题相似度 / 实体重合决定。

## 输入契约
```typescript
{
  candidate_descriptions: Array<{ id, title, text, created_at, entities }>,
  existing_episodes_summary: Array<{ id, title, time_range, entity_overlap }>,
  user_timezone: string,
}
```

## 输出契约（v2 双视角）
```typescript
{
  episode_actions: Array<
    | {
        kind: "create",
        // display 字段（给用户）
        display_title: string,        // ≤ 12 字 "5/3 周例会"
        display_summary: string,      // ≤ 30 字 "硬件 + 招聘 + 设计"
        // search 字段（给 Agent）
        search_summary: string,       // ≤ 80 字，主题密集
        search_keywords: string[],    // 实体 + 主题
        // 结构
        description_ids: string[],
        time_range: string,
        entity_ids: string[],
        salience: number,
      }
    | { kind: "extend", episode_id: string, description_ids: string[] }
    | { kind: "skip", description_id: string, reason: string }
  >,
  schema_version: 2,
}
```

## System Prompt
> TODO（明明 v2）。draft：
>
> 你是 Memory 树的事件聚合器。把若干 description 聚合成 episode，每个 episode 有双视角标题：
>
> 【display_title】≤ 12 字
> - 时间锚 + 主类型，"5/3 周例会"、"5/2 BLE 讨论"、"4/30 设计 review"
> - 不要塞主题词，那些放 display_summary 里
>
> 【display_summary】≤ 30 字
> - 用户翻 Memory tab 时的"一行摘要"，温和、人感
> - "硬件 + 招聘 + 设计"、"心率上报频率优化"
>
> 【search_summary】≤ 80 字
> - 给 Agent 检索用，信息密集，包含所有人名/项目/数字/决策关键词
> - "续航 38h vs 50h 目标，林啸提议 BLE 心率 1Hz→0.2Hz 省 18%；面试 Sean 推荐的 iOS 候选人..."
>
> 【search_keywords】数组形式
> - 实体名 + 主题词 + 数字关键值（用于倒排索引）
>
> 【拆/合 决策】
> - 时间窗 ≤ 1 天硬上限，跨天延续 → kind=extend 已有 episode
> - 实体重合 ≥ 50% 且时间相邻 1 小时内 → 优先 extend
> - 主题切换明显（"硬件 → 个人家庭"）→ 拆 / skip
> - 单条 description 不归到任何 episode → kind=skip + reason

## 决策规则
- Episode 时长 ≤ 1 天硬上限（跨天用 extend）
- 实体重合 ≥ 50% 优先归到已有 episode
- 主题切换明显 → 新 episode 或 skip

## Few-shot

### Example 1：同会议多 description → 1 个 episode + 1 个 skip

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_001", "display_title": "续航讨论", "search_text": "当前 38h，目标 50h。林啸提议 1Hz→0.2Hz 省 18%。", "created_at": "2026-05-03 09:15", "entities": ["林啸", "续航"] },
    { "id": "d_002", "display_title": "iOS 候选人面试", "search_text": "周三 15:00，林啸参加。", "created_at": "2026-05-03 09:18", "entities": ["Sean", "林啸"] },
    { "id": "d_003", "display_title": "周末家庭", "search_text": "周六深圳湾，全天不在线。", "created_at": "2026-05-03 09:22", "entities": ["深圳湾"] },
    { "id": "d_004", "display_title": "设计稿 review", "search_text": "下午 4 点 Sean 拉一次。", "created_at": "2026-05-03 09:25", "entities": ["Sean"] }
  ],
  "existing_episodes_summary": []
}
```

**Output**:
```json
{
  "episode_actions": [
    {
      "kind": "create",
      "display_title": "5/3 周例会",
      "display_summary": "硬件 + 招聘 + 设计",
      "search_summary": "续航 38h vs 50h 目标，林啸提议 BLE 心率 1Hz→0.2Hz 省 18%；Sean 推荐 iOS 候选人周三 15:00 面试；下午 4 点设计稿 review",
      "search_keywords": ["续航", "BLE", "1Hz→0.2Hz", "林啸", "Sean", "iOS 候选人", "周三 15:00", "设计稿"],
      "description_ids": ["d_001", "d_002", "d_004"],
      "time_range": "2026-05-03 09:15~09:25",
      "entity_ids": ["林啸", "Sean"],
      "salience": 0.82
    },
    {
      "kind": "skip",
      "description_id": "d_003",
      "reason": "主题为个人家庭安排，与会议工作主线无关。留待 Life scene 单独处理。"
    }
  ],
  "schema_version": 2
}
```

**为什么这样**：3 条工作主题（d_001, d_002, d_004）同时间窗 + 实体重合（林啸/Sean）→ create 一个 episode。d_003 是个人主题切换 → skip 而不是合进来（避免污染工作 episode 的语义纯度）。

---

### Example 2：跨日延续 → extend

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_010", "display_title": "续航实测", "search_text": "0.2Hz 实测省 21%，超预期 3 个百分点。", "created_at": "2026-05-04 10:00", "entities": ["林啸", "续航", "BLE"] }
  ],
  "existing_episodes_summary": [
    { "id": "ep_5_3_dev", "display_title": "5/3 续航优化讨论", "time_range": "2026-05-03 09:00~10:00", "entity_overlap": ["林啸", "BLE", "续航"] }
  ]
}
```

**Output**:
```json
{
  "episode_actions": [
    {
      "kind": "extend",
      "episode_id": "ep_5_3_dev",
      "description_ids": ["d_010"]
    }
  ],
  "schema_version": 2
}
```

**为什么 extend 不 create**：实体 100% 重合（林啸/BLE/续航），且是前一天讨论的**直接结果验证**——主题连续。即便跨天，也归属同一 episode。

---

### Example 3：多个独立单点 → 多个 create

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_021", "display_title": "心情快照灵感", "search_text": "戒指主动按一下记录此刻感觉。", "created_at": "2026-05-03 11:20", "entities": ["心情快照", "戒指交互"] },
    { "id": "d_022", "display_title": "晨跑决心", "search_text": "从今天起每天 6:30 跑 3km。", "created_at": "2026-05-03 06:30", "entities": ["晨跑", "健康"] }
  ],
  "existing_episodes_summary": []
}
```

**Output**:
```json
{
  "episode_actions": [
    {
      "kind": "create",
      "display_title": "5/3 心情快照灵感",
      "display_summary": "用戒指按一下记录此刻感觉",
      "search_summary": "产品想法：Ring 增加心情快照按键，用户主动按一下记录此刻情绪。比每日健康汇总更有温度。",
      "search_keywords": ["心情快照", "戒指交互", "产品想法", "v2"],
      "description_ids": ["d_021"],
      "time_range": "2026-05-03 11:20",
      "entity_ids": ["心情快照", "戒指交互"],
      "salience": 0.75
    },
    {
      "kind": "create",
      "display_title": "5/3 开始晨跑",
      "display_summary": "每天早 6:30 跑 3km",
      "search_summary": "明明决定从 2026-05-03 起每天早 6:30 跑 3km 作为长期健康习惯。",
      "search_keywords": ["晨跑", "健康习惯", "6:30", "3km", "5/3 起步"],
      "description_ids": ["d_022"],
      "time_range": "2026-05-03 06:30",
      "entity_ids": ["晨跑", "健康"],
      "salience": 0.7
    }
  ],
  "schema_version": 2
}
```

**为什么不合并**：虽都在 5/3 同一天，但实体完全不重合（心情快照 vs 晨跑）+ 主题完全不同（产品想法 vs 个人习惯）。**时间相邻 ≠ 应该合并**，关键是主题/实体一致性。

---

### Example 4：第二天补充上下文 → extend 不 create

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_030", "display_title": "晨跑第 2 天", "search_text": "今天又跑了 3km，6:30 出门，状态比昨天好。", "created_at": "2026-05-04 06:30", "entities": ["晨跑"] }
  ],
  "existing_episodes_summary": [
    { "id": "ep_running_start", "display_title": "5/3 开始晨跑", "time_range": "2026-05-03 06:30", "entity_overlap": ["晨跑"] }
  ]
}
```

**Output**:
```json
{
  "episode_actions": [
    {
      "kind": "extend",
      "episode_id": "ep_running_start",
      "description_ids": ["d_030"]
    }
  ],
  "schema_version": 2
}
```

**为什么 extend**：实体重合 + 是同一习惯的连续打卡。⚠️ **但是**：这里有个长期挑战 — 如果第 30 天还在打卡，episode 里就有 30 条 description，会变臃肿。**v0.5 范围内允许 episode 长期 extend**；v0.6 需要决策"什么时候封口一个 episode 开新的"（待定的 issue）。

---

### Example 5：候选 episode 都不像 → skip + 暗示 create new

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_040", "display_title": "Anthropic 切换决策", "search_text": "我决定从 OpenAI 改用 Anthropic。Claude prompt following 更好。", "created_at": "2026-05-03 14:00", "entities": ["Anthropic", "OpenAI", "LLM"] }
  ],
  "existing_episodes_summary": [
    { "id": "ep_5_3_dev", "display_title": "5/3 续航优化", "time_range": "2026-05-03 09:00~10:00", "entity_overlap": [] }
  ]
}
```

**Output**:
```json
{
  "episode_actions": [
    {
      "kind": "create",
      "display_title": "5/3 LLM 切到 Anthropic",
      "display_summary": "从 OpenAI 改用 Anthropic",
      "search_summary": "明明决定 5/3 起项目内 LLM 全部从 OpenAI 切换到 Anthropic。理由：Claude 的 prompt following 比 GPT 表现更好。",
      "search_keywords": ["Anthropic", "OpenAI", "LLM 切换", "Claude", "prompt following", "技术决策"],
      "description_ids": ["d_040"],
      "time_range": "2026-05-03 14:00",
      "entity_ids": ["Anthropic", "OpenAI", "LLM"],
      "salience": 0.88
    }
  ],
  "schema_version": 2
}
```

**为什么 create**：候选 episode (`ep_5_3_dev`) 实体重合 = 0（续航讨论里没出现 LLM）→ 不能 extend。salience 0.88：明确决策（"我决定"）+ 跨多个未来 project 的影响 + 命名实体。

## 边界
- 单条 description 不归到任何 episode → kind=skip
- 候选 episode 都不匹配 → kind=create

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段（display_title/summary + search_summary/keywords）

## Eval
见 `eval/description-to-episode-fixtures.md`
