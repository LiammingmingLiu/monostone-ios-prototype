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
> TODO

## 边界
- 单个 evidence 不能 add → 暂存 candidates_pending
- profile 字段达到上限 → 触发 prune（弱 evidence 优先）

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段 (display_phrase + search_text)；明确 5 类敏感信息硬黑名单；scene 是 L4

## Eval
见 `eval/user-profile-extractor-fixtures.md`
