---
name: memory-tree-raw-to-description
version: 1
owner: 明明
status: draft
last-updated: 2026-05-02
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

## 输出契约（v2 双视角）
```typescript
{
  description_nodes: Array<{    // 一段 raw 可拆出多个 description（不同主题）
    // ===== display 字段（给用户看，Memory tab UI 渲染）=====
    display_title: string,        // ≤ 12 字，人话简短
    display_summary: string,      // ≤ 30 字，一行扫描

    // ===== search 字段（给 Agent fetch 用，信息密集）=====
    search_text: string,          // ≤ 200 字，保留所有可检索的实体/数字/决策
    search_keywords: string[],    // 实体名 + 主题词 + 时间锚点

    // ===== 元数据 =====
    salience: number,             // 0-1（原 importance 改名）
                                  //   含义：节点的"被检索价值"分数（Agent 视角）
                                  //   不是用户感知重要度
                                  //   规则：信息密度 0.6 + 用户情绪信号 0.4
    entities: string[],           // 命名实体（人/项目/地点/时间）
  }>,
  schema_version: 2,
}
```

## System Prompt
> TODO（明明 v2）。draft 已升级为双视角：
>
> 你是 Memory 树的压缩器。把 raw 内容压成 description。
> 输出每条 description 必须同时给出两套字段：
>
> 【display 字段 — 给用户翻看 Memory 时一眼能扫】
> - display_title (≤ 12 字)：人话短标题，避免缩略 / 行话
>   ✓ "续航讨论"
>   ✗ "BLE 1Hz→0.2Hz 心率上报频率优化方案"
> - display_summary (≤ 30 字)：一句话讲清主题，温和、人感、不丢上下文
>
> 【search 字段 — 给 Agent fetch 时检索】
> - search_text (≤ 200 字)：保留所有可检索的实体、数字、决策、时间
>   不需要"好读"，需要"找得到"
> - search_keywords：实体 + 主题词 + 时间锚点 + 数字关键值
>
> 【salience 评分 rubric (0-1)】
> - 信息密度 (权重 0.6)：含数字/决策/命名实体 → +0.1~0.4 each
> - 情绪信号 (权重 0.4)：用户表达"我决定/我不喜欢/重要的是" → +0.2~0.4
> - 寒暄/重复 → 0~0.1
>
> ⚠️ salience ≠ "对用户重要"，是"Agent 检索时值不值得装进 context window"
>
> 【保留】人名、项目名、时间、决策、数字、用户主观判断
> 【丢弃】寒暄、口头禅（"嗯/那个/然后"）、冗余修饰、重复表达
> 【拆点】主题切换 / 时间间隔 / 角色切换 → 拆成多个 description

## 决策规则
- 一段 raw 必拆出 ≥ 1 条 description
- 拆点 = 主题切换 / 时间间隔 / 角色切换
- display_title 和 search_text 是同一节点的两个面，不要 display 写一个意思 search 写另一个意思
- 用户编辑 display_title 后系统不重新压缩 search_text（最小改动原则，Q3 选 A）

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
      "display_title": "续航讨论",
      "display_summary": "续航 38h，离 50h 目标差 12h",
      "search_text": "当前续航 38 小时，距 50 小时目标差 12 小时。林啸计划把心率上报频率从 1Hz 降到 0.2Hz，预计省 18%，明天测试验证。",
      "search_keywords": ["续航", "BLE", "心率上报", "38h", "50h", "1Hz", "0.2Hz", "林啸", "硬件迭代"],
      "salience": 0.85,
      "entities": ["林啸", "续航", "BLE 协议", "心率上报"]
    },
    {
      "display_title": "iOS 候选人面试",
      "display_summary": "周三下午 3 点，林啸一起",
      "search_text": "Sean 推荐一位 iOS 候选人。安排周三下午 3 点面试，林啸一同参加，重点考察 SwiftUI 熟练度。",
      "search_keywords": ["iOS 候选人", "Sean", "面试", "周三 15:00", "SwiftUI", "招聘"],
      "salience": 0.7,
      "entities": ["Sean", "iOS 候选人", "林啸", "周三 15:00"]
    },
    {
      "display_title": "周末家庭安排",
      "display_summary": "周六深圳湾，全天不在线",
      "search_text": "周六带家人去深圳湾，全天不在线。",
      "search_keywords": ["深圳湾", "周末", "家人", "不在线"],
      "salience": 0.4,
      "entities": ["深圳湾", "周末"]
    }
  ],
  "schema_version": 2
}
```

**为什么这样拆**：3 个主题（硬件 / 招聘 / 个人）切换明显 → 拆 3 条。salience 按"信息密度 + 决策数字"排：续航 0.85（含具体数字 + 决策方向）> 招聘 0.7（含决策时间）> 周末 0.4（无决策）。

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
      "display_title": "心情快照灵感",
      "display_summary": "用戒指按一下，记录此刻的感觉",
      "search_text": "产品想法：戒指增加\"心情快照\"按键，用户主动按一下记录此刻的感觉。相比每天的健康汇总更有情绪温度。需评估硬件按键复用还是新增手势。",
      "search_keywords": ["心情快照", "戒指交互", "产品想法", "情绪记录", "按键设计"],
      "salience": 0.75,
      "entities": ["心情快照", "戒指交互"]
    }
  ],
  "schema_version": 2
}
```

