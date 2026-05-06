---
name: memory-tree-description-to-episode
version: 3
owner: 明明
status: draft
last-updated: 2026-05-06
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
  candidate_descriptions: Array<{
    id: string,
    title: string,           // 短标题
    text: string,            // 两段结构（按 \n\n 分隔）
    created_at: string,
    entities: string[],
  }>,
  existing_episodes_summary: Array<{
    id: string,
    title: string,
    time_range: string,
    entity_overlap: string[]
  }>,
  user_timezone: string,
}
```

## 输出契约（v3 对齐后端 — 零新字段）
```typescript
{
  episode_actions: Array<
    | {
        kind: "create",
        title: string,            // ≤ 12 字 "5/3 周例会"
        text: string,             // 两段结构（按 \n\n 分隔）
                                  //   第一段 ≤ 30 字: 一行摘要"硬件 + 招聘 + 设计"
                                  //   第二段: 详细 search 内容（含人名/数字/决策）
        description_ids: string[],
        time_range: string,
        entity_ids: string[],
        importance: number,
      }
    | { kind: "extend", episode_id: string, description_ids: string[] }
    | { kind: "skip", description_id: string, reason: string }
  >,
  schema_version: 1,
}
```

## System Prompt

> 你把若干 description 聚合成 episode — 一段相对完整的"事件"。
>
> **输出 action**
> - `create` 新 episode，需 `title`（≤ 12 字，时间锚 + 主类型如"5/3 周例会"）+ `text`（两段 \n\n 分隔，先 ≤ 30 字摘要再详细 search 内容）+ `description_ids` + `time_range` + `entity_ids` + `importance`
> - `extend` 加到已有 episode，需 `episode_id` + `description_ids`
> - `skip` 不归到任何 episode，需 `description_id` + `reason`
>
> **聚合判断**
> Episode 时长一般 ≤ 1 天。同主题跨天用 `extend` 不开新 episode。实体重合 ≥ 50% 且时间相邻 1 小时内优先 `extend`。主题切换明显则 `create` 新的或 `skip`（如果跟当下 batch 主线无关）。难判定时倾向不开新的。

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
    { "id": "d_001", "title": "续航讨论", "text": "续航 38h，离 50h 目标差 12h\n\n当前 38h，目标 50h。林啸提议 1Hz→0.2Hz 省 18%。", "created_at": "2026-05-03 09:15", "entities": ["林啸", "续航"] },
    { "id": "d_002", "title": "iOS 候选人面试", "text": "周三下午 3 点，林啸一起\n\n周三 15:00，林啸参加。", "created_at": "2026-05-03 09:18", "entities": ["Sean", "林啸"] },
    { "id": "d_003", "title": "周末家庭", "text": "周六深圳湾，全天不在线\n\n周六深圳湾，全天不在线。", "created_at": "2026-05-03 09:22", "entities": ["深圳湾"] },
    { "id": "d_004", "title": "设计稿 review", "text": "下午 4 点 Sean 拉一次\n\n下午 4 点 Sean 拉一次设计稿 review。", "created_at": "2026-05-03 09:25", "entities": ["Sean"] }
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
      "title": "5/3 周例会",
      "text": "硬件 + 招聘 + 设计\n\n续航 38h vs 50h 目标，林啸提议 BLE 心率 1Hz→0.2Hz 省 18%；Sean 推荐 iOS 候选人周三 15:00 面试；下午 4 点设计稿 review",
      "description_ids": ["d_001", "d_002", "d_004"],
      "time_range": "2026-05-03 09:15~09:25",
      "entity_ids": ["林啸", "Sean"],
      "importance": 0.82
    },
    {
      "kind": "skip",
      "description_id": "d_003",
      "reason": "主题为个人家庭安排，与会议工作主线无关。留待 Life scene 单独处理。"
    }
  ],
  "schema_version": 1
}
```

**为什么这样**：3 条工作主题（d_001, d_002, d_004）同时间窗 + 实体重合 → create 一个 episode。d_003 是个人主题切换 → skip。

---

