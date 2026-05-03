---
type: prompt-index
audience: 林啸（vibecoding 改 monostone_backend prompt）
authority: 这里的 prompt 是后端代码 import 的真实 artifact，不只是文档
---

# Prompts

## 这个目录是干什么的

后端 LLM call 的 system prompt 全部在这里。**不是说明文档 — 是可执行 artifact**。

- 每个 .md 文件 = 一个 prompt = 后端 import 一份
- 改 prompt = 改这里 = 触发 eval = 决定灰度 / 上线
- 林啸在 monostone_backend 写代码时，用 `pathlib.Path(__file__).parent / "prompts" / "..."` 之类的方式 load 这些 .md 的"## System Prompt" 小节

## 目录结构（对齐 backend 模块）

```
prompts/
├── README.md                              ← 本文件
├── llm-worker/                            ← 对齐 services/llm/llm-worker
│   ├── summary-prompt.md                  ← MON-6
│   ├── understanding-prompt.md            ← MON-6
│   └── recording-mode-router.md           ← MON-6 + M2 短录音分类
│
├── memory-tree-worker/                    ← 对齐 services/memory/memory_tree_worker
│   ├── raw-to-description.md              ← MON-5
│   ├── description-to-episode.md          ← MON-5
│   ├── episode-to-project.md              ← MON-5
│   ├── episode-to-scene.md                ← MON-5
│   └── user-profile-extractor.md          ← MON-5
│
└── agent-orchestrator/                    ← 对齐 services/agent/agent-orchestrator-service
    ├── query-router.md                    ← MON-8 / AGENT_QUERY_ROUTER_*
    ├── retrieval-policy.md                ← MON-8 / ENABLE_AGENT_INTELLIGENT_RETRIEVAL_POLICY_V25
    ├── context-packaging.md               ← MON-8 / AGENT_CONTEXT_PACKAGING_*
    ├── timeline-reasoning.md              ← MON-8 / AGENT_TIMELINE_REASONING_*
    ├── pattern-reasoning.md               ← MON-8 / AGENT_PATTERN_REASONING_*
    └── dialogue-writeback.md              ← MON-7 / ENABLE_MEMORY_TREE_AGENT_DIALOGUE_WRITEBACK
```

## 单个 prompt 文件的标准模板

```markdown
---
name: <kebab-case-name>
version: 1
owner: 明明
status: draft | review | locked
last-updated: 2026-05-02
backend-service: llm-worker | memory-tree-worker | agent-orchestrator-service
backend-env-flag: <如果有控制开关>
related-issue: MON-X
related-data-schema: docs/data/<file>.md
---

# <Prompt 名字>

## 用途
1-2 句话说这个 prompt 解决什么问题。

## 输入契约
\`\`\`typescript
{ ... }  // 调用方传入的字段
\`\`\`

## 输出契约（严格 JSON）
\`\`\`typescript
{ ... }  // 必须是 LLM 输出的字段，给后端 parse
\`\`\`

## System Prompt
> 实际给到 LLM 的 system message 全文

## Few-shot 例子
3-5 条覆盖各种边界

## 决策规则
- confidence < X → 触发 fallback
- 多意图 → ...

## 边界 case
- 空输入 / 中英混合 / 含糊表达 / ...

## 版本历史
- v1 (2026-05-02): 初版

## Eval
见 `eval/<name>-fixtures.md`（M3 MON-23 建立）
```

## 工程化（MON-23 + MON-24）

- **Eval set**: `prompts/eval/` 子目录（M3 阶段建立），fixture + ground truth + 跑法
- **版本化**: 每个 prompt 文件 frontmatter 的 `version` 字段；后端按 version 分桶 / 灰度
- **回滚**: `git revert` 即可，因为 prompt = 文件

## 林啸 vibecoding workflow

1. `@docs/prompts/llm-worker/summary-prompt.md` 进 context
2. 跟 Claude 说"按这个 prompt 实现 llm-worker 的 summary 路由"
3. 改完跑 eval（MON-23 fixture）
4. 提 PR，bump version
