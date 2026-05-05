---
name: memory-tree-user-profile-extractor
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=user_profile)
---

# memory-tree-worker · → user_profile

## 用途
从下层节点（episode / project / scene）提取 L4 user_profile：用户偏好、关系、目标、习惯。L4 是 Agent 决策最常用的画像层。

## 输入契约（v2）
```typescript
{
  candidate_signals: Array<{
    source_node_id: string,
    layer: "episode" | "project" | "scene",   // scene 现在是 L4
    search_text: string,                       // 检索用文本
    salience: number,                           // 原 importance 改名
  }>,
  existing_profile: {              // 当前 user profile 全量（可能很长，注意 token）
    preferences: { ... },
    relationships: { ... },
    goals: { ... },
    habits: { ... },
  },
}
```

## 输出契约（v2 双视角）
```typescript
{
  profile_updates: Array<
    | {
        kind: "add",
        category: "preferences" | "relationships" | "goals" | "habits",
        key: string,
        value: any,
        // display 字段（给用户看 user_profile 时一句人话）
        display_phrase: string,    // ≤ 30 字 "你倾向选择简洁的产品形态"
        // search 字段
        search_text: string,        // 给 Agent 用，密集
        evidence_node_ids: string[],
      }
    | {
        kind: "update",
        category, key, new_value,
        display_phrase: string,
        search_text: string,
        evidence_node_ids: string[],
      }
    | { kind: "remove", category, key, reason }
  >,
  schema_version: 2,
}
```

## System Prompt
> TODO（明明 v2）draft：
>
> 你是 Memory 树的画像提取器。这个 prompt 决定 "Monostone 怎么看你这个人"。
> **不要过度推断**——profile 是用户的镜子，不是猜测。
>
> 【4 类边界】
> - **preferences**：做事方式偏好（"喜欢简洁 UI" / "偏好早会" / "选择 Anthropic 而不是 OpenAI"）
> - **relationships**：人 + 角色 + 频率（"林啸 = 唯一前后端开发，daily" / "Sean = 设计，weekly"）
> - **goals**：长期目标，有时间锚（"5 月发 MVP" / "10K 用户"）
> - **habits**：周期性行为（"每周一例会" / "早 6:30 跑步"）
>
> 【evidence 阈值】
> - 必须 ≥ 2 个独立 evidence 才能 add（防单次表达污染画像）
> - 不足 → 暂存 candidates_pending（下次出现第二个 evidence 时合并）
>
> 【冲突处理】
> - 新偏好与旧冲突 → kind=update，旧的 evidence 保留，标记为"已变化"
>
> 【双视角输出】
> - display_phrase：给用户看的人话 "你倾向选择简洁的产品形态"
> - search_text：给 Agent 检索的密集 "user prefers minimal UI; rejected complex onboarding flows in 3 evidence"
>
> 【硬黑名单（绝对不抽取，即使多次表达也只存 raw layer）】
> 1. 健康病史 / 用药 / 心理诊断
> 2. 性取向 / 性偏好
> 3. 政治倾向 / 党派立场
> 4. 宗教信仰
> 5. 财务收入 / 资产
>
> 这是法律风险红线，prompt 里硬写死，不靠 LLM 判断。
> 用户主动多次表达 → 仍然只存 raw，不上 user_profile。

## 决策规则
- 至少 2 个独立 evidence 才能 add（不足 → candidates_pending）
- 偏好冲突 → kind=update，旧 evidence 标记"已变化"
- 5 类敏感信息硬黑名单，绝不抽到 user_profile（无视频次）

## Few-shot

### Example 1：新关系 add（≥ 2 evidence）

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_5_3_dev", "layer": "episode", "search_text": "林啸优化 BLE 协议，明天测试", "salience": 0.85 },
    { "source_node_id": "ep_4_26_dev", "layer": "episode", "search_text": "林啸说他周三 OOO", "salience": 0.5 },
    { "source_node_id": "proj_ring_v1", "layer": "project", "search_text": "林啸是唯一前后端开发", "salience": 0.95 }
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
      "display_phrase": "林啸是你的唯一开发，几乎每天协作",
      "search_text": "user has daily collaboration with 林啸 as sole engineer (前后端工程师), covering both 硬件 and 软件 work; relationship strength=high",
      "evidence_node_ids": ["ep_5_3_dev", "ep_4_26_dev", "proj_ring_v1"]
    }
  ],
  "schema_version": 2
}
```

**为什么 add**：3 个 evidence ≥ 阈值，跨 episode 和 project 两层 → 关系稳定。display_phrase 用第二人称（"你的..."）让用户感觉 AI 在跟自己对话。

---

### Example 2：偏好冲突 update（有旧值，被新 evidence 覆盖）

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_5_3_llm", "layer": "episode", "search_text": "我决定改用 Anthropic 而不是 OpenAI", "salience": 0.9 },
    { "source_node_id": "ep_5_2_eval", "layer": "episode", "search_text": "Claude 的 prompt following 比 GPT 好", "salience": 0.85 }
  ],
  "existing_profile": {
    "preferences": { "llm_provider": { "value": "OpenAI", "evidence_count": 3 } },
    "relationships": {},
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
      "kind": "update",
      "category": "preferences",
      "key": "llm_provider",
      "new_value": "Anthropic",
      "display_phrase": "你最近从 OpenAI 切换到 Anthropic",
      "search_text": "user switched LLM provider preference from OpenAI to Anthropic, citing prompt following quality; switch happened around 2026-05-03",
      "evidence_node_ids": ["ep_5_3_llm", "ep_5_2_eval"]
    }
  ],
  "schema_version": 2
}
```

