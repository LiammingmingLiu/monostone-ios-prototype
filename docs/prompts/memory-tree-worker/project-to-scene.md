---
name: memory-tree-project-to-scene
version: 4
owner: 明明
status: draft
last-updated: 2026-05-06
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=scene)
---

# memory-tree-worker · project → scene

## 用途
**Scene 是 L4，比 L3 project 更宽的语境包络**。把 project 挂到对的 scene。

- **Project = "在做什么"**（Monostone Ring v1、iOS App MVP、GTM）
- **Scene = "在哪个上下文里做"**（Work、Life，或用户自定义的更多）

## 关键产品决策

**Scene 列表由用户自己管理**：
- 默认 2 个：`Work`（工作 / 主业）和 `Life`（个人生活）
- 用户在「我」tab 可自由增减（增 Side Hustle、删 Life、重命名等）—— **没有数量上限**
- AI **不主动 create 新 scene** —— 用户控制人生大块的命名权

→ 本 prompt 只做**归属判断**：在 existing_scenes 列表里挑一个或多个 attach，或 skip。

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
    title: string,                 // "Work" / "Life" / 用户自定义
    text: string,                  // 两段结构（第一段=简介, 第二段=详细判别描述）
    contained_project_ids: string[],
  }>,
  user_timezone: string,
}
```

## 输出契约
```typescript
{
  scene_actions: Array<
    | { kind: "attach", scene_id: string, reason: string }
    | { kind: "skip", reason: string }
  >,
  schema_version: 1,
}
```

> 一个 project 可同时 attach 到多个 scene（横切，跨 Work + Life 等）。

## System Prompt

> 你把 project 挂到对的 scene（用户人生的语境包络，比 project 更宽）。
>
> **输出**
> - `attach` 到一个或多个已有 scene
> - `skip` 没有合适候选（测试性 / 临时 project）
>
> **不要 create**。Scene 列表由用户在「我」tab 自己管理，AI 只判定归属。
>
> **判别**
> 读每个 existing scene 的 title 和 text 描述，结合 project 的实体和主题判断。默认两类：跟创业 / 工作产出相关挂 Work，跟家庭 / 健康 / 爱好相关挂 Life。横跨两端（如读书计划同时含工作书和个人书）attach 多个。用户自定义的其他 scene（如 Side Hustle）按其 text 描述判断。测试 / 临时 / 系统生成的 project → skip。

## 决策规则
- AI 只 attach / skip，不 create
- 横跨多个 scene → 多个 attach（数组多项）
- 没有合适候选 → skip + reason

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
    { "id": "sc_work", "title": "Work", "text": "工作语境\n\n明明的工作上下文：Monostone 创业、团队、产品、融资", "contained_project_ids": ["proj_growth", "proj_app"] },
    { "id": "sc_life", "title": "Life", "text": "生活语境\n\n明明的个人生活：家庭、健康、爱好", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    { "kind": "attach", "scene_id": "sc_work", "reason": "Ring v1 是 Monostone 创业核心产品，明确属于工作语境" }
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
    "text": "晨跑/运动/饮食\n\n晨跑/运动/饮食习惯跟踪",
    "entity_ids": ["晨跑", "健康", "运动"]
  },
  "existing_scenes": [
    { "id": "sc_work", "title": "Work", "text": "工作\n\n工作", "contained_project_ids": ["proj_ring_v1"] },
    { "id": "sc_life", "title": "Life", "text": "生活\n\n生活", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    { "kind": "attach", "scene_id": "sc_life", "reason": "个人健康习惯属于生活语境" }
  ],
  "schema_version": 1
}
```

---

### Example 3：横跨两端 → 挂双 scene

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
    { "id": "sc_work", "title": "Work", "text": "工作\n\n工作", "contained_project_ids": [] },
    { "id": "sc_life", "title": "Life", "text": "生活\n\n生活", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    { "kind": "attach", "scene_id": "sc_work", "reason": "工作相关读书（产品/管理书）属于 Work" },
    { "kind": "attach", "scene_id": "sc_life", "reason": "个人读书（哲学/小说）属于 Life" }
  ],
  "schema_version": 1
}
```

---

### Example 4：用户自定义 Side scene → attach Side

**Input**:
```json
{
  "project": {
    "id": "proj_blog",
    "title": "技术博客",
    "text": "周末写 1 篇\n\n每周末写一篇技术博客，内容是 Monostone 工程笔记或行业观察",
    "entity_ids": ["博客", "写作"]
  },
  "existing_scenes": [
    { "id": "sc_work", "title": "Work", "text": "工作\n\n创业", "contained_project_ids": ["proj_ring_v1"] },
    { "id": "sc_life", "title": "Life", "text": "生活\n\n个人", "contained_project_ids": [] },
    { "id": "sc_side", "title": "Side", "text": "副业 / 兴趣项目\n\n个人副业、兴趣驱动的产出，如博客、开源、独立项目", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    { "kind": "attach", "scene_id": "sc_side", "reason": "技术博客是兴趣驱动的个人产出，属于 Side（用户自定义）" },
    { "kind": "attach", "scene_id": "sc_work", "reason": "内容涉及 Monostone 工程笔记，与 Work 也有交叉" }
  ],
  "schema_version": 1
}
```

**为什么挂双 scene**：用户自定义的 Side scene 描述里说"个人副业 / 兴趣"，博客主要属于这类；但内容涉及主业，所以也 attach Work。AI 在用户管理的 scene 列表里灵活归属。

---

### Example 5：测试 / 临时 project → skip

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
    { "id": "sc_work", "title": "Work", "text": "工作\n\n工作", "contained_project_ids": [] },
    { "id": "sc_life", "title": "Life", "text": "生活\n\n生活", "contained_project_ids": [] }
  ]
}
```

**Output**:
```json
{
  "scene_actions": [
    { "kind": "skip", "reason": "测试性质 project，不属于任何用户语境，不挂 scene 避免污染" }
  ],
  "schema_version": 1
}
```

## 边界
- 用户没建任何 scene → 只能 skip（理论极少，默认 onboarding 时已建 Work + Life）
- 用户建了 10+ scene → AI 仍按描述判别，可能 attach 多个

## 版本历史
- v1 (2026-05-02): episode → scene
- v2 (2026-05-03): scene 升 L4 + 5 类 kind + display/search 双视角 — **已废弃**
- v3 (2026-05-06): 对齐后端 — title + text 两段结构 + scene 实际只用 phase (Work/Life) — **已废弃**
- **v4 (2026-05-06): 简化 — 删除 5 类 kind 概念 + AI 只 attach 不 create + 用户自定义无上限**

## Eval
见 `eval/project-to-scene-fixtures.md`
