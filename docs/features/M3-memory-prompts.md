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

## 1.1 数据流时序：从录音到 memory 物化（M1 ↔ M3 衔接）

> **写这段的原因**：M1 spec 只写到"录音 done"，M3 只写"prompt 清单"，中间"录音 done → memory 物化怎么触发"的链路一直散落在 backend report 里。林啸 / iOS 端读 spec 时不应该需要去翻 backend 代码才能拼出全图。

```
[长录音 / 短录音]                                          (M1 spec)
   │  iOS POST /multimodal/inputs (audio 上传 S3)
   ▼
[multimodal-ingestion-service]                            (M1 spec)
   │  发 BATCH_ASR_QUEUE_URL
   ▼
[batch-asr-worker]                                        (M1 spec)
   │  转写完成 → 发 LLM_EVENTS_QUEUE_URL
   ▼
[llm-worker]                                              (M3 prompt §3 llm-worker/)
   │  跑 understanding-prompt + summary-prompt + recording-mode-router
   │  写 understanding artifact → 发 UNDERSTANDING_READY_SNS_TOPIC_ARN
   ▼
[post-recording-coordinator]                              (M2 spec §5.2 — 短录音分流)
   │
   ├─→ 短录音: 按 mode 分流到 timeline-service / agent-orchestrator    (M2 spec)
   │
   └─→ 同时（不分长短）: 发 MEMORY_TREE_EVENTS_QUEUE_URL              ← 这里是 M1 ↔ M3 衔接点
       │
       ▼
   [memory-tree-worker]                                   (M3 prompt §3 memory-tree-worker/)
       跑 5 个节点物化 prompt:
       raw → description → episode → project / scene → user_profile
       │
       ▼
   [memory-api]                                           (M3 prompt §3 — fetch 侧)
       memory tree 入库, agent-orchestrator 后续可 fetch
```

### 1.1.1 关键澄清

| 问题 | 答案 |
|---|---|
| **memory 物化什么时候触发？** | `post-recording-coordinator` 在 understanding artifact 落地后**同时**发：(1) timeline event（M2 链路）+ (2) MEMORY_TREE_EVENTS_QUEUE_URL（M3 链路）。两条链路并行，不阻塞 |
| **iOS 卡片何时变 done？** | iOS 收到 `understanding-service` 200 → 卡片切 done 状态。**不等 memory 物化完**——memory 是后台异步事，用户感知不到 |
| **memory 物化失败会影响 UI 吗？** | 不影响。memory tree 是"后台累积"，失败重试在 worker 层处理；iOS 端没有 "memory 物化失败" 的 toast / 错误态 |
| **agent fetch memory 时新录音可能还没物化怎么办？** | retrieval-policy 跳过未物化节点（见 MON-8 prompt）。延迟最长一个 batch 周期，对用户回答影响 < 1% case |
| **链路谁配？** | 整条链路在 backend 已经存在（`MEMORY_TREE_EVENTS_QUEUE_URL` env 已配）。林啸只需 verify `post-recording-coordinator` 是否真的"同时"发两条 event；如果它现在只发 timeline event，需要补上 memory queue 一条 |

> ⚠️ **林啸 verify** 的事：`post-recording-coordinator` 发 MEMORY_TREE_EVENTS_QUEUE_URL 这条链是否已经在跑？ux0.5 spec 假设它已经在跑。如果没在跑，这是 v0.5 上线前的 backend 阻塞项。

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