**为什么 update 不 add**：preferences.llm_provider key 已存在 → 路径是更新。display_phrase 强调"最近"和"切换"——让用户看到 AI 知道这是变化（不是初次记录）。

---

### Example 3：单 evidence → 不抽（暂存 candidates_pending 隐含）

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_random_lunch", "layer": "episode", "search_text": "今天午饭吃了拉面，挺好吃", "salience": 0.2 }
  ],
  "existing_profile": { "preferences": {}, "relationships": {}, "goals": {}, "habits": {} }
}
```

**Output**:
```json
{
  "profile_updates": [],
  "schema_version": 2
}
```

**为什么空数组**：只有 1 条 evidence + salience 0.2 太弱。即便意图是"用户偏好拉面"也不该 add。**v0.5 范围**：直接返回空数组。**v0.6+ 路径**：未来 backend 可以维护 `candidates_pending` 表，本 prompt 在那时输出 `kind: "pending", category, key, value, evidence_node_ids` 等待第二次 evidence 触发合并。

---

### Example 4：habits 抽取（多次模式 → add）

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_5_3_run", "layer": "episode", "search_text": "5/3 早 6:30 跑了 3km", "salience": 0.5 },
    { "source_node_id": "ep_5_4_run", "layer": "episode", "search_text": "5/4 早 6:30 跑了 3km，连续第 2 天", "salience": 0.55 },
    { "source_node_id": "ep_5_5_run", "layer": "episode", "search_text": "5/5 早 6:30 跑 3km，第 3 天，状态稳定", "salience": 0.6 },
    { "source_node_id": "proj_health", "layer": "project", "search_text": "明明 5/3 起每天 6:30 跑 3km", "salience": 0.8 }
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
      "display_phrase": "你从 5/3 起每天早 6:30 跑 3km",
      "search_text": "user habit: morning run, daily 06:30, 3km distance; established 2026-05-03; 3 consecutive days observed",
      "evidence_node_ids": ["ep_5_3_run", "ep_5_4_run", "ep_5_5_run", "proj_health"]
    }
  ],
  "schema_version": 2
}
```

**为什么是 habit 不是 goal**：goal 是"想达到的目标"（"健身减脂 5kg"），habit 是"已发生的周期行为"。"已经连续 3 天" → habit 形成中。如果 evidence 是 "我打算每天跑步" 没真跑过 → goal。

---

### Example 5：⚠️ 敏感信息硬黑名单 — 即使多 evidence 也不 add

**Input**:
```json
{
  "candidate_signals": [
    { "source_node_id": "ep_health_1", "layer": "episode", "search_text": "我最近发现自己有点焦虑症倾向", "salience": 0.7 },
    { "source_node_id": "ep_health_2", "layer": "episode", "search_text": "和心理咨询师聊了，他说我有焦虑特质", "salience": 0.8 },
    { "source_node_id": "ep_health_3", "layer": "episode", "search_text": "在吃 SSRI 类的抗焦虑药", "salience": 0.85 }
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
  "schema_version": 2
}
```

**为什么空数组（即便有 3 个 evidence）**：内容触及**硬黑名单第 1 项（健康病史 / 用药 / 心理诊断）**。
- evidence 在 raw 和 description 层仍然存在（用户能搜到）
- 但**不抽到 user_profile**——避免：
  1. Agent 后续决策中误用（"既然你有焦虑，建议..."）
  2. 第三方 plugin 通过 user_profile API 看到敏感信息
  3. 数据导出泄露
- 这是**法律 / 信任红线**，prompt 里硬写死，不让 LLM 自由判断。

> 如果用户**明确要求** Agent "记住我有焦虑"——通过 dialogue-writeback prompt（MON-7）走的路径，会显式记录到对话历史，但仍**不抽到 user_profile**。这是 v0.5 的保守原则。

## 边界
- 单个 evidence 不能 add → 暂存 candidates_pending
- profile 字段达到上限 → 触发 prune（弱 evidence 优先）

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段 (display_phrase + search_text)；明确 5 类敏感信息硬黑名单；scene 是 L4

## Eval
见 `eval/user-profile-extractor-fixtures.md`
