---
name: memory-tree-project-to-scene
version: 3
owner: 明明
status: draft
last-updated: 2026-05-06
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=scene)
---

# memory-tree-worker · project → scene

## 用途
**Scene 是 L4，比 L3 project 更宽的语境包络**。把若干 project 聚合到 scene。

- **Project = "在做什么"**（Monostone Ring v1、iOS App MVP、GTM）
- **Scene = "在哪个上下文里做"**（Work / Life）

⚠️ **生产现状**：当前后端实际跑的 scene 只有 **Work** 和 **Life** 两个 phase。
本 prompt 实际行为 = attach 到 Work / Life 之一。
5 类 kind（time / location / topic / person / phase）是未来扩展（v0.6+），v0.5 范围内默认走 phase。

## 输入契约
```typescript
{
  project: {
    id: string,
    title: string,                 // ≤ 8 字 project 名
    text: string,                  // 两段结构
    entity_ids: string[],
    recent_episodes: Array<{ id, time_range, entity_ids }>,
  },
  existing_scenes: Array<{
    id: string,
    title: string,                 // "Work" / "Life" / 等
    text: string,                  // 两段结构（第一段=简介, 第二段=详细给 Agent 检索用）
    kind: "time" | "location" | "topic" | "person" | "phase",
    contained_project_ids: string[],
  }>,
  user_timezone: string,
}
```

## 输出契约（v3 对齐后端 — 零新字段）
```typescript
{
  scene_actions: Array<
    | { kind: "attach", scene_id: string, reason: string }
    | {
        kind: "create",
        scene_kind: "time" | "location" | "topic" | "person" | "phase",
        title: string,             // ≤ 8 字 "周一例会" "和林啸协作"
        text: string,              // 两段结构（第一段=简介给用户，第二段=详细给 Agent）
        recurrence_pattern?: string,
        location?: string,
        topic?: string,
        person_id?: string,
        reason: string,
      }
    | { kind: "skip", reason: string }
  >,
  schema_version: 1,
}
```

## Scene 维度（5 种 kind）
- **phase** — 人生 / 业务阶段（Work / Life）⭐ v0.5 默认走这个
- **time** — 周期性时间（"周一例会"）— v0.6+
- **location** — 地理空间（"深圳湾办公室"）— v0.6+
- **topic** — 主题语境（"健康习惯探索"）— v0.6+
- **person** — 围绕特定人（"和林啸协作"）— v0.6+

> 一个 project 可同时挂多个 scene（横切）。

## System Prompt

> 你把 project 挂到对的 scene（用户人生的语境包络，比 project 更宽）。
>
> **v0.5 现状**：scene 只有 Work 和 Life 两个 phase。优先 `attach` 到这两个之一，不主动 `create` 新 scene 类型（5 类 kind 是 v0.6+ 扩展）。
>
> **判别 Work vs Life**
> 跟 Monostone 创业相关（团队/产品/融资/招聘）→ Work。个人生活相关（家庭/健康/爱好/休息）→ Life。横跨两端的（如读书计划：工作书 + 个人书）挂双 scene。测试 / 临时 / 系统生成的 project → `skip`。
>
> **新建 scene 时的 title / text**（v0.6+ 用）
> Title ≤ 8 字（"周一例会"、"和林啸协作"）。Text 两段：第一段 ≤ 30 字简介，第二段详细 search 描述给 Agent 检索时定位。一个 project 通常挂 1-3 个 scene。

## 决策规则
- v0.5 默认 attach Work / Life 之一
- 灰色地带（横跨工作和生活） → 挂双 scene
- 测试性质 project → skip

## Few-shot

### Example 1：硬件项目 → attach Work

**Input**:
```json
{
  "project": {
    "id": "proj_ring_v1",
    "title": "Ring v1 硬件",
    "text": "硬件 MVP 5 月发布\n\nMonostone 戒指 v1 硬件 MVP，林啸主导前后端，目标 5 月发布",
    "entity_ids": ["林啸", "续航", "BLE"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "title": "Work", "text": "工作语境\n\n明明的工作上下文：Monostone 创业相关所有项目", "kind": "phase", "contained_project_ids": ["proj_growth", "proj_app"] },
    { "id": "sc_phase_life", "title": "Life", "text": "生活语境\n\n明明的个人生活：家庭、健康、爱好", "kind": "phase", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    {
      "kind": "attach",
      "scene_id": "sc_phase_work",
      "reason": "Ring v1 是 Monostone 创业核心产品，明确属于 Work phase scene"
    }
  ],
  "schema_version": 1
}
```