### Example 2：跨日延续 → extend

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_010", "title": "续航实测", "text": "实测省 21% 超预期\n\n0.2Hz 实测省 21%，超预期 3 个百分点。", "created_at": "2026-05-04 10:00", "entities": ["林啸", "续航", "BLE"] }
  ],
  "existing_episodes_summary": [
    { "id": "ep_5_3_dev", "title": "5/3 续航优化讨论", "time_range": "2026-05-03 09:00~10:00", "entity_overlap": ["林啸", "BLE", "续航"] }
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
  "schema_version": 1
}
```

**为什么 extend**：实体 100% 重合 + 是前一天讨论的直接结果验证 → 主题连续。

---

### Example 3：多个独立单点 → 多个 create

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_021", "title": "心情快照灵感", "text": "用戒指按一下记录此刻感觉\n\n戒指主动按一下记录此刻感觉。", "created_at": "2026-05-03 11:20", "entities": ["心情快照", "戒指交互"] },
    { "id": "d_022", "title": "晨跑决心", "text": "每天 6:30 跑 3km\n\n从今天起每天 6:30 跑 3km。", "created_at": "2026-05-03 06:30", "entities": ["晨跑", "健康"] }
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
      "title": "5/3 心情快照灵感",
      "text": "用戒指按一下记录此刻感觉\n\n产品想法：Ring 增加心情快照按键，用户主动按一下记录此刻情绪。比每日健康汇总更有温度。",
      "description_ids": ["d_021"],
      "time_range": "2026-05-03 11:20",
      "entity_ids": ["心情快照", "戒指交互"],
      "importance": 0.75
    },
    {
      "kind": "create",
      "title": "5/3 开始晨跑",
      "text": "每天早 6:30 跑 3km\n\n明明决定从 2026-05-03 起每天早 6:30 跑 3km 作为长期健康习惯。",
      "description_ids": ["d_022"],
      "time_range": "2026-05-03 06:30",
      "entity_ids": ["晨跑", "健康"],
      "importance": 0.7
    }
  ],
  "schema_version": 1
}
```

**为什么不合并**：实体完全不重合 + 主题完全不同。时间相邻 ≠ 应该合并。

---

### Example 4：第二天补充 → extend

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_030", "title": "晨跑第 2 天", "text": "今天又跑了 3km\n\n今天又跑了 3km，6:30 出门，状态比昨天好。", "created_at": "2026-05-04 06:30", "entities": ["晨跑"] }
  ],
  "existing_episodes_summary": [
    { "id": "ep_running_start", "title": "5/3 开始晨跑", "time_range": "2026-05-03 06:30", "entity_overlap": ["晨跑"] }
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
  "schema_version": 1
}
```

---

### Example 5：候选 episode 都不像 → create 新 episode

**Input**:
```json
{
  "candidate_descriptions": [
    { "id": "d_040", "title": "Anthropic 切换决策", "text": "从 OpenAI 改用 Anthropic\n\n我决定从 OpenAI 改用 Anthropic。Claude prompt following 更好。", "created_at": "2026-05-03 14:00", "entities": ["Anthropic", "OpenAI", "LLM"] }
  ],
  "existing_episodes_summary": [
    { "id": "ep_5_3_dev", "title": "5/3 续航优化", "time_range": "2026-05-03 09:00~10:00", "entity_overlap": [] }
  ]
}
```

**Output**:
```json
{
  "episode_actions": [
    {
      "kind": "create",
      "title": "5/3 LLM 切到 Anthropic",
      "text": "从 OpenAI 改用 Anthropic\n\n明明决定 5/3 起项目内 LLM 全部从 OpenAI 切换到 Anthropic。理由：Claude 的 prompt following 比 GPT 表现更好。",
      "description_ids": ["d_040"],
      "time_range": "2026-05-03 14:00",
      "entity_ids": ["Anthropic", "OpenAI", "LLM"],
      "importance": 0.88
    }
  ],
  "schema_version": 1
}
```

**为什么 create**：候选 episode 实体重合 = 0 → 不能 extend。importance 0.88：明确决策 + 跨多 project 影响。

## 边界
- 候选 description 都 < 0.3 importance → 全部 skip
- 一天内超过 5 个独立 episode → 提示用户"今天信息密度异常高"

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): display_/search_ 双视角 — **已废弃**
- **v3 (2026-05-06): 对齐后端 — title + text 两段结构**

## Eval
见 `eval/description-to-episode-fixtures.md`
