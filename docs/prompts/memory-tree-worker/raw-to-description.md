---
name: memory-tree-raw-to-description
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
backend-service: memory-tree-worker
backend-trigger: MEMORY_TREE_EVENTS_QUEUE_URL
backend-env-flag: ENABLE_MEMORY_TREE_WORKER
related-issue: MON-5
related-data-schema: docs/data/memory-tree-node.md (layer=description)
---

# memory-tree-worker · raw → description

## 用途
把 L0 raw 节点（一段原始转写、一段文件内容）压缩成 L1 description：可检索、单一主题、保留关键事实。

## 输入契约
```typescript
{
  raw_node_id: string,
  raw_text: string,
  source_recording_id: string | null,
  source_metadata: { duration_seconds?, recorded_at?, file_type? },
  user_timezone: string,
}
```

## 输出契约（v2 双视角）
```typescript
{
  description_nodes: Array<{    // 一段 raw 可拆出多个 description（不同主题）
    // ===== display 字段（给用户看，Memory tab UI 渲染）=====
    display_title: string,        // ≤ 12 字，人话简短
    display_summary: string,      // ≤ 30 字，一行扫描

    // ===== search 字段（给 Agent fetch 用，信息密集）=====
    search_text: string,          // ≤ 200 字，保留所有可检索的实体/数字/决策
    search_keywords: string[],    // 实体名 + 主题词 + 时间锚点

    // ===== 元数据 =====
    salience: number,             // 0-1（原 importance 改名）
                                  //   含义：节点的"被检索价值"分数（Agent 视角）
                                  //   不是用户感知重要度
                                  //   规则：信息密度 0.6 + 用户情绪信号 0.4
    entities: string[],           // 命名实体（人/项目/地点/时间）
  }>,
  schema_version: 2,
}
```

## System Prompt
> TODO（明明 v2）。draft 已升级为双视角：
>
> 你是 Memory 树的压缩器。把 raw 内容压成 description。
> 输出每条 description 必须同时给出两套字段：
>
> 【display 字段 — 给用户翻看 Memory 时一眼能扫】
> - display_title (≤ 12 字)：人话短标题，避免缩略 / 行话
>   ✓ "续航讨论"
>   ✗ "BLE 1Hz→0.2Hz 心率上报频率优化方案"
> - display_summary (≤ 30 字)：一句话讲清主题，温和、人感、不丢上下文
>
> 【search 字段 — 给 Agent fetch 时检索】
> - search_text (≤ 200 字)：保留所有可检索的实体、数字、决策、时间
>   不需要"好读"，需要"找得到"
> - search_keywords：实体 + 主题词 + 时间锚点 + 数字关键值
>
> 【salience 评分 rubric (0-1)】
> - 信息密度 (权重 0.6)：含数字/决策/命名实体 → +0.1~0.4 each
> - 情绪信号 (权重 0.4)：用户表达"我决定/我不喜欢/重要的是" → +0.2~0.4
> - 寒暄/重复 → 0~0.1
>
> ⚠️ salience ≠ "对用户重要"，是"Agent 检索时值不值得装进 context window"
>
> 【保留】人名、项目名、时间、决策、数字、用户主观判断
> 【丢弃】寒暄、口头禅（"嗯/那个/然后"）、冗余修饰、重复表达
> 【拆点】主题切换 / 时间间隔 / 角色切换 → 拆成多个 description

## 决策规则
- 一段 raw 必拆出 ≥ 1 条 description
- 拆点 = 主题切换 / 时间间隔 / 角色切换
- display_title 和 search_text 是同一节点的两个面，不要 display 写一个意思 search 写另一个意思
- 用户编辑 display_title 后系统不重新压缩 search_text（最小改动原则，Q3 选 A）

## Few-shot
> TODO

## 边界
- 空 raw → 返回空数组
- 重复 raw → 由后端去重，prompt 不管

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段（display vs search）+ salience 改名 + 详细 rubric

## Eval
见 `eval/raw-to-description-fixtures.md`
