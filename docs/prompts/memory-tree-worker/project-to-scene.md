---
name: memory-tree-project-to-scene
version: 2
owner: 明明
status: draft
last-updated: 2026-05-03
backend-service: memory-tree-worker
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=scene)
---

# memory-tree-worker · project → scene （v2 升层）

## 用途
**Scene 是 L4，比 L3 project 更宽的语境包络**。

把若干 project 聚合到 scene。Scene ≠ project：
- **Project = "在做什么"**（Monostone Ring v1、iOS App MVP、GTM）
- **Scene = "在哪个上下文里做"**（创业期、深圳办公室、和林啸的所有协作）

一个 scene 可以**横跨多个 project**。例：
- scene "创业期 (2025~)" 包含 ["Ring v1", "iOS App", "GTM", "招聘", "融资"]
- scene "和林啸的所有协作" 包含 ["Ring v1", "iOS App"]
- scene "周一例会" 包含跨多个 project 的 episode

## 输入契约
```typescript
{
  project: {
    id: string,
    display_name: string,
    search_definition: string,
    entity_ids: string[],
    recent_episodes: Array<{ id, time_range, entity_ids }>,
  },
  existing_scenes: Array<{
    id,
    display_name: string,            // 给用户看 "周一例会" / "深圳办公室" / "创业期"
    search_definition: string,       // 给 Agent 检索 "weekly Mon 09:00 with 林啸/Sean"
    kind: "time" | "location" | "topic" | "person" | "phase",
    contained_project_ids: string[],
  }>,
  user_timezone: string,
}
```

## 输出契约（v2 双视角）
```typescript
{
  scene_actions: Array<
    | { kind: "attach", scene_id: string, reason: string }     // 项目挂到已有 scene
    | {
        kind: "create",
        scene_kind: "time" | "location" | "topic" | "person" | "phase",
        // display 字段
        display_name: string,        // ≤ 8 字 "周一例会" "和林啸协作" "创业期"
        // search 字段
        search_definition: string,   // ≤ 100 字密集描述
        recurrence_pattern?: string, // time scene
        location?: string,           // location scene
        topic?: string,              // topic scene
        person_id?: string,          // person scene
        reason: string,
      }
    | { kind: "skip", reason: string }
  >,
  schema_version: 2,
}
```

## Scene 维度（5 种 kind）
- **time**：周期性时间节奏，"周一例会"、"每天早晨"、"每月复盘"
- **location**：地理空间，"深圳湾办公室"、"家里书房"、"在路上"
- **topic**：主题语境，"健康习惯探索"、"产品哲学讨论"
- **person**：跟特定人共享的语境，"和林啸的所有协作"、"和家人的对话"
- **phase**：人生 / 项目阶段，"创业期"、"读硕士时"、"v1 开发期"

> 一个 project 可以同时挂到多个 scene（横切）。例：
> "Ring v1 硬件" project 同时挂到 ["创业期" phase, "和林啸协作" person, "深圳办公室" location]

## System Prompt
> TODO（明明 v2 写）draft：
>
> 你是 Memory 树的语境聚合器。把 project 挂到对的 scene（场景包络）。
> Scene 是用户人生的"语境单元"，比 project 更宽。
>
> 【五种 scene kind 判别】
> - time：有周期性时间规律（每周/每天/每月）
> - location：有稳定空间（同一地点反复出现）
> - topic：跨人/跨时空的话题语境
> - person：围绕特定人的协作
> - phase：人生 / 业务阶段（年起步）
>
> 【挂法】
> - 一个 project 通常挂 1-3 个 scene（不要超 5 个，避免爆炸）
> - 优先 attach 已有 scene，避免重复创建
> - 主题 / 时间 / 地点 / 人 / 阶段 五维度都不像 → skip
>
> 【display_name vs search_definition】
> - display_name 给用户看 "周一例会" "创业期"
> - search_definition 给 Agent 检索 "Monday 09:00 weekly stand-up with 林啸/Sean covering 硬件 + 招聘 + 设计 议程"

## 决策规则
- 一个 project 挂 1-3 个 scene 为佳
- 已有 scene attach > 新建 scene
- scene 数量 > 50 → 优先 attach，避免爆炸
- 单个 project 不挂 → kind=skip（罕见）

## Few-shot

> 注：当前后端实际跑出来的 scene 主要是 **Work** 和 **Life** 两个 phase scene。
> 5 类 kind（time/location/topic/person/phase）是 v2 spec 完整设计，**但实际生产环境中以 phase 为主**。
> Few-shot 反映这个现实：默认行为 = attach 到 Work / Life 两个 scene 之一。

---

### Example 1：硬件项目 → attach Work（最常见路径）

**Input**:
```json
{
  "project": {
    "id": "proj_ring_v1",
    "display_name": "Ring v1 硬件",
    "search_definition": "Monostone 戒指 v1 硬件 MVP，林啸主导前后端，目标 5 月发布",
    "entity_ids": ["林啸", "续航", "BLE"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "display_name": "Work", "search_definition": "明明的工作上下文：Monostone 创业相关所有项目", "kind": "phase", "contained_project_ids": ["proj_growth", "proj_app"] },
    { "id": "sc_phase_life", "display_name": "Life", "search_definition": "明明的个人生活：家庭、健康、爱好", "kind": "phase", "contained_project_ids": [] }
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
  "schema_version": 2
}
```

