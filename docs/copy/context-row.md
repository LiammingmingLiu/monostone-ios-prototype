---
type: copy
category: context-row
related-issue: MON-16
related-spec: docs/features/M2-agent-tasks-and-timeline.md §4.1.3
---

# CommandDetailView · 上下文行文案库

> 用在 CommandDetailView §C 上下文 section。每行一个 source，最多显示 4 行。

## 通用规则

- **标题**：≤ 10 字，只说"这是什么事"，不暴露原始 entity name
- **右侧 .src 文本**：固定模板，不带相对时间。"卡片 vs Memory" 的区分**完全靠 .src 文本承载** —— 卡片类显示具体子信息，Memory 类固定显示 `Memory`
- **不再有左侧彩色 chip**（V2.1 砍掉，2026-05-03 二次拍板）
- 超过 4 项 → 第 4 行下方居中 `… 还有 {N} 项 ›`，点击进 fullscreen 全部上下文 sheet

## 卡片类（来自用户已有 timeline 卡）

| 子类 | 标题模板 | 右侧 .src |
|---|---|---|
| 长录音 | `{长录音简短主题}` | `{N} 分钟录音` |
| 指令 | `{指令简短主题}` | `指令` |
| 灵感 | `{灵感简短主题}` | `灵感` |
| 待办 | `{待办简短主题}` | `待办` |

**示例**：
- `今早 Series A 跟进会` · `42 分钟录音`
- `Sandbar 跟进研究` · `指令`
- `Memory 模块讨论` · `指令`
- `周五 1on1` · `待办`

## Memory 类（Preference / 人际关系 / MCP 外部数据，统一一类）

| 子类 | 标题模板 | 右侧 .src |
|---|---|---|
| Preference | `{Agent 自动生成简短描述，不含"偏好"两字}` | `Memory` |
| 人际关系 | `{Agent 自动生成简短描述，不含人名}` | `Memory` |
| MCP 外部数据（邮件 / 日历 / Notion 等整合到 Memory） | `{Agent 自动生成简短描述}` | `Memory` |

**示例**（Memory 标题由 Agent 生成，要让用户秒懂"系统在用什么帮你"）：
- `敦敏的投资人档案` · `Memory`
- `你的邮件语气` · `Memory`
- `Series A 邮件线程` · `Memory`
- `本周日历` · `Memory`
- `林啸的工作时间偏好` · `Memory`
- `竞品融资数据` · `Memory`

## 反例（**不要这样写**）

- ❌ `Preference: communication_tone` → 暴露字段名
- ❌ `Person: 敦敏（敦敏 · Linear Capital）` → 暴露 entity 类型
- ❌ `MCP: gmail.thread.20240502...` → 暴露技术细节
- ❌ `偏好：邮件语气`→ 不需要"偏好"前缀
- ❌ `今早 Series A 跟进会 · 42 分钟录音 · 2 小时前` → 不要相对时间

## 省略行文案

| 项数 | 文案 | 行为 |
|---|---|---|
| ≤ 4 | — | 全列出 |
| 5-99 | `… 还有 {N-4} 项 ›` | 居中浅色，点击 → fullscreen sheet |
| 100+ | `… 还有 99+ 项 ›` | 同上 |

## 后端依赖

- 需要 `task.contexts[].display_title` — Agent 生成的简短人话标题
- 需要 `task.contexts[].source_type: "card" | "memory"` — 决定 chip
- 需要 `task.contexts[].card_subtype: "rec" | "cmd" | "idea" | "todo"` —— 仅 source_type=card 时用，决定副信息
- 需要 `task.contexts[].duration_minutes` — 仅 card_subtype=rec 时用
