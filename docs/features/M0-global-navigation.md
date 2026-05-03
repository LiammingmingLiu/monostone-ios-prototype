---
milestone: M0 (cross-cutting, 挂 M1 milestone)
deadline: 2026-05-03
status: locked
backend-services:
  - timeline-service（Recents 数据来源）
ios-views:
  - 全局影响：RootView 删 TabView，加 Drawer
linear-issue: MON-35
---

# M0 · 全局导航：底部 4 tab → Claude 风左侧抽屉

> 视觉真相: https://monostone-ux05.vercel.app

## 1. 范式

**之前**：底部 4 tab `首页 / 记忆 / Agent / 我`，FAB 录音在右下。

**之后**：左侧抽屉 + navbar 顶部 hamburger button，FAB 不变。

```
┌──────────────────────┐         ┌───────────────────────┐
│ 9:41    📶 📡 [69%]  │         │ 9:41    📶 📡 [69%]   │
├──────────────────────┤         ├───────────────────────┤
│ ☰    首页            │   →     │ Monostone             │
│ ──────────────────── │         │ ─────────             │
│ [card]               │         │ ▣ 首页    ←active     │
│ [card]               │         │ ▢ 记忆                │
│ [card]               │         │ ▢ Agent               │
│ [card]               │         │ ▢ 我                  │
│                      │         │ ─────────             │
│           ⊕ FAB      │         │ 最近                   │
├──────────────────────┤         │ • 和敦敏的 Series A...│
│ 首页 记忆 Agent 我   │   ✗     │ • 帮我起草邮件...      │
└──────────────────────┘         │ • Memory L2→L3...     │
                                 │ • ...                 │
                                 └───────────────────────┘
```

## 2. 抽屉打开方式（任一即可）

1. 左上角 hamburger button（navbar 内）
2. 屏幕左边缘 < 30px 处右滑（touch swipe）
3. 点击主屏内容外的左边缘 → 打开

## 3. 抽屉内容

### 3.a 静态分类（4 项）

| label | iOS 跳转目标 | prototype 屏 |
|---|---|---|
| 首页 | HomeView | `s2` |
| 记忆 | MemoryView | `s8` |
| Agent | AgentView | `s9` |
| 我 | ProfileView | `s10` |

当前选中项 highlight：背景 `rgba(201,100,66,0.08)`，文字 `--accent`。

### 3.b Recents 列表

显示最近 10 张卡片（按 created_at 倒序）。点击直接跳卡片详情页。

**数据来源**: `timeline-service GET /timeline/feed?limit=10`（`?limit` 已存在于 backend report `/timeline` endpoint）

**iOS 实现建议**: 复用 `HomeStore` 的 cards 数组前 10 条，避免重复请求。

### 3.c 没有的元素（极简范式刻意删除）

- ❌ 搜索框（避免触发 search-service 部署，超出 ux0.5 范围）
- ❌ "+ 新建" 按钮（Monostone 主输入是 FAB 录音，不是文字 chat）
- ❌ 用户头像 / settings 入口（这些进 "我" tab）

## 4. Navbar (主屏顶部)

每个 tab 主屏顶部统一 navbar 结构：

```
┌─────────────────────────────────┐
│ ☰        {当前 tab 名}      ··· │
└─────────────────────────────────┘
   hamburger      title         (右占位/未来 filter)
```

- height: 44px
- padding: 0 16px
- title: 16px / 600 weight, 居中
- hamburger: 32x32 button
- right spacer: 32x32（占位，未来可放 filter / search 等）

## 5. FAB 位置变化

| 项 | 之前 | 之后 |
|---|---|---|
| FAB bottom | 100px (留给 tabbar) | 32px |
| 其他 | 不变 | 不变 |

## 6. 后端 / Prompt 依赖检查 ✅ 零改动

| UX 元素 | 数据来源 | 后端是否要改 |
|---|---|---|
| 4 tab 静态分类 | 纯 iOS 端 | ✅ 零改动 |
| Recents 最近卡片列表 | `timeline-service /timeline/feed?limit=10` | ✅ 已存在 |
| 点击 Recents item → 详情 | 复用现有 deep link | ✅ 已存在 |
| hamburger / 左滑手势 | iOS UI / SwiftUI gesture | ✅ 零改动 |
| FAB 位置调整 | iOS 布局 | ✅ 零改动 |
| tabbar 隐藏 | iOS 删 TabView | ✅ 零改动 |

⚠️ **未来可选（v0.5 不做）**:
- 全局搜索 → 需要 deploy `services/timeline_search/search-service`（backend report: 代码已有但无 dev Deployment）
- 这超出 ux0.5 范围

## 7. 林啸 vibecoding 任务

### 7.a iOS 改动
- 删除 `App/RootView.swift` 的 `TabView`
- 改成 `NavigationSplitView`（iOS 26 推荐）或自定义 `offset` 抽屉
- 每个 view 顶部加 navbar（hamburger + title）
- 加左滑手势识别（< 30px from left edge）
- Recents 列表数据复用 `HomeStore.cards.prefix(10)`

### 7.b 不要动
- Repository / Store / 数据层
- Live Activity / Widget
- FAB 录音逻辑（仅改 bottom padding）
- 4 个 detail view（RecordingDetail / CommandDetail / IdeaDetail / TodoDetail）

### 7.c 估算
- iOS 改动：~200 行（删 TabView + 加 Drawer + 加 navbar）
- 后端改动：0
- 工作量：~1 天

## 8. 文案

- 抽屉 4 tab label: 不变（首页 / 记忆 / Agent / 我）
- Recents section label: "最近"
- 空 Recents 文案: 见 `docs/copy/empty-state.md` § `drawer.recents_empty`

## 9. Acceptance

- [x] ux05 prototype 实现可滑动抽屉
- [x] 4 tab 静态项 + 8 条 Recents（mock）
- [x] hamburger button + 左滑手势
- [x] FAB 不动
- [x] spec 文件完整
- [x] 零后端改动声明
