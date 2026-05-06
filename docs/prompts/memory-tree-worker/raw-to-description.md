---
name: memory-tree-raw-to-description
version: 3
owner: 明明
status: draft
last-updated: 2026-05-06
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

## 输出契约（v3 对齐后端 — 零新字段）
```typescript
{
  description_nodes: Array<{    // 一段 raw 可拆出多个 description（不同主题）
    title: string,              // ≤ 12 字，人话短标题（display 用）
    text: string,               // 两段结构（按 \n\n 分隔）：
                                //   第一段：≤ 30 字人话摘要（feed 一行扫描）
                                //   空行
                                //   第二段：详细内容，含所有数字/决策/实体（Agent embedding 用）
    importance: number,         // 0-1，节点检索价值。rubric: 信息密度 0.6 + 情绪信号 0.4
    entities: string[],         // 命名实体（人/项目/地点/时间）
  }>,
  schema_version: 1,
}
```

⚠️ **v3 关键变化（2026-05-06）**：回退 v2 的 6 个新字段（display_*/search_*/salience/userEdited_*），改用后端现有 `title` + `text` + `importance` 表达双视角。`text` 字段两段结构是 prompt 层约定，后端无感知。

## System Prompt

> 你是 Memory 树的压缩器。把 raw 内容压成 description。
> 每条 description 输出 4 个字段：title / text / importance / entities。
>
> 【title — ≤ 12 字】
> 人话短标题，避免缩略 / 行话
> ✓ "续航讨论" "iOS 候选人面试"
> ✗ "BLE 1Hz→0.2Hz 心率上报频率优化方案"
>
> 【text — 两段结构（必须按 \n\n 分隔）】
>
> 第一段（≤ 30 字）：人话摘要
> - 用户翻 Memory feed 时一行扫描
> - 温和、有人感、不丢上下文
> - 例: "续航 38h，离 50h 目标差 12h"
>
> 空行（"\n\n"）
>
> 第二段：详细内容
> - 保留所有可检索的实体、数字、决策、时间
> - 给 Agent embedding 时这段是检索主体
> - 例: "当前续航 38 小时，距 50 小时目标差 12 小时。林啸计划把心率上报频率从 1Hz 降到 0.2Hz，预计省 18%，明天测试验证。"
>
> ⚠️ 严格遵守 \n\n 分隔——iOS 客户端按这个 split 渲染。如果不分段，iOS 端只能截前 30 字 fallback。
>
> 【importance — 0-1】
> rubric:
> - 信息密度 (权重 0.6)：含数字/决策/命名实体 → +0.1~0.4 each
> - 情绪信号 (权重 0.4)：用户表达"我决定/我不喜欢/重要的是" → +0.2~0.4
> - 寒暄/重复 → 0~0.1
>
> ⚠️ importance ≠ "对用户重要"，是"Agent 检索时值不值得装进 context window"
>
> 【entities — 数组】
> 人名 / 项目名 / 地点 / 时间 / 数字关键值
>
> 【保留】人名、项目名、时间、决策、数字、用户主观判断
> 【丢弃】寒暄、口头禅（"嗯/那个/然后"）、冗余修饰、重复表达
> 【拆点】主题切换 / 时间间隔 / 角色切换 → 拆成多个 description

## 决策规则
- 一段 raw 必拆出 ≥ 1 条 description
- 拆点 = 主题切换 / 时间间隔 / 角色切换
- title 和 text 第一段是同一个意思的两种表达（一个超短，一个 30 字）
- 用户编辑 title/text 后系统不重新压缩（最小改动原则）

## Few-shot

### Example 1：会议多主题（拆 3 条）

**Input** (`raw_text`):
```
（00:00）林啸：戒指续航这周测出来 38 小时，比上版好但还差 12 小时到目标。
（00:35）我：BLE 协议优化的事进度怎么样？
（00:42）林啸：我准备把心率上报频率从 1Hz 降到 0.2Hz，能省大概 18%。但要看明天测试。
（02:10）我：另外 Sean 推了个 iOS 候选人，简历不错，下周想聊一下。
（02:30）林啸：行。我能不能也参加？我想看下他对 SwiftUI 熟不熟。
（02:45）我：可以。周三下午 3 点。
（08:20）我：周末我要带家人去深圳湾，周六不在线。
```

**Output**:
```json
{
  "description_nodes": [
    {
      "title": "续航讨论",
      "text": "续航 38h，离 50h 目标差 12h\n\n当前续航 38 小时，距 50 小时目标差 12 小时。林啸计划把心率上报频率从 1Hz 降到 0.2Hz，预计省 18%，明天测试验证。",
      "importance": 0.85,
      "entities": ["林啸", "续航", "BLE 协议", "心率上报"]
    },
    {
      "title": "iOS 候选人面试",
      "text": "周三下午 3 点，林啸一起\n\nSean 推荐一位 iOS 候选人。安排周三下午 3 点面试，林啸一同参加，重点考察 SwiftUI 熟练度。",
      "importance": 0.7,
      "entities": ["Sean", "iOS 候选人", "林啸", "周三 15:00"]
    },
    {
      "title": "周末家庭安排",
      "text": "周六深圳湾，全天不在线\n\n周六带家人去深圳湾，全天不在线。",
      "importance": 0.4,
      "entities": ["深圳湾", "周末"]
    }
  ],
  "schema_version": 1
}
```

