---
type: index
audience: 林啸（唯一开发，前后端 vibecoding）
authority: 这是 monostone-app + monostone_backend 的产品契约层
---

# Feature Specs · 给林啸 vibecoding 的总入口

## 这个目录是干什么的

每个 milestone 一份 spec，**林啸 vibecoding 时直接 `@` 进 context**：

```
@docs/features/M1-recording-and-multimodal.md
@docs/data/card-recording.md
@docs/copy/toast.md
帮我实现 RecordingDetailView 的参与人 section
```

读完一份 feature spec，林啸应该能立刻动手改 monostone-app + monostone_backend 任何一处代码，不需要再回头问明明。

## 命名约定（和 backend 模块对齐）

> 权威源：`MONOSTONE_BACKEND_MODULE_INTERFACE_CALL_REPORT.md`（2026-04-27 审计）

iOS / prototype / Linear / spec 文件 / API 字段 **同一个东西必须同名**。冲突时以 backend report 为准。

| 概念 | 后端权威命名 | 旧术语（要替换） |
|---|---|---|
| 录音入口服务 | `multimodal-ingestion-service` | 不再用 `recording-service`（legacy） |
| 录音公网 path | `/recordings`、`/multimodal/inputs` | 不再用 `/v1/cards`、`/v1/recordings` |
| 录音总结 | `/recordings/{id}/summary`、`understanding-service` | 不再用 "FullSummary" |
| 录音理解 | `/recordings/{id}/understanding` | 后端 `understanding` 字段是权威 |
| Agent 任务 | `/agent/tasks` | 不再用 "Agent thread" / "session" |
| Agent 任务回合 | `POST /agent/tasks/{id}/turn` | 不再用 "message" |
| 时间线事件 | `/timeline/events`、`timeline-service` | 不再用 "feed item" |
| 用户记忆 | `/memory`、`memory-api` | 不再用 "note" |
| Memory 树节点 | `/memory/tree/nodes`、`memory-tree-worker` | 节点类型：`raw / description / episode / project / scene / user_profile` |
| 项目 | `/projects`、`projects-service` | iOS 显示"项目"，字段叫 `project_id` |
| 插件 | `/plugins/products`、`plugin-runtime-service` | 不再用 "extension" / "integration" |
| 插件用户启用 | `/plugins/enablement/me` | 不再用 `/users/me/plugins`（已退役） |
| 插件 OAuth | `/plugins/{id}/oauth/*`、`/plugins/{id}/connections/me/*` | 统一这两组 |
| 录音模式 | `recording_mode`（llm-worker 路由用） | 后端代码字段 |

## Spec 文件结构

每个 `M{n}-*.md` 必须包含这些小节（以 M1 为例）：

1. **Milestone 范围** —— 包含 / 不包含
2. **后端模块对齐** —— 涉及哪些 service / API path / queue / 环境变量
3. **iOS 用户旅程** —— 用户从哪个屏开始，按 prototype `index.html` anchor 引用
4. **页面级 spec** —— 每个 view 的 UI 区块、交互、数据来源、状态机、边界
5. **后端 prompt / 逻辑变更** —— 改 llm-worker / memory-tree-worker / agent-orchestrator-service 哪个 prompt 或路由
6. **API 契约** —— 用 backend 实际 path（不是 `/v1/...`），列字段
7. **文案** —— 引用 `docs/copy/*.md`
8. **Acceptance** —— 可勾选清单

## 4 个 Milestone

| # | 文件 | Backend 模块 | Linear |
|---|---|---|---|
| M1 | [M1-recording-and-multimodal.md](M1-recording-and-multimodal.md) | app-后端链路（multimodal-ingestion / batch-asr-worker / understanding-service / llm-worker / post-recording-coordinator） + memory（消化结果） | MON-9 ~ 15 |
| M2 | [M2-agent-tasks-and-timeline.md](M2-agent-tasks-and-timeline.md) | agent（agent-orchestrator-service）+ app-后端链路（timeline-service）+ plugins（calendar-create-event / email-sender） | MON-16 ~ 22 |
| M3 | [M3-memory-prompts.md](M3-memory-prompts.md) | memory（memory-tree-worker）+ llm-worker + agent retrieval prompts | MON-5 ~ 8, 23, 24 |
| M4 | [M4-plugins-platform.md](M4-plugins-platform.md) | plugins（plugin-runtime-service / plugin-registry-service / first-party catalog） | MON-25 ~ 31 |

## 和原 docs/ 的关系

| 老文件 | 新文件如何使用它 |
|---|---|
| `architecture.md` | 整体架构理解，不动 |
| `data-flow.md` | Memory L0-L4 概念图，不动；但 L0-L4 字段名以 `card-recording.md` + `memory-tree-node.md` 为准 |
| `pages-and-interactions.md` | iOS 页面交互的权威源；feature spec 用 anchor 引用过来 |
| `data-models.md` | TypeScript 实体定义；**字段名要和 backend report 对齐**，旧 `/v1/...` 字段名后续 sweep 一遍 |
| `api-contract.md` | 旧版 `/v1/...` 接口，**已过时**。新 spec 用 backend 实际 path |
| `events-protocol.md` | BLE 协议，不动 |
| `oauth-flows.md` | OAuth 流程；现在 OAuth 由 `plugin-runtime-service` 接管，spec 写新流程时引用 backend report |
| `sharing-spec.md` | 分享规范，不动 |

**待办（明明 sweep）**：把 `data-models.md` / `api-contract.md` 里 `/v1/...` 旧 path 全部对齐到 backend report。这不是 ux0.5 milestone 的事，但林啸如果遇到字段冲突，永远以 backend report 为准。
