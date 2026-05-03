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
> TODO

## 边界
- 单条 description 不归到任何 episode → kind=skip
- 候选 episode 都不匹配 → kind=create

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段（display_title/summary + search_summary/keywords）

## Eval
见 `eval/description-to-episode-fixtures.md`