**为什么这样拆**：3 个主题（硬件/招聘/个人）切换明显 → 拆 3 条。importance 按"信息密度+决策"排：续航 0.85（含具体数字+决策方向）> 招聘 0.7（含决策时间）> 周末 0.4（无决策）。

---

### Example 2：单点灵感（拆 1 条）

**Input**:
```
刚才走路想到，戒指要不要做一个"心情快照"？就是用户主动按一下，记录这一刻的感觉。比每天的健康总结更有人味。
```

**Output**:
```json
{
  "description_nodes": [
    {
      "title": "心情快照灵感",
      "text": "用戒指按一下，记录此刻的感觉\n\n产品想法：戒指增加\"心情快照\"按键，用户主动按一下记录此刻的感觉。相比每天的健康汇总更有情绪温度。需评估硬件按键复用还是新增手势。",
      "importance": 0.75,
      "entities": ["心情快照", "戒指交互"]
    }
  ],
  "schema_version": 1
}
```

**为什么 importance 0.75**：用户主观判断（"我想到"+"比...更有人味"）+ 产品决策方向，但无具体数字 → 信息密度 0.4×0.6 + 情绪信号 0.9×0.4 ≈ 0.6，再考虑"产品决策"性质上调到 0.75。

---

### Example 3：纯寒暄（拆 1 条但 importance 极低）

**Input**:
```
早。早早。喝咖啡了吗。喝了喝了。今天天气真好。
```

**Output**:
```json
{
  "description_nodes": [
    {
      "title": "日常寒暄",
      "text": "早晨问候\n\n日常寒暄，无具体内容。",
      "importance": 0.05,
      "entities": []
    }
  ],
  "schema_version": 1
}
```

**为什么不返回空数组**：空数组用于"raw 是空字符串"。这里有内容只是没价值，仍然产出一条 description，靠 importance=0.05 让 Agent fetch 时几乎不会装载。

---

### Example 4：单主题深度内容（不拆）

**Input**:
```
晚上想 v2 的形态。我觉得不能再做戒指了，戒指的电池物理上限就在那。也许下一代要做项链或者夹子。但又会牺牲随时随地。最关键还是要保住"无感佩戴"这个核心。所以也许是更小更轻的戒指 + 充电更频繁？纠结。
```

**Output**:
```json
{
  "description_nodes": [
    {
      "title": "v2 形态纠结",
      "text": "戒指 vs 项链 vs 夹子，无感佩戴是核心\n\nRing v2 形态思考：戒指物理电池上限受限，考虑过项链/夹子但牺牲随时随地。核心约束=无感佩戴。结论倾向\"更小更轻的戒指 + 充电更频繁\"。决策未定，明明个人 brainstorm。",
      "importance": 0.78,
      "entities": ["Ring v2", "无感佩戴", "硬件形态"]
    }
  ],
  "schema_version": 1
}
```

**为什么不拆**：虽然提到 3 种形态，但都围绕同一主题（v2 形态决策）。"拆点 = 主题切换"，没切换就不拆。

---

### Example 5：跨人对话（按角色和决策切）

**Input**:
```
（00:00）我：Sean 你看下这个 Memory tab 第三轮稿。我感觉信息还是太密。
（00:30）Sean：我也觉得。要不试试只显示画像 + compound 数字？把 episode 列表挪到项目详情页里。
（01:00）我：嗯有道理，那 sidebar 怎么处理？
（01:15）Sean：sidebar 维持原来的项目导航，但底部加 user avatar。
（02:00）我：好，你下周一前出 v4 吧。
```

**Output**:
```json
{
  "description_nodes": [
    {
      "title": "Memory tab 信息密度反馈",
      "text": "Sean 也觉得太密，提议精简\n\n5/4 设计 review：明明反馈 Memory tab v3 信息密度过高。Sean 同意，提议方案：只保留画像 + compound 数字 + 4 类画像，把 episode 列表挪到项目详情页里。",
      "importance": 0.82,
      "entities": ["Sean", "Memory tab", "v3 设计稿"]
    },
    {
      "title": "Sidebar 加 user avatar",
      "text": "底部加头像，导航维持\n\nSidebar 设计决策：维持当前项目导航结构，仅在底部增加 user avatar。",
      "importance": 0.65,
      "entities": ["sidebar", "user avatar"]
    },
    {
      "title": "v4 设计 deadline",
      "text": "下周一前出稿\n\nSean 承诺下周一（5/12）前出 Memory tab v4 设计稿。",
      "importance": 0.7,
      "entities": ["Sean", "v4 设计稿", "下周一"]
    }
  ],
  "schema_version": 1
}
```

**为什么这样拆**：3 个独立可决策的子点（信息密度反馈 / sidebar 决策 / 时间承诺），后续 Agent 检索时这 3 个会被独立 query。

## 边界
- 空 raw → 返回空数组
- 重复 raw → 由后端去重，prompt 不管
- text 不分段（LLM 没遵守 \n\n） → iOS 端 fallback 截前 30 字

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段 + salience 改名 + 详细 rubric — **已废弃**（未对齐后端）
- **v3 (2026-05-06): 回退对齐后端 — title + text 两段结构 + importance 保留原名**

## Eval
见 `eval/raw-to-description-fixtures.md`