**为什么 salience 0.75**：用户主观判断（"我想到"+"比...更有人味"） + 产品决策方向，但无具体数字 → 信息密度 0.4 × 0.6 + 情绪信号 0.9 × 0.4 ≈ 0.6，再考虑"产品决策"性质上调到 0.75。

---

### Example 3：纯寒暄（拆 1 条但 salience 极低）

**Input**:
```
早。早早。喝咖啡了吗。喝了喝了。今天天气真好。
```

**Output**:
```json
{
  "description_nodes": [
    {
      "display_title": "日常寒暄",
      "display_summary": "早晨问候",
      "search_text": "日常寒暄，无具体内容。",
      "search_keywords": [],
      "salience": 0.05,
      "entities": []
    }
  ],
  "schema_version": 2
}
```

**为什么不返回空数组**：空数组用于"raw 是空字符串"。这里有内容只是没价值，仍然产出一条 description，靠 salience=0.05 让 Agent fetch 时几乎不会装载。

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
      "display_title": "v2 形态纠结",
      "display_summary": "戒指 vs 项链 vs 夹子，无感佩戴是核心",
      "search_text": "Ring v2 形态思考：戒指物理电池上限受限，考虑过项链/夹子但牺牲随时随地。核心约束=无感佩戴。结论倾向\"更小更轻的戒指 + 充电更频繁\"。决策未定，明明个人 brainstorm。",
      "search_keywords": ["v2 形态", "戒指", "项链", "夹子", "无感佩戴", "电池", "充电频率", "产品决策"],
      "salience": 0.78,
      "entities": ["Ring v2", "无感佩戴", "硬件形态"]
    }
  ],
  "schema_version": 2
}
```

**为什么不拆**：虽然提到 3 种形态，但都围绕同一个主题（v2 形态决策）。"拆点 = 主题切换"，没切换就不拆。salience 0.78：决策性内容（0.4）+ 用户主观纠结（0.4）+ 多个产品概念命名实体（0.2）。

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
      "display_title": "Memory tab 信息密度反馈",
      "display_summary": "Sean 也觉得太密，提议精简",
      "search_text": "5/4 设计 review：明明反馈 Memory tab v3 信息密度过高。Sean 同意，提议方案：只保留画像 + compound 数字 + 4 类画像，把 episode 列表挪到项目详情页里。",
      "search_keywords": ["Memory tab", "信息密度", "v3 反馈", "Sean", "设计 review", "画像", "compound"],
      "salience": 0.82,
      "entities": ["Sean", "Memory tab", "v3 设计稿"]
    },
    {
      "display_title": "Sidebar 加 user avatar",
      "display_summary": "底部加头像，导航维持",
      "search_text": "Sidebar 设计决策：维持当前项目导航结构，仅在底部增加 user avatar。",
      "search_keywords": ["sidebar", "user avatar", "底部", "导航"],
      "salience": 0.65,
      "entities": ["sidebar", "user avatar"]
    },
    {
      "display_title": "v4 设计 deadline",
      "display_summary": "下周一前出稿",
      "search_text": "Sean 承诺下周一（5/12）前出 Memory tab v4 设计稿。",
      "search_keywords": ["Sean", "v4 设计", "5/12", "deadline"],
      "salience": 0.7,
      "entities": ["Sean", "v4 设计稿", "下周一"]
    }
  ],
  "schema_version": 2
}
```

**为什么这样拆**：3 个独立可决策的子点（信息密度反馈 / sidebar 决策 / 时间承诺），即便都在同一个 review 里也要拆——因为后续 Agent 检索时这 3 个会被独立 query（"Sean 怎么看 Memory tab？" vs "v4 啥时候出？"）。

## 边界
- 空 raw → 返回空数组
- 重复 raw → 由后端去重，prompt 不管

## 版本历史
- v1 (2026-05-02): 初版骨架
- v2 (2026-05-03): 双视角字段（display vs search）+ salience 改名 + 详细 rubric

## Eval
见 `eval/raw-to-description-fixtures.md`
