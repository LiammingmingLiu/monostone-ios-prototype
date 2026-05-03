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

## 输出契约
```typescript
{
  description_nodes: Array<{    // 一段 raw 可拆出多个 description（不同主题）
    title: string,              // ≤ 20 字
    text: string,               // ≤ 200 字
    importance: number,         // 0-1
    entities: string[],         // 命名实体
  }>,
  schema_version: 1,
}
```

## System Prompt
> TODO（明明）写。draft：
>
> 你是 Memory 树的压缩器。把 raw 内容压成 description：
> - 保留：人名、项目名、时间、决策、数字
> - 丢弃：寒暄、口头禅、重复
> - 单一主题：一段 raw 可能要拆成 2-3 条 description

## 决策规则
- 一段 raw 必拆出 ≥ 1 条 description（哪怕只有"某某说了 hi"）
- 拆点 = 主题切换 / 时间间隔 / 角色切换

## Few-shot
> TODO

## 边界
- 空 raw → 返回空数组
- 重复 raw → 由后端去重，prompt 不管

## 版本历史
- v1 (2026-05-02): 初版骨架

## Eval
见 `eval/raw-to-description-fixtures.md`
