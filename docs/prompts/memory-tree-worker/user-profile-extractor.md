---
name: memory-tree-user-profile-extractor
version: 3
owner: 明明
status: draft
last-updated: 2026-05-06
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=user_profile)
---

# memory-tree-worker · → user_profile

## 用途
从下层节点（episode / project / scene）提取 L5 user_profile：用户偏好、关系、目标、习惯。L5 是 Agent 决策最常用的画像层。

## 输入契约
```typescript
{
  candidate_signals: Array<{
    source_node_id: string,
    layer: "episode" | "project" | "scene",
    text: string,                       // 节点的两段结构 text
    importance: number,
  }>,
  existing_profile: {
    preferences: Record<string, any>,   // { llm_provider: { value: "OpenAI", evidence_count: 3 }, ... }
    relationships: Record<string, any>,
    goals: Record<string, any>,
    habits: Record<string, any>,
  },
}
```

## 输出契约（v3 对齐后端 — 零新字段）
```typescript
{
  profile_updates: Array<
    | {
        kind: "add",
        category: "preferences" | "relationships" | "goals" | "habits",
        key: string,
        value: any,
        text: string,                  // 两段结构：
                                       //   第一段 ≤ 30 字 给用户看的人话 "你倾向选择简洁的产品形态"
                                       //   第二段 详细 search 内容 "user prefers minimal UI; rejected complex flows..."
        evidence_node_ids: string[],
      }
    | {
        kind: "update",
        category, key, new_value,
        text: string,                  // 同 add
        evidence_node_ids: string[],
      }
    | { kind: "remove", category, key, reason }
  >,
  schema_version: 1,
}
```

## System Prompt

> 你从 episode / project / scene 的信号里提取 user_profile。这层决定 "Monostone 怎么看这个用户"，所以**只反映、不猜测**。
>
> **4 类**
> - `preferences` 做事方式偏好（"喜欢简洁 UI"、"选 Anthropic 而非 OpenAI"）
> - `relationships` 人 + 角色 + 频率（"林啸 = 唯一前后端开发，daily"）
> - `goals` 长期目标，最好带时间锚（"5 月发 MVP"、"10K 用户"）
> - `habits` 周期性行为（"每周一例会"、"早 6:30 跑步"）
>
> **action**
> - `add`：≥ 2 个独立 evidence 才允许。证据不足就返回空数组，等下次合并。
> - `update`：新偏好与旧冲突时用，旧 evidence 仍保留以便回溯。
> - `remove`：明确撤销时用。
>
> **text 字段**
> 两段 \n\n 分隔。第一段 ≤ 30 字给用户看，用第二人称（"你最近从 OpenAI 切换到 Anthropic"）。第二段给 Agent 检索/决策用，密集描述 + 时间 + 引用条件。
>
> **硬黑名单**：健康病史/用药/心理诊断、性取向/性偏好、政治、宗教、财务收入/资产 — **绝对不抽到 user_profile**（不论 evidence 多少）。这些 evidence 仍保留在 raw / description 层，只是不上 profile。法律红线，硬写死不靠 LLM 判断。

## 决策规则
- 至少 2 个独立 evidence 才能 add
- 偏好冲突 → kind=update，旧 evidence 标记"已变化"
- 5 类敏感信息硬黑名单，绝不抽到 user_profile（无视频次）

## Few-shot

### Example 1：新关系 add（≥ 2 evidence）

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_5_3_dev", "layer": "episode", "text": "硬件 + 招聘 + 设计\n\n林啸优化 BLE 协议，明天测试", "importance": 0.85 },
    { "source_node_id": "ep_4_26_dev", "layer": "episode", "text": "周三 OOO\n\n林啸说他周三 OOO", "importance": 0.5 },
    { "source_node_id": "proj_ring_v1", "layer": "project", "text": "硬件\n\n林啸是唯一前后端开发", "importance": 0.95 }
  ],
  "existing_profile": {
    "preferences": {},
    "relationships": { "Sean": { "role": "设计", "frequency": "weekly" } },
    "goals": {},
    "habits": {}
  }
}
```

**Output**:
```json
{
  "profile_updates": [
    {
      "kind": "add",
      "category": "relationships",
      "key": "林啸",
      "value": { "role": "前后端工程师 / 唯一开发", "frequency": "daily", "collaboration": "硬件+软件" },
      "text": "林啸是你的唯一开发，几乎每天协作\n\nuser has daily collaboration with 林啸 as sole engineer (前后端工程师), covering both 硬件 and 软件 work; relationship strength=high",
      "evidence_node_ids": ["ep_5_3_dev", "ep_4_26_dev", "proj_ring_v1"]
    }
  ],
  "schema_version": 1
}
```

---

### Example 2：偏好冲突 update

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_5_3_llm", "layer": "episode", "text": "切到 Anthropic\n\n我决定改用 Anthropic 而不是 OpenAI", "importance": 0.9 },
    { "source_node_id": "ep_5_2_eval", "layer": "episode", "text": "Claude 比 GPT 好\n\nClaude 的 prompt following 比 GPT 好", "importance": 0.85 }
  ],
  "existing_profile": {
    "preferences": { "llm_provider": { "value": "OpenAI", "evidence_count": 3 } },
    "relationships": {}, "goals": {}, "habits": {}
  }
}
```

