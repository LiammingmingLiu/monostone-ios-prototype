---
name: memory-tree-episode-to-project
version: 3
owner: 明明
status: draft
last-updated: 2026-05-06
backend-service: memory-tree-worker
related-issue: MON-5, MON-12 (灵感归属也用这个)
related-data-schema: docs/data/memory-tree-node.md (layer=project)
---

# memory-tree-worker · episode → project

## 用途
判定 episode 归属于哪个 L3 project（用户长期主题）。
同样用于 M1 的灵感卡片自动归属。

⚠️ scene 已升到 L4，不在本 prompt 范围（由 `project-to-scene.md` 处理）。

## 输入契约
```typescript
{
  episode: {
    id: string,
    title: string,
    text: string,                  // 两段结构
    time_range: string,
    entity_ids: string[]
  },
  existing_projects: Array<{
    id: string,
    title: string,                 // ≤ 8 字 project 名（display 用）
    text: string,                  // 两段结构（第一段=简介，第二段=详细 search 描述）
    entity_ids: string[],
    recent_episode_titles: string[]
  }>,
  user_recent_corrections: Array<{
    episode_id: string,
    wrong_project_id: string,
    correct_project_id: string
  }>
}
```

## 输出契约（v3 对齐后端 — 零新字段）
```typescript
{
  primary_project_id: string | null,
  primary_confidence: number,       // 0-1
  candidates: Array<{ project_id, confidence, reason }>,  // top 3
  needs_user_choice: boolean,       // confidence < 0.6 时 true
  suggest_create_new: {             // 全部候选 < 0.4 时
    title: string,                  // ≤ 8 字 "个人健康"
    text: string,                   // 两段结构（第一段=简介 ≤ 30 字, 第二段=详细给后续匹配用）
    reason: string,
  } | null,
  schema_version: 1,
}
```

## System Prompt

> 你是 Memory 树的项目归属判定器。把 episode 归到对的 project。
>
> ⚠️ scene 已升到 L4，不在本 prompt 范围。本 prompt 只判定 project。
>
> 【判定维度（权重 0.4 / 0.2 / 0.4）】
> - 实体重合度：episode.entities ∩ project.entities / project.entities
> - 时间相邻度：episode 时间 vs project 最近 episodes 时间
> - 主题相似度：基于 episode.text 与 project.text 的语义相似
>
> 【confidence 阈值】
> - < 0.6 → needs_user_choice=true（M1 灵感卡上显示"请确认归属"）
> - 全部候选 < 0.4 → suggest_create_new
>
> 【用户校正学习】
> - 用户最近 5 次校正过的 project，权重 +0.15（针对相似 episode）
>
> 【新建 project 时】
> - title ≤ 8 字（"个人健康"），人话不要行话
> - text 两段：第一段 ≤ 30 字 简介给用户看；第二段 详细 search 内容给后续 episode 归属时做参考

## 决策规则
- 实体重合 + 时间相邻 + 主题相关三个维度，权重 0.4 / 0.2 / 0.4
- confidence < 0.6 → needs_user_choice=true
- 全部 < 0.4 → suggest_create_new
- 用户最近 5 次校正过的项目，权重 +0.15

## Few-shot

### Example 1：高置信度（直接归到主项目）

**Input**:
```json
{
  "episode": {
    "id": "ep_5_3_dev",
    "title": "5/3 续航优化",
    "text": "硬件 + 招聘 + 设计\n\n续航 38h vs 50h 目标，林啸提议 BLE 心率 1Hz→0.2Hz 省 18%",
    "time_range": "2026-05-03 09:00~10:00",
    "entity_ids": ["林啸", "续航", "BLE"]
  },
  "existing_projects": [
    { "id": "proj_ring_v1", "title": "Ring v1 硬件", "text": "硬件 MVP\n\n硬件 MVP 开发", "entity_ids": ["林啸", "续航", "BLE", "心率", "电池"], "recent_episode_titles": ["5/2 BLE 协议讨论", "5/1 电池选型"] },
    { "id": "proj_app", "title": "iOS App", "text": "App 开发\n\nApp 主体功能", "entity_ids": ["林啸", "SwiftUI"], "recent_episode_titles": ["5/2 录音页 review"] },
    { "id": "proj_growth", "title": "GTM", "text": "推广\n\n增长团队", "entity_ids": ["Prima", "Shihui"], "recent_episode_titles": [] }
  ],
  "user_recent_corrections": []
}
```