---

### Example 2：个人项目 → attach Life

**Input**:
```json
{
  "project": {
    "id": "proj_health",
    "title": "个人健康",
    "text": "晨跑/运动/饮食习惯\n\n晨跑/运动/饮食/睡眠等长期健康习惯跟踪",
    "entity_ids": ["晨跑", "健康", "运动"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "title": "Work", "text": "工作\n\n工作", "kind": "phase", "contained_project_ids": ["proj_ring_v1", "proj_app"] },
    { "id": "sc_phase_life", "title": "Life", "text": "生活\n\n生活", "kind": "phase", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    {
      "kind": "attach",
      "scene_id": "sc_phase_life",
      "reason": "个人健康习惯属于个人生活范畴，挂到 Life phase scene"
    }
  ],
  "schema_version": 1
}
```

---

### Example 3：跨工作/生活的灰色地带 → 都挂

**Input**:
```json
{
  "project": {
    "id": "proj_reading",
    "title": "读书计划",
    "text": "每月 2 本，工作 + 个人混合\n\n每月读 2 本书，混合工作相关（产品/管理）和个人相关（哲学/小说）",
    "entity_ids": ["读书", "学习"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "title": "Work", "text": "工作\n\n工作", "kind": "phase", "contained_project_ids": [] },
    { "id": "sc_phase_life", "title": "Life", "text": "生活\n\n生活", "kind": "phase", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    {
      "kind": "attach",
      "scene_id": "sc_phase_work",
      "reason": "工作相关读书（产品/管理书）属于 Work"
    },
    {
      "kind": "attach",
      "scene_id": "sc_phase_life",
      "reason": "个人读书（哲学/小说）属于 Life。读书计划本身横跨两端"
    }
  ],
  "schema_version": 1
}
```

---

### Example 4：保守路径，不主动建 topic scene

**Input**:
```json
{
  "project": {
    "id": "proj_v2_planning",
    "title": "Ring v2 规划",
    "text": "下一代形态探索\n\nRing 下一代形态探索：可能形态、关键约束、技术方向",
    "entity_ids": ["v2", "形态", "硬件演进"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "title": "Work", "text": "工作\n\n工作", "kind": "phase", "contained_project_ids": ["proj_ring_v1", "proj_app"] },
    { "id": "sc_phase_life", "title": "Life", "text": "生活\n\n生活", "kind": "phase", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    {
      "kind": "attach",
      "scene_id": "sc_phase_work",
      "reason": "Ring v2 规划是工作核心项目，属于 Work phase。v0.5 不主动新建 topic scene。"
    }
  ],
  "schema_version": 1
}
```

> ⚠️ **v0.6+ 路径**：当用户的 v2 相关 episode 积累超过 30 个 + 涉及主题超出 Work 普通范畴时，可以触发 create topic scene。届时本 prompt 输出会变成：
> ```json
> { "kind": "create", "scene_kind": "topic", "title": "硬件演进", "text": "v1→v2→v3 硬件路线\n\nRing 硬件代际演进策略...", "topic": "硬件演进", "reason": "..." }
> ```

---

### Example 5：边缘 project → skip

**Input**:
```json
{
  "project": {
    "id": "proj_test_imports",
    "title": "测试导入数据",
    "text": "测试用临时项目\n\n用户用来测试 import 功能的临时项目",
    "entity_ids": ["测试", "import"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "title": "Work", "text": "工作\n\n工作", "kind": "phase", "contained_project_ids": [] },
    { "id": "sc_phase_life", "title": "Life", "text": "生活\n\n生活", "kind": "phase", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    {
      "kind": "skip",
      "reason": "测试性质 project，既非 Work 也非 Life，不挂 scene 避免污染语境"
    }
  ],
  "schema_version": 1
}
```

## 边界
- project 不属于任何已有语境 → 默认 attach Work（除非明显是 Life）
- 用户已有 50+ scene → 优先 attach 已有
- 测试 / 系统生成 project → skip

## 版本历史
- v1 (2026-05-02): episode → scene
- v2 (2026-05-03): scene 升 L4 + 5 类 kind + display/search 双视角 — **已废弃**（双视角部分）
- **v3 (2026-05-06): 对齐后端 — title + text 两段结构 + scene 实际只用 phase (Work/Life)**

## Eval
见 `eval/project-to-scene-fixtures.md`
