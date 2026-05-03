# ux0.5 Issue 工作 Session Prompt

> **用途**：复制下面 `## 粘贴到新 session ↓` 之后的全部内容到新 Claude Code session，新 session 立即能接手做 Linear ux0.5 issue。

---

## 粘贴到新 session ↓

我是 Mingming（Monostone CEO），现在在做 Monostone ux0.5（产品契约 + UX 简化重设计）。我写 spec + UX 决策，林啸是唯一前后端开发，vibecoding 实现。

**你的任务**：和我一起一个一个做完 Linear ux0.5 项目里的 issue。每个 issue 走固定 7 步 checklist。

---

### 项目背景（你的 memory 应该已有，简要复述）

- **Monostone**：AI 戒指 + 个人 AI memory 系统
- **林啸**：唯一开发，前后端一人扛（Wang Hao 已离开）
- **后端审计**：`MONOSTONE_BACKEND_MODULE_INTERFACE_CALL_REPORT.md`（2026-04-27），所有命名以这个为准
- **核心规则**：**零后端改动原则** — 默认前端单边搞定；要改后端必须主动告知 (a) 哪改 (b) 怎么改

### 三个仓库 + 部署

| 仓库 | 路径 | 用途 |
|---|---|---|
| **monostone-ios-prototype** (Public) | `/Users/mingmingliu/.openclaw/workspace/monostone-ios-prototype/` | docs/ spec + 原版 HTML，**林啸读这里** |
| **monostone-ux05** (Private) | `/Users/mingmingliu/.openclaw/workspace/monostone-ux05/` | 极简版 HTML，git push → vercel 自动部署 https://monostone-ux05.vercel.app |
| **monostone-app** (Private, 只读参考) | `/Users/mingmingliu/.openclaw/workspace/monostone-app/` | 林啸的 SwiftUI 实现，需要时看 |

### git 配置（已设过，但万一新 repo 时）

```bash
git config user.email "mingmingerliye@gmail.com"
git config user.name "Mingming Liu"
```
（vercel 部署要求 commit author = vercel 验证邮箱，不能用 hostname 自动生成的）

### 5 类文件结构（在 prototype/docs/ 下）

- `features/M{1-4}-*.md` — milestone 级总 spec（林啸 vibecoding 时 `@` 进 context）
- `data/*.md` — Swift Codable ↔ backend JSON 字段契约
- `copy/*.md` — toast / empty-state / error 文案库
- `prompts/{llm-worker, memory-tree-worker, agent-orchestrator}/*.md` — 后端 prompt 全文
- `screenshots/` — prototype 截图

### Linear 当前状态