**Output**:
```json
{
  "primary_project_id": "proj_ring_v1",
  "primary_confidence": 0.91,
  "candidates": [
    { "project_id": "proj_ring_v1", "confidence": 0.91, "reason": "实体 100% 重合（林啸/续航/BLE），主题=硬件续航迭代，与 5/2 BLE 讨论强连续" },
    { "project_id": "proj_app", "confidence": 0.22, "reason": "仅\"林啸\"重合，主题不匹配（App 不是硬件）" },
    { "project_id": "proj_growth", "confidence": 0.04, "reason": "无实体重合，主题完全不同" }
  ],
  "needs_user_choice": false,
  "suggest_create_new": null,
  "schema_version": 1
}
```

---

### Example 2：低置信度（需用户确认）

**Input**:
```json
{
  "episode": {
    "id": "ep_idea_mood",
    "title": "心情快照灵感",
    "text": "用戒指按一下记录此刻感觉\n\n戒指主动按一下记录此刻感觉",
    "entity_ids": ["心情快照", "戒指交互"]
  },
  "existing_projects": [
    { "id": "proj_ring_v1", "title": "Ring v1 硬件", "text": "硬件 MVP\n\n硬件 MVP", "entity_ids": ["林啸", "BLE", "电池"], "recent_episode_titles": ["5/3 续航优化"] },
    { "id": "proj_v2_planning", "title": "Ring v2 规划", "text": "v2 形态\n\nv2 形态探索", "entity_ids": ["v2", "形态", "交互"], "recent_episode_titles": ["4/28 v2 brainstorm"] }
  ],
  "user_recent_corrections": []
}
```

**Output**:
```json
{
  "primary_project_id": "proj_v2_planning",
  "primary_confidence": 0.52,
  "candidates": [
    { "project_id": "proj_v2_planning", "confidence": 0.52, "reason": "主题=新交互形态，与 v2 brainstorm 相邻；但实体名仅\"交互\"近似重合" },
    { "project_id": "proj_ring_v1", "confidence": 0.31, "reason": "戒指主题相关，但 v1 形态/交互已锁定，新增按键不在 v1 范围" }
  ],
  "needs_user_choice": true,
  "suggest_create_new": null,
  "schema_version": 1
}
```

---

### Example 3：建议新建 project（所有候选 < 0.4）

**Input**:
```json
{
  "episode": {
    "id": "ep_running_start",
    "title": "5/3 开始晨跑",
    "text": "每天早 6:30 跑 3km\n\n明明决定 5/3 起每天 6:30 跑 3km",
    "entity_ids": ["晨跑", "健康"]
  },
  "existing_projects": [
    { "id": "proj_ring_v1", "title": "Ring v1 硬件", "text": "硬件\n\n硬件", "entity_ids": ["林啸", "BLE"], "recent_episode_titles": [] },
    { "id": "proj_growth", "title": "GTM", "text": "推广\n\n推广", "entity_ids": ["Prima"], "recent_episode_titles": [] }
  ],
  "user_recent_corrections": []
}
```

**Output**:
```json
{
  "primary_project_id": null,
  "primary_confidence": 0,
  "candidates": [
    { "project_id": "proj_ring_v1", "confidence": 0.08, "reason": "勉强相关：戒指可记录运动，但主题不对" },
    { "project_id": "proj_growth", "confidence": 0.02, "reason": "无关" }
  ],
  "needs_user_choice": false,
  "suggest_create_new": {
    "title": "个人健康",
    "text": "晨跑/运动/饮食习惯跟踪\n\n明明的个人健康习惯跟踪：晨跑、运动、饮食。从 5/3 起每天 6:30 跑 3km 起步。",
    "reason": "晨跑/健康主题在已有 project 中无承载，建议新建 Life-scope 独立 project 跟踪长期习惯"
  },
  "schema_version": 1
}
```