**Output**:
```json
{
  "profile_updates": [
    {
      "kind": "update",
      "category": "preferences",
      "key": "llm_provider",
      "new_value": "Anthropic",
      "text": "你最近从 OpenAI 切换到 Anthropic\n\nuser switched LLM provider preference from OpenAI to Anthropic, citing prompt following quality; switch happened around 2026-05-03",
      "evidence_node_ids": ["ep_5_3_llm", "ep_5_2_eval"]
    }
  ],
  "schema_version": 1
}
```

---

### Example 3：单 evidence → 不抽

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_random_lunch", "layer": "episode", "text": "吃了拉面\n\n今天午饭吃了拉面，挺好吃", "importance": 0.2 }
  ],
  "existing_profile": { "preferences": {}, "relationships": {}, "goals": {}, "habits": {} }
}
```

**Output**:
```json
{
  "profile_updates": [],
  "schema_version": 1
}
```

**为什么空数组**：只有 1 条 evidence + importance 0.2 太弱。即便意图是"用户偏好拉面"也不该 add。

---

### Example 4：habits 抽取（多次模式）

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_5_3_run", "layer": "episode", "text": "5/3 早 6:30 跑了 3km\n\n5/3 早 6:30 跑了 3km", "importance": 0.5 },
    { "source_node_id": "ep_5_4_run", "layer": "episode", "text": "5/4 早 6:30 跑了 3km，连续第 2 天\n\n5/4 早 6:30 跑了 3km，连续第 2 天", "importance": 0.55 },
    { "source_node_id": "ep_5_5_run", "layer": "episode", "text": "5/5 早 6:30 跑 3km，第 3 天\n\n5/5 早 6:30 跑 3km，第 3 天，状态稳定", "importance": 0.6 },
    { "source_node_id": "proj_health", "layer": "project", "text": "晨跑\n\n明明 5/3 起每天 6:30 跑 3km", "importance": 0.8 }
  ],
  "existing_profile": {
    "preferences": {}, "relationships": {}, "goals": {}, "habits": {}
  }
}
```

**Output**:
```json
{
  "profile_updates": [
    {
      "kind": "add",
      "category": "habits",
      "key": "morning_run",
      "value": { "schedule": "daily 06:30", "distance": "3km", "started_at": "2026-05-03" },
      "text": "你从 5/3 起每天早 6:30 跑 3km\n\nuser habit: morning run, daily 06:30, 3km distance; established 2026-05-03; 3 consecutive days observed",
      "evidence_node_ids": ["ep_5_3_run", "ep_5_4_run", "ep_5_5_run", "proj_health"]
    }
  ],
  "schema_version": 1
}
```

**为什么是 habit 不是 goal**：goal 是"想达到的目标"，habit 是"已发生的周期行为"。"已经连续 3 天" → habit 形成中。

---

### Example 5：⚠️ 敏感信息硬黑名单

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_health_1", "layer": "episode", "text": "焦虑症倾向\n\n我最近发现自己有点焦虑症倾向", "importance": 0.7 },
    { "source_node_id": "ep_health_2", "layer": "episode", "text": "心理咨询\n\n和心理咨询师聊了，他说我有焦虑特质", "importance": 0.8 },
    { "source_node_id": "ep_health_3", "layer": "episode", "text": "抗焦虑药\n\n在吃 SSRI 类的抗焦虑药", "importance": 0.85 }
  ],
  "existing_profile": {
    "preferences": {}, "relationships": {}, "goals": {}, "habits": {}
  }
}
```

**Output**:
```json
{
  "profile_updates": [],
  "schema_version": 1
}
```

**为什么空数组（即便有 3 个 evidence）**：内容触及**硬黑名单第 1 项（健康病史 / 用药 / 心理诊断）**。
- evidence 在 raw 和 description 层仍然存在（用户能搜到）
- 但**不抽到 user_profile**：
  1. Agent 后续决策中不会误用
  2. 第三方 plugin 通过 user_profile API 看不到
  3. 数据导出不泄露
- 法律 / 信任红线，prompt 里硬写死。

## 边界
- 单个 evidence 不能 add → 暂存 candidates_pending（v0.5 直接返回空数组）
- profile 字段达到上限 → 触发 prune（弱 evidence 优先）

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段 (display_phrase + search_text) + 5 类硬黑名单 — **已废弃**（双视角部分）
- **v3 (2026-05-06): 对齐后端 — 用 text 两段结构表达双视角；硬黑名单保留**

## Eval
见 `eval/user-profile-extractor-fixtures.md`
