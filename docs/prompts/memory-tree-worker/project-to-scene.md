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
> TODO

## 边界
- project 不属于任何已有语境 → 单维度新建（优先 phase 或 topic）
- 用户已有 50+ scene → 优先 attach 已有
- 一个 project 同时落到时间/地点/主题 → 三种 scene 都创建/挂上（横切）

## 版本历史
- v1 (2026-05-02): episode → scene
- v2 (2026-05-03): **架构升级** — scene 升到 L4 (project 之上)，输入改为 project，新增 person/phase 维度

## Eval
见 `eval/project-to-scene-fixtures.md`