- **Project**: [Monostone ux0.5](https://linear.app/monostone/project/monostone-ux05-a0fd194c1938)
- **MCP 已连**: 用 `mcp__29f4ad9e-240a-42c9-839b-1c6a7e54d3dd__*` 工具（先 `ToolSearch select:...` load schema）
- **Linear user**: 刘明明 (`c85a01e8-ce82-46a4-8d31-e3ededb05e17`)
- **Status IDs**:
  - Done: `ab7cdad7-51ed-4e69-bb1b-69d002c6ee3e`
  - In Progress: `a16c70dc-6505-4f3e-8db5-08cc083a77a9`
  - Canceled: `570c0432-6a11-48ab-9a4e-4c8c5a29d3fd`
  - Backlog: `89784d93-fb3a-4d1d-8501-5d6092f495b4`

### 16 个 active issues（截至 session 创建时）

| Milestone | Deadline | 已 Done | 待做 |
|---|---|---|---|
| M1 长录音+灵感 | 5/3 | MON-32 | MON-9, 10, 12, 14, 15, 33 |
| M2 Agent+Todo | 5/4 | — | MON-16, 17, 18, 19, 20, 21, 34 |
| M3 Memory prompt | 5/5 | — | MON-5, 6, 7, 8 |
| M4 Plugin 平台 | 5/6 | — | MON-27, 28 |

具体 issue 内容用 `mcp__29f4ad9e-240a-42c9-839b-1c6a7e54d3dd__get_issue` 拉。

---

## 工作模式（每个 issue 必走）

### Phase 1：load 上下文 + 输出决策清单
我说"做 MON-X"时，你：
1. `get_issue MON-X` 拿 description
2. 找 prototype HTML 里对应屏（grep `id="s3"` 等）
3. 找 monostone-app 里对应 SwiftUI view（参考实现）
4. 找 docs/features/ 对应 spec 文件 + 章节
5. **不动手**，输出"待决策清单 + 我推荐"，比如：
```
MON-X 待决策清单（共 N 个决策点）
§A. ...
  选项: A. ... / B. ... / C. ...
  推荐: B
§B. ...
  ...
```

### Phase 2：等我拍板
我用 X/Y/Z 三种方式回：
- **X. 全按推荐** → 你直接执行
- **Y. 挑改** → "§A 用 A，§B 改成 ..."
- **Z. 想看变体** → 指定哪个点做 2-3 个对比版本

### Phase 3：执行 7 步 checklist

| # | 动作 | 文件 |
|---|---|---|
| 1 | 改 ux05 HTML | `monostone-ux05/index.html` |
| 2 | 写决策到 spec | `monostone-ios-prototype/docs/features/Mn-*.md` 对应 § |
| 3 | 写文案 | `monostone-ios-prototype/docs/copy/{toast,empty-state,error}.md` |
| 4 | 写后端依赖检查 | spec 里 §X.d 表格 ✅ 零改动 / ⚠️ 需要后端配合 |
| 5 | Linear comment + 标 Done | `save_comment(issueId=MON-X)` + `save_issue(state=Done ID)` |
| 6 | push prototype | `cd .openclaw/workspace/monostone-ios-prototype && git push` |
| 7 | push ux05 | `cd .openclaw/workspace/monostone-ux05 && git push`（vercel 自动部署） |

每个 issue 完成后给我简短报告（不要长篇）：
```
✅ MON-X Done
- HTML 改: ...
- Spec 写到: docs/features/...
- 后端影响: ✅ 零改动 / ⚠️ 需要 X
- Linear comment + status: Done
```

---

## 严格规则（必须遵守）

1. **零后端改动**：每个改动先自检。要改后端必须主动告知 (a) 哪个 service / endpoint / schema (b) 怎么改，并给出前端 fallback 避免改后端
2. **命名严格对齐 backend report**：用 `multimodal-ingestion-service` 不用 `recording-service`；用 `/recordings/{id}/understanding` 不用 `/v1/cards/...`
3. **不要在 chat 里返回 HTML 内容**：直接改文件 + push
4. **不要提"preview panel"**：用户不看
5. **不要等用户确认每一步**：Phase 2 拍板后直接跑完 7 步
6. **commit message 用 HEREDOC**：避免特殊字符问题
7. **绝对路径**：所有 `cd` 用绝对路径
8. **memory 优先**：检查 `~/.claude/projects/-Users-mingmingliu--openclaw-workspace/memory/` 已有规则
9. **极简哲学**：UX 决策默认走 Claude 风极简（删除胜过添加）
10. **mock data**：ux05 prototype 数据可以用 mock，HTML 里直接编也行

---

## 视觉规范（已锁定 by MON-32）

ux05 用暖米白配色（参考 Claude）：

```css
:root {
  --bg: #faf9f5;             /* 暖米白主背景 */
  --phone-bg: #faf9f5;
  --panel: #ffffff;          /* 卡片纯白 */
  --text: #2c2825;           /* 暖深褐 */
  --text-2: #4a4540;
  --text-dim: #8b8676;
  --text-dimmer: #a8a399;
  --border: rgba(0,0,0,0.06);
  --accent: #c96442;         /* Claude 橙 */
  --red: #d4574a;
}
```

- 桌面外圈背景: `#f0ede5`
- 手机框边: 浅灰 `#d8d4ca`
- tabbar: `rgba(250,249,245,0.92)` + blur

详细见 `docs/features/M1-recording-and-multimodal.md` §4.0。

---

## 现在请做的事

**直接告诉我"开始 MON-X"开始下一个 issue**。比如：

> 开始 MON-33 LongRecordingView FAB 录音中

你就立即进入 Phase 1。

如果我说"批量"或者"continue"，按 milestone 顺序自动跑（M1 → M2 → M3 → M4），每个 issue 做完用 X 默认推荐继续下一个，除非有 ⚠️ 后端改动需要我决定。

---

## 粘贴到新 session ↑
