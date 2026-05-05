---
type: copy
category: empty-state
---

# 空态文案

> 规则：≤ 30 字，含一句"行动建议"

## Home

| key | 文案 |
|---|---|
| `home.first_use` | 长按戒指开始第一次录音 |
| `home.no_today` | 今天还没有新内容 · 试试录一段 |
| `home.network_offline` | 离线中 · 旧记录可读，新录音待恢复 |

## Memory

| key | 文案 |
|---|---|
| `memory.empty` | 还没有记忆 · 录音后会自动入库 |
| `memory.no_search_result` | 没找到 · 换个关键词试试 |

## Agent

| key | 文案 |
|---|---|
| `agent.no_tasks` | 还没有 Agent 任务 |
| `agent.no_messages` | 和 Agent 说点什么开始 |

## Plugins (M4 · MON-28)

> v0.5 阶段 7 个 first-party plugin 默认全部已装、永远在列表里 — 几乎不会遇到列表空态。下面的空态主要给"全部 tool 都被关停"等边界场景。

| key | 文案 |
|---|---|
| `plugins.list_empty_v05` | （不会发生 · v0.5 默认 7 个 first-party 永在）|
| `plugin.all_disabled_hint` | 所有能力已关闭 · Agent 不会调用此插件 |
| `plugin.no_oauth_needed` | 此插件无需账号授权 · 装好即用 |
| `plugin.oauth_required` | 需要先连接 {provider} 账号 |
| `plugin.list_first_open` | 还没有就绪的插件 · 去发现里连接你想用的 |
| `plugin.market_section_official` | 官方插件 |
| `plugin.market_section_coming` | 即将上架 |
| `plugin.market_section_third` | 第三方（v1.0） |

## Drawer (MON-35 全局抽屉)

| key | 文案 |
|---|---|
| `drawer.recents_empty` | 还没有记录 · 长按戒指开始 |
| `drawer.section_recents` | 最近 |

## 空态详细规则（M1 · MON-15 LOCKED）

| 场景 | 文案 / UI |
|---|---|
| **第一次打开 home** | 一行 dim 文字 `还没有录音 · 长按戒指开始` (不引入 illustration 资源, 极简) |
| **filter chip 筛后无内容** (v0.5 没有 filter, 跳过) | — |
| **网络断** | 全局 banner (toast.md `network.offline_banner`) |
| **Memory tab 空** | `还没有记忆 · 录音后会自动入库` |
| **Agent tab 无任务** | `agent.no_tasks` |

## TODO（明明）

- [ ] 灵感无法归属时的 inbox 空态
- [ ] 第一次连戒指失败的引导