**为什么只挂一个 scene**：当前后端只跑 Work/Life 两个 scene，多挂没意义。等用户体量到了或者明确表达需求，再启用 5 类细粒度。

---

### Example 2：个人项目 → attach Life

**Input**:
```json
{
  "project": {
    "id": "proj_health",
    "display_name": "个人健康",
    "search_definition": "晨跑/运动/饮食/睡眠等长期健康习惯跟踪",
    "entity_ids": ["晨跑", "健康", "运动"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "display_name": "Work", "kind": "phase", "contained_project_ids": ["proj_ring_v1", "proj_app"] },
    { "id": "sc_phase_life", "display_name": "Life", "kind": "phase", "contained_project_ids": [] }
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
  "schema_version": 2
}
```

---

### Example 3：跨工作/生活的灰色地带 → 都挂

**Input**:
```json
{
  "project": {
    "id": "proj_reading",
    "display_name": "读书计划",
    "search_definition": "每月读 2 本书，混合工作相关（产品/管理）和个人相关（哲学/小说）",
    "entity_ids": ["读书", "学习", "Notion 笔记"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "display_name": "Work", "kind": "phase", "contained_project_ids": [] },
    { "id": "sc_phase_life", "display_name": "Life", "kind": "phase", "contained_project_ids": [] }
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
      "reason": "工作相关读书（产品/管理书）属于 Work，单独的 episode 通过 description 实体维度区分"
    },
    {
      "kind": "attach",
      "scene_id": "sc_phase_life",
      "reason": "个人读书（哲学/小说）属于 Life。读书计划本身横跨两个语境，挂双 scene。"
    }
  ],
  "schema_version": 2
}
```

**为什么挂两个**：scene 是横切语境，project 是主题。读书计划这个 project 的 episode 会分别落到工作和生活两端 → project 本身挂双 scene 才能反映真实归属。

---

### Example 4：新建 topic scene（罕见路径，未来扩展用）

**Input**:
```json
{
  "project": {
    "id": "proj_v2_planning",
    "display_name": "Ring v2 规划",
    "search_definition": "Ring 下一代形态探索：可能形态、关键约束、技术方向",
    "entity_ids": ["v2", "形态", "硬件演进"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "display_name": "Work", "kind": "phase", "contained_project_ids": ["proj_ring_v1", "proj_app"] },
    { "id": "sc_phase_life", "display_name": "Life", "kind": "phase", "contained_project_ids": [] }
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
      "reason": "Ring v2 规划是工作核心项目，属于 Work phase"
    }
  ],
  "schema_version": 2
}
```

> ⚠️ **保守路径**：当前生产环境只 attach 到现有 Work/Life。
> 未来如果用户的 v2 相关讨论积累足够多，**Memory tab 可手动建议 "硬件演进路线"作为 topic scene**，这个 prompt 在那时返回：
> ```json
> {
>   "kind": "create",
>   "scene_kind": "topic",
>   "display_name": "硬件演进路线",
>   "search_definition": "Ring 硬件代际演进策略：v1 → v2 → v3 的技术与形态决策路线",
>   "topic": "硬件演进路线",
>   "reason": "v2 规划相关 episode 已积累 30+，且涉及主题超出 Work 普通范畴，建议独立 topic scene"
> }
> ```
> 但 **v0.5 范围内不主动创建 topic/person/location/time scene**（避免 scene 数量爆炸 + UI 不支持）。

---

### Example 5：边缘 project → skip

**Input**:
```json
{
  "project": {
    "id": "proj_test_imports",
    "display_name": "测试导入数据",
    "search_definition": "用户用来测试 import 功能的临时项目",
    "entity_ids": ["测试", "import"]
  },
  "existing_scenes": [
    { "id": "sc_phase_work", "display_name": "Work", "kind": "phase", "contained_project_ids": [] },
    { "id": "sc_phase_life", "display_name": "Life", "kind": "phase", "contained_project_ids": [] }
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
  "schema_version": 2
}
```

**为什么 skip**：测试 / 临时 / 系统生成的 project 不该进入用户的语境画像。skip 后 project 仍然存在（可在 sidebar 看到），但不挂 scene → 不影响 user_profile 抽取。

## 边界
- project 不属于任何已有语境 → 单维度新建（优先 phase 或 topic）
- 用户已有 50+ scene → 优先 attach 已有
- 一个 project 同时落到时间/地点/主题 → 三种 scene 都创建/挂上（横切）

## 版本历史
- v1 (2026-05-02): episode → scene
- v2 (2026-05-03): **架构升级** — scene 升到 L4 (project 之上)，输入改为 project，新增 person/phase 维度

## Eval
见 `eval/project-to-scene-fixtures.md`