---

### Example 4：用户校正历史影响判定

**Input**:
```json
{
  "episode": {
    "id": "ep_5_4_review",
    "title": "5/4 设计稿 v3 review",
    "text": "Sean v3 设计稿，明明反馈密度过高\n\nSean 出第三轮 Memory tab 设计稿，明明反馈信息密度过高",
    "entity_ids": ["Sean", "设计", "v3"]
  },
  "existing_projects": [
    { "id": "proj_app", "title": "iOS App", "text": "App\n\nApp 设计 + 实现", "entity_ids": ["Sean", "SwiftUI", "设计"], "recent_episode_titles": ["5/3 设计稿 review", "5/2 录音页 review"] },
    { "id": "proj_ring_v1", "title": "Ring v1 硬件", "text": "硬件\n\n硬件 MVP", "entity_ids": ["Sean", "硬件", "电池"], "recent_episode_titles": [] }
  ],
  "user_recent_corrections": [
    { "episode_id": "ep_5_3_review", "wrong_project_id": "proj_ring_v1", "correct_project_id": "proj_app" }
  ]
}
```

**Output**:
```json
{
  "primary_project_id": "proj_app",
  "primary_confidence": 0.86,
  "candidates": [
    { "project_id": "proj_app", "confidence": 0.86, "reason": "实体重合（Sean/设计），主题连续（5/3 同类 episode），用户最近校正过同类 → +0.15 加权" },
    { "project_id": "proj_ring_v1", "confidence": 0.18, "reason": "Sean 也参与硬件，但本次 episode 是设计稿不是硬件" }
  ],
  "needs_user_choice": false,
  "suggest_create_new": null,
  "schema_version": 1
}
```

---

### Example 5：候选打平（tie-break）

**Input**:
```json
{
  "episode": {
    "id": "ep_5_4_lin_chat",
    "title": "5/4 和林啸聊未来 1 年",
    "text": "硬件 v2 + iOS 架构\n\n林啸聊未来 1 年方向：硬件 v2 路线 + iOS 架构",
    "entity_ids": ["林啸", "v2", "iOS"]
  },
  "existing_projects": [
    { "id": "proj_ring_v1", "title": "Ring v1 硬件", "text": "硬件\n\n硬件", "entity_ids": ["林啸", "硬件"], "recent_episode_titles": ["5/3 续航讨论"] },
    { "id": "proj_v2_planning", "title": "Ring v2 规划", "text": "v2\n\nv2 探索", "entity_ids": ["林啸", "v2"], "recent_episode_titles": ["4/28 v2 brainstorm"] },
    { "id": "proj_app", "title": "iOS App", "text": "App\n\nApp", "entity_ids": ["林啸", "iOS"], "recent_episode_titles": ["5/2 录音页 review"] }
  ],
  "user_recent_corrections": []
}
```

**Output**:
```json
{
  "primary_project_id": "proj_v2_planning",
  "primary_confidence": 0.58,
  "candidates": [
    { "project_id": "proj_v2_planning", "confidence": 0.58, "reason": "v2 路线明确提到，主题是未来方向" },
    { "project_id": "proj_app", "confidence": 0.55, "reason": "iOS 架构是核心讨论点之一" },
    { "project_id": "proj_ring_v1", "confidence": 0.32, "reason": "提到硬件但是 v2 不是 v1" }
  ],
  "needs_user_choice": true,
  "suggest_create_new": null,
  "schema_version": 1
}
```

## 边界
- 没有 existing_projects → suggest_create_new
- 多个 candidate 平分 → tie-break by 用户最近活跃 project

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): suggest_create_new 拆 display_name + search_definition — **已废弃**
- **v3 (2026-05-06): 对齐后端 — 用 title + text 两段结构**

## Eval
见 `eval/episode-to-project-fixtures.md`
