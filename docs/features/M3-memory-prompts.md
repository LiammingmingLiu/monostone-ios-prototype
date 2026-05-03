---
milestone: M3
deadline: 2026-05-05
status: draft
backend-services:
  - memory-tree-worker（节点物化）
  - llm-worker（summary / understanding / recording-mode 分流）
  - agent-orchestrator-service（query router / retrieval policy / context packaging / timeline reasoner / pattern reasoner）
  - memory-api（write/read API 不变）
linear-issues: [MON-5, MON-6, MON-7, MON-8, MON-23, MON-24]
---

# M3 · Memory 存入和 fetch 的 prompt

> 这是 ux0.5 最关键的一份 spec，决定"用户记忆树长什么样"。林啸 vibecoding 时改的是后端 `memory-tree-worker` / `llm-worker` / `agent-orchestrator-service` 的 prompt 文件，iOS 几乎不需要改（除非字段变更）。

## 1. Milestone 范围

**包含 5 类 prompt**
1. **memory-tree-worker 节点物化** — `raw → description → episode → project / scene → user_profile`（5 个 prompt 文件）
2. **llm-worker 录音理解** — summary / understanding / recording-mode-router（3 个）
3. **agent dialogue 写回** — Agent 跟用户聊完后写回 memory（1 个）
4. **agent memory fetch pipeline** — query router / retrieval policy / context packaging / timeline reasoner / pattern reasoner（5 个）
5. **prompt 工程化** — evaluation set + 版本化/灰度/回滚（2 个 issue）

**不包含**
- iOS UI 变更（prompt 改不影响 UI 字段，schema 不动）
- 全新 memory 功能（只是 prompt 质量，不动数据模型）

## 2. Backend 模块对齐

### memory-tree-worker（节点物化）
- 代码路径：`services/memory/memory_tree_worker`
- Trigger：`MEMORY_TREE_EVENTS_QUEUE_URL`
- 受 `ENABLE_MEMORY_TREE_WORKER` / `ENABLE_MEMORY_TREE_RECOMPUTE` / `ENABLE_MEMORY_TREE_BACKFILL` / `ENABLE_MEMORY_TREE_STRUCTURE_V2` 控制
- 调 LLM：`MEMORY_LLM_PROVIDER`, `MEMORY_LLM_MODEL`
- 调外部：`plugin-runtime-service`（节点物化插件）, `model-settings-service`（模型路由）
- artifact: `MEMORY_TREE_S3_PREFIX`

### llm-worker（录音理解）
- 代码路径：`services/llm/llm-worker`（推断）
- Trigger：`LLM_EVENTS_QUEUE_URL`
- 调 LLM：`ANTHROPIC_API_KEY` / `QWEN_API_KEY` / `RELAY_API_KEY`
- 路由：`MODEL_SETTINGS_BASE_URL`（按 task 选模型）
- 输出：`UNDERSTANDING_READY_SNS_TOPIC_ARN`

### agent-orchestrator-service（fetch + writeback）
- Backend 已有相关 env：
  - `AGENT_QUERY_ROUTER_*`
  - `ENABLE_AGENT_INTELLIGENT_RETRIEVAL_POLICY_V25`
  - `AGENT_INTELLIGENT_RETRIEVAL_POLICY_MODE`
  - `AGENT_CONTEXT_PACKAGING_*`
  - `AGENT_TIMELINE_REASONING_*`
  - `AGENT_PATTERN_REASONING_*`
  - `AGENT_WRITEBACK_MEMORY_ENABLED`
  - `ENABLE_MEMORY_TREE_AGENT_DIALOGUE_WRITEBACK`
  - `AGENT_DIALOGUE_RECALL_ENABLED`
- 这些 env 名告诉我们 prompt pipeline 已经分模块化，spec 文件按这个粒度对齐

## 3. Prompt 清单（→ docs/prompts/）

| 类别 | 文件 | Linear |
|---|---|---|
| memory-tree-worker | `prompts/memory-tree-worker/raw-to-description.md` | MON-5 |
| memory-tree-worker | `prompts/memory-tree-worker/description-to-episode.md` | MON-5 |
| memory-tree-worker | `prompts/memory-tree-worker/episode-to-project.md` | MON-5 |
| memory-tree-worker | `prompts/memory-tree-worker/episode-to-scene.md` | MON-5 |
| memory-tree-worker | `prompts/memory-tree-worker/user-profile-extractor.md` | MON-5 |
| llm-worker | `prompts/llm-worker/summary-prompt.md` | MON-6 |
| llm-worker | `prompts/llm-worker/understanding-prompt.md` | MON-6 |
| llm-worker | `prompts/llm-worker/recording-mode-router.md` | MON-6 |
| agent-orchestrator | `prompts/agent-orchestrator/dialogue-writeback.md` | MON-7 |
| agent-orchestrator | `prompts/agent-orchestrator/query-router.md` | MON-8 |
| agent-orchestrator | `prompts/agent-orchestrator/retrieval-policy.md` | MON-8 |
| agent-orchestrator | `prompts/agent-orchestrator/context-packaging.md` | MON-8 |
| agent-orchestrator | `prompts/agent-orchestrator/timeline-reasoning.md` | MON-8 |
| agent-orchestrator | `prompts/agent-orchestrator/pattern-reasoning.md` | MON-8 |

## 4. Eval set + 版本化

- `docs/prompts/README.md` 描述每个 prompt 文件必含的 eval section
- MON-23: 建立 fixture 库 + 跑法 + 阈值
- MON-24: 版本号 + 灰度 + 回滚机制

## 5. Acceptance

- [ ] 14 个 prompt 文件每个都包含: 用途 / 输入契约 / 输出契约 / system prompt / few-shot / 边界 / 版本
- [ ] 至少 10 条 fixture，跑通 eval 脚本
- [ ] 每个 prompt 的输出 schema 在 `docs/data/memory-tree-node.md` 或 `card-recording.md` 有对应字段
