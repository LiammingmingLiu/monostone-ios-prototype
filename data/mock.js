/* ==========================================================================
 * Monostone iOS Prototype · Mock Data
 * --------------------------------------------------------------------------
 * 这个文件把原本写死在 index.html 里的 mock 数据抽出来, 方便 iOS 团队 reference
 * schema, 也方便未来接真实后端时改成 fetch.
 *
 * 暴露到全局的对象:
 *   window.FULL_SUMMARIES  —— 长录音的完整会议纪要 (对应后端 GET /v1/cards/{id}/full-summary)
 *   window.ACTION_ITEMS    —— 每条长录音的 action items 列表 (对应后端 GET /v1/cards/{id}/action-items)
 *   window.AGENT_CONVERSATION —— Agent 页的 IM 聊天记录 (新增, 对应后端 GET /v1/agent/conversation)
 *   window.MEMORY_ENTITIES  —— 记忆页的实体 + 洞察数据 (新增, 对应后端 GET /v1/memory/overview)
 *
 * 所有数据都是 frozen 的 JS 对象, 原型逻辑直接读取; 真实后端上线后换成 fetch 即可.
 * ========================================================================== */

/* ====== 完整会议纪要数据（长录音独有 · LLM 生成） ======
 * 结构契约 = 基本信息 + 多个 H2 section + 每 section 内 H3 子段落
 * 决策 / Action Items / Memory 归因在卡片的其他 section 已单独呈现, 这里不重复
 * paragraphs[i] 如果以 '<' 开头 = 原始 HTML 块; 否则 = 普通段落会被 <p> 套壳
 */
window.FULL_SUMMARIES = {
  'rec-1': {
    title: '和敦敏的 Series A 跟进会 · 会议纪要',
    meta: {
      '会议时间': '2026 年 4 月 9 日（周三） 10:30 – 11:12',
      '会议时长': '42 分 18 秒',
      '参会人员': '敦敏（Linear Capital 合伙人）、明明（Monostone CEO）、郑灿（Linear Capital 投资总监）、马俊（Linear Capital 合伙人）',
      '会议项目': 'Series A 融资 · D-Day',
      '会议形式': '线下会议 · Linear Capital 上海办公室'
    },
    sections: [
      {
        h: '会议背景',
        paragraphs: [
          '<p>本次会议是 <strong>Monostone</strong> 与 <strong>Linear Capital</strong> 的 <strong>Series A D-Day</strong> 深度对接会议，也是双方进入正式融资流程前的最后一次关键访谈。</p>',
          '<h3>D-Day 前的三周铺垫</h3>',
          '<p>在过去 <strong>三周</strong> 内，Monostone 团队与 Linear Capital 完成了 <strong>4 轮</strong> 前期沟通，双方已在三件事上达成共识：产品形态（单硬件 + 端到端软件）、技术可行性（双麦 + 低功耗方案验证通过）、团队背景（硬件 / 软件 / GTM 三角齐备）。今天的 D-Day 会议目的明确——做最后一轮关键投资判断；<strong>Linear Capital 将在 2026-04-15（下周三）</strong> 内部投委会后形成初步 Term Sheet 意向，明确估值区间和交易结构。</p>',
          '<h3>Pitch 材料的重新梳理</h3>',
          '<p>明明在会议开始前一天（<strong>2026-04-08</strong>）专门重新梳理了 pitch 材料，重点针对敦敏此前提出的 <strong>三个疑问</strong> 做专项回应：</p>',
          '<ol><li><strong>产品定位</strong>：Monostone 是 AI Infrastructure 项目，还是 Closed-Loop 消费级硬件？</li><li><strong>竞争壁垒</strong>：面对 Apple / OpenAI 级别玩家时，护城河究竟在哪？</li><li><strong>GTM 节奏</strong>：为什么跳过 Kickstarter 直接独立站 DTC？</li></ol>',
          '<h3>Linear Capital 阵容罕见加码</h3>',
          '<p>本次 Linear 方面由 <strong>敦敏</strong>（合伙人）亲自带队，罕见地同时带上 <strong>投资总监郑灿</strong> 和另一位合伙人 <strong>马俊</strong>。三人阵容在 Linear 的早期项目跟进中极少出现——明明在会前和郑灿的短短几句寒暄里确认：<strong>内部对这个项目的重视程度已经拉满</strong>。</p>'
        ]
      },
      {
        h: '议题一 · Infrastructure vs Closed-Loop 产品定位',
        paragraphs: [
          '<h3>敦敏的开场直球</h3>',
          '<p>会议 <strong>10:30</strong> 准时开始。敦敏没有寒暄，直接把心里盘旋多日的疑问摊在桌面上：</p>',
          '<blockquote><p>Monostone 到底是一个 AI infrastructure 项目，还是一个 closed-loop 的消费级产品？这两个叙事我们内部几个合伙人吵了一周，没吵出结果。</p><span class="bq-author">— 敦敏，10:31</span></blockquote>',
          '<p>敦敏坦率解释了为什么这个问题至关重要：<strong>Infra 叙事性感但风险巨大</strong>——护城河难建立、估值逻辑复杂、退出路径模糊；而 <strong>Closed-Loop 叙事朴素但更符合 Linear 对早期消费硬件的判断框架</strong>——有清晰的 ARR 增长、可度量的毛利、可预测的退出路径。</p>',
          '<h3>明明的回答：闭环为本，生态为翼</h3>',
          '<p>明明没有回避这个问题，直接亮出他已经想清楚的答案：</p>',
          '<blockquote><p>戒指 + App + Agent 是闭环产品，插件生态是长期的开放性叙事。两者不矛盾——主心骨是闭环，外延是生态。</p><span class="bq-author">— 刘明明，10:34</span></blockquote>',
          '<p>他进一步解释：Agent 层保留开放接口（<strong>CLI</strong> / <strong>API</strong> / <strong>Skills</strong>）是为了让高阶用户和开发者能接入，但 <strong>这不是产品的主要价值主张</strong>，主要价值仍然在闭环的端到端体验上。换句话说，<strong>"开放"是护城河，不是商品</strong>。</p>',
          '<h3>Linear 内部投资逻辑落定</h3>',
          '<p>敦敏对这个回答明显满意，马俊在一旁补了决定性的一句：</p>',
          '<blockquote><p>这样我们内部就知道怎么写投资逻辑了——按消费硬件看估值，但在产品力上承认它有 Infra 的想象空间。</p><span class="bq-author">— 马俊，10:37</span></blockquote>'
        ]
      },
      {
        h: '议题二 · 竞争格局重估',
        paragraphs: [
          '<h3>郑灿的 Apple 威胁论</h3>',
          '<p>议题转到竞争格局。<strong>郑灿</strong> 作为 Linear 的投资总监，一上来就抛出了他最担心的竞争对手——不是 OpenAI，而是 <strong>Apple</strong>：</p>',
          '<blockquote><p>Apple 一旦在 Vision Pro 之外做一款 AI 穿戴设备，凭借生态壁垒几乎可以瞬间压垮所有创业公司。早期硬件项目，最怕的就是这种局。</p><span class="bq-author">— 郑灿，10:42</span></blockquote>',
          '<h3>明明的反驳：Apple 被自己的隐私框架锁死</h3>',
          '<p>明明对这个判断给出了完全不同的解读。他分析说，<strong>Apple 在 AI 穿戴领域反而是最慢的玩家</strong>，原因有两层：</p>',
          '<ul><li><strong>隐私框架锁死</strong>：Apple 的品牌根基是"隐私"，这让它在结构上无法做激进的 "always listening" 类产品。任何"监听类"功能在 Apple 内部合规流程里都会被卡死很久。</li><li><strong>内部协作历史糟糕</strong>：Apple 的 AI 团队（<strong>Siri</strong>）和硬件团队（<strong>Vision Pro</strong>）之间的协作历史上就是出名的糟糕，这在过去十年里反复出现，不会在一个新的 AI 穿戴项目上突然变好。</li></ul>',
          '<h3>真正的威胁 · OpenAI</h3>',
          '<p>明明紧接着指出，<strong>OpenAI</strong> 才是真正值得警惕的玩家：</p>',
          '<ol><li><strong>硬件团队已经成型</strong>：OpenAI 最近收购了一个前 Apple 硬件团队，核心成员来自 Apple Watch 与 iPhone 产品线。</li><li><strong>Sam Altman 的明确意图</strong>：他在最近 <strong>3 个月</strong> 内至少 <strong>5 次</strong> 在公开场合表达过对消费硬件的强烈兴趣——不像是试探，更像是预热。</li><li><strong>模型 + 硬件一体化的天然优势</strong>：OpenAI 拥有任何创业公司都拿不到的模型能力，一旦硬件落地，即刻就是"新时代的 Apple"。</li></ol>',
          '<h3>Humane AI Pin 的反例</h3>',
          '<p>为了让 Linear 不要对"大厂一定赢"盲从，明明举了 <strong>Humane AI Pin</strong> 作为反例——创始人全部来自 Apple，融资超过 <strong>2.4 亿美元</strong>，但产品一上市就被差评集体淹没。"<strong>苹果前员工创业做 AI 硬件也可以失败得很惨</strong>"这句话让敦敏和郑灿都明显松了一口气。</p>',
          '<h3>大厂威胁排序（明明给出的最终版）</h3>',
          '<table><thead><tr><th>排名</th><th>玩家</th><th>威胁等级</th><th>核心判断</th></tr></thead><tbody><tr><td><strong>1</strong></td><td><strong>OpenAI</strong></td><td>最大</td><td>硬件团队 + 模型垄断 + Altman 亲自下场</td></tr><tr><td>2</td><td><strong>Samsung</strong></td><td>中</td><td>已有 Galaxy Ring，短期再做一款 Ring 概率极低</td></tr><tr><td>3</td><td><strong>Google</strong></td><td>低</td><td>生态封闭、跨 AI/硬件协作差</td></tr><tr><td>4</td><td><strong>Apple</strong></td><td>最低</td><td>隐私框架锁死 + Siri/Vision Pro 内部协作差</td></tr></tbody></table>'
        ]
      },
      {
        h: '议题三 · 最大风险 · 品类本身',
        paragraphs: [
          '<h3>敦敏的灵魂一问</h3>',
          '<p>讨论转入风险议题。敦敏没有绕弯子，直接开问：</p>',
          '<blockquote><p>你们最怕什么？</p><span class="bq-author">— 敦敏，10:52</span></blockquote>',
          '<h3>明明的回答：怕的不是对手，怕的是品类本身</h3>',
          '<p>明明沉默了几秒，给出一个出乎 Linear 意料的答案：</p>',
          '<blockquote><p>最怕的不是竞争对手入局，最怕的是 2028 年回头看，发现戒指这个品类本身没起来——就像当年的 Google Glass。</p><span class="bq-author">— 刘明明，10:53</span></blockquote>',
          '<p>他解释：如果 <strong>2028 年</strong> 智能戒指品类被证伪，那么就算 Monostone 执行完美也会被品类衰退拖下水——这是单一创业公司无法对冲的系统性风险。</p>',
          '<h3>对冲锚点一 · 双麦 15 dB SNR 物理差异化</h3>',
          '<p>为了对冲品类风险，Monostone 在产品设计上埋了两层锚点。第一层是 <strong>双麦阵列</strong> 带来的信噪比优势——这是任何单麦戒指都做不到的物理差异化：</p>',
          '<table><thead><tr><th>场景</th><th>双麦相对单麦 SNR 提升</th><th>用户体感</th></tr></thead><tbody><tr><td>静态（人不动）</td><td><strong>+18 ~ 20 dB</strong></td><td>塞口袋、衣服盖着也能录</td></tr><tr><td>快速动（挥手 / 走路）</td><td><strong>+12 ~ 15 dB</strong></td><td>手可自由动，无姿势约束</td></tr><tr><td>平均（正常动作）</td><td><strong>约 +15 dB</strong></td><td>相当于 <strong>4 倍距离</strong> / <strong>31.6 倍功率</strong></td></tr></tbody></table>',
          '<h3>对冲锚点二 · 高频交互让 context 真正复利</h3>',
          '<p>第二层锚点是 <strong>每用户 10 次/天以上</strong> 的高频交互——只有这种高频交互能让 context 真正复利起来。明明强调：低频产品的 context 永远拉不开差距，高频产品的 context 在 <strong>30 天</strong> 后就会形成别的玩家无法复制的护城河。</p>',
          '<h3>马俊的 marketing 建议 · 换一种叙事语言</h3>',
          '<p>马俊对这套风险答案非常认可，当场给出一个关键的 marketing 建议：</p>',
          '<blockquote><p>别用技术语言。"15 dB SNR" 普通人听不懂。用场景语言——走路、开车、户外都能清晰录音——把它包装成 "freestyle recording"。</p><span class="bq-author">— 马俊，10:58</span></blockquote>',
          '<p>明明当场把这个建议记下，决定在下一版 marketing deck 里把 <strong>"freestyle recording"</strong> 作为硬件核心卖点的主叙事。</p>'
        ]
      },
      {
        h: '议题四 · GTM 节奏与第一批用户',
        paragraphs: [
          '<h3>Linear 对"跳过 Kickstarter"的顾虑</h3>',
          '<p>会议的最后 <strong>15 分钟</strong> 讨论 GTM 节奏。Linear 方面对明明反复强调的"不做 Kickstarter 直接独立站 DTC"提出了顾虑：</p>',
          '<blockquote><p>如果没有 Kickstarter 的众筹数据做背书，早期的 GTM 数据怎么打动下一轮投资人？</p><span class="bq-author">— 郑灿，11:01</span></blockquote>',
          '<h3>明明的答复：早期用户不在 Kickstarter</h3>',
          '<p>明明的回答基于清晰的用户画像判断：<strong>Monostone 的早期用户群是高频 AI 使用者</strong>——开发者、研究员、产品经理。这波人不在 Kickstarter，他们的转化路径是 <strong>Twitter</strong> 和 <strong>知乎</strong> 上的口碑扩散。他列举了两个近三年的成功案例：<strong>Rewind</strong> 与 <strong>Limitless</strong>——两家都是靠社交传播完成冷启动，证明这条路径在 AI 硬件品类里是经过验证的。</p>',
          '<h3>郑灿的 B2B 优先级建议</h3>',
          '<p>郑灿在会议尾声抛出了一个关键建议：</p>',
          '<blockquote><p>企业场景的优先级应该高于家庭场景——企业用户的 context 共享价值更大，B2B 商业模型也更健康。</p><span class="bq-author">— 郑灿，11:08</span></blockquote>',
          '<p>这个建议没有当场拍板。明明当场承诺：<strong>下周前</strong> 做一版 <strong>B2B scenario roadmap</strong> 再来汇报。</p>'
        ]
      },
      {
        h: '会议收尾与后续动作',
        paragraphs: [
          '<h3>敦敏的最终信号</h3>',
          '<p>会议 <strong>11:12</strong> 结束。敦敏没有做任何承诺，只说：</p>',
          '<blockquote><p>下周三 Linear 内部投委会后会给你们初步意见。</p><span class="bq-author">— 敦敏，11:12</span></blockquote>',
          '<p>但明明从敦敏和马俊互相交换的眼神里读出一个关键信号——<strong>这次会议至少没有踩到任何红线</strong>。</p>',
          '<h3>马俊单独留下的提醒 · EO 14117</h3>',
          '<p>会议散场后，马俊单独把明明留了几分钟，提醒他尽快研究一下 <strong>EO 14117 美国数据法规</strong> 对智能穿戴设备可能的影响。这是美国政府近期对 <strong>"涉及敏感个人数据的外国控制技术"</strong> 的限制，可能会影响 Monostone 未来进入美国市场的策略。</p>',
          '<h3>明明的现场承诺</h3>',
          '<p>明明当场承诺：<strong>2026-04-13（下周一）前</strong> 给 Linear 一份简短的 <strong>EO 14117 合规分析</strong>，同时把 B2B scenario roadmap 作为附件一并发过去。</p>'
        ]
      }
    ]
  },
  'rec-2': {
    title: '林啸 Memory A/B 对比测试评审 · 会议纪要',
    meta: {
      '会议时间': '2026 年 4 月 8 日（周二） 16:40 – 17:08',
      '会议时长': '28 分 04 秒',
      '参会人员': '林啸（Memory 模块负责人）、明明（Monostone CEO）、王浩（后端工程师）',
      '会议项目': 'Monostone 后端 · Memory 模块',
      '会议形式': '线上会议 · 飞书视频'
    },
    sections: [
      {
        h: '会议背景',
        paragraphs: [
          '过去两周 Monostone 后端团队在 Memory 模块上运行了一个 A/B 对比实验，目的是评估一版新的 consolidation 策略是否值得全量上线。A 组使用林啸最近开发的新 branch（更激进的 L2 promotion 触发条件 + 新的 embedding 相似度算法），B 组维持原 baseline。两周数据积累之后，本次会议的目的是基于数据做出全量切换决策。'
        ]
      },
      {
        h: '会议内容',
        paragraphs: [
          '会议开始林啸先 share 了 evaluation dashboard 上的两周数据对比。核心指标包括 memory retrieval 准确率、p95 latency、多会话泄漏率、token 消耗量。数据显示 A 组在 retrieval 准确率上显著领先 —— 从 baseline 的 71% 上升到 85%，提升了 14 个百分点。但代价也不小：p95 latency 从 320ms 涨到了 500ms，token 消耗增加了 18%。林啸特别强调，A 组的优势主要体现在长会话场景（超过 30 分钟的会议），对于短会话（少于 5 分钟的 quick command）A 组和 baseline 几乎没有差异，甚至有时 baseline 稍好。',
          '明明追问了一个关键问题：用户有没有感知到 latency 的差异？林啸展示了他们埋的用户行为数据 —— 在 A 组用户中，超过 5 秒等待的指令任务的完成率比 baseline 低了 3%，这是一个值得警惕的信号。但明明指出 3% 的差异可能在误差范围内，建议继续观察两周再下结论。随后讨论转向了另一个意外发现：B 组（baseline）在多会话并发场景下出现了 L2 记忆泄漏的 bug —— 当同一用户同时开了两个不同项目的 session 时，会出现 session A 的 memory 被错误地作为 context 引用到 session B 里的情况。王浩最早发现这个 bug，他 demo 了具体的复现步骤，大家都看得一头冷汗。林啸当场定位到这个 bug 来自 consolidation 触发条件里的一个 session_id 判断逻辑的缺陷，这个问题在 baseline 里已经存在了好几个月，只是之前没有人注意到。',
          '讨论的第三个焦点是 Memory confidence decay 机制的设计。王浩分享了他在读 spaced repetition 相关论文后的一些想法：可以借鉴 SM-2 算法，让 memory 的 confidence 随时间自然衰减 —— 如果一条 memory 在一定时间内没有被引用或确认，它的 confidence 应该自动往下掉，避免错误的早期推断一直被 Agent 当作事实使用。明明接话说这个想法和他昨天走路时录的一条灵感完全对齐，当场让 Agent 把那条灵感调出来给大家看。三个人讨论了具体的衰减曲线 —— 是用线性衰减、指数衰减还是基于 Ebbinghaus 遗忘曲线的 S 形衰减。最终的共识是用指数衰减作为 v1 实现，参数先粗调，再根据实际数据精调。',
          '会议的最后讨论了 A/B 的后续策略。三个方案被提出来：方案一是全量切到 A 组，方案二是维持 baseline 继续优化，方案三是做混合策略（根据 session 特征动态选择 A 或 B）。最终选择了方案三：短会话走 baseline（成熟稳定），长会话走 A 组（准确率明显更好）。这个混合策略的工程复杂度比单一方案高一些，但可以避免 latency 问题的同时保留 A 组的准确率优势。林啸承诺周五前完成动态切换逻辑的上线。另外也决定把 confidence decay 作为 Memory 模块的下一个正式 feature 开发，由王浩负责，下周完成原型。',
          '会议结束前明明提出了一个关于风险的担忧：如果 confidence decay 的参数调不好，可能会出现"误删有用 memory"的情况 —— 特别是那些低频但关键的 memory（比如只见过一次的重要投资人）。他建议在 v1 实现里就引入一个"受保护 memory"的概念，允许用户或 Agent 手动锁定某些 memory 不被自动衰减。林啸和王浩都认可这个建议，决定在 confidence decay 的设计里预留这个机制。'
        ]
      }
    ]
  }
};


/* ====== Action Items 数据 ======
 * 核心产品哲学: 让用户表达意图, 让 Agent 做判断.
 * 用户对每条 action item 只有 3 个操作:
 *   1. ✓ 接受 (点 checkbox) → 自动同步到提醒事项 + Linear + Memory
 *   2. ✕ 拒绝 (左滑整行) → Memory 学习"这条推断错了", 下次不要再猜
 *   3. 🎙 让 Agent 继续推进 (点中间文字 → modal → 语音告诉 Agent)
 *
 * 每条 item 有 context-aware 的 agent_suggestions —— 根据内容动态生成
 * 的 3 条建议 prompt, 用户可以 tap 快捷发给 Agent, 或用语音自己说.
 */
window.ACTION_ITEMS = {
  'rec-1': [
    {
      id: 'ai-1',
      text: 'Marshall 锁定 ODM 合作方',
      owner: 'Marshall',
      deadline: '4 月底',
      source_quote: '"Marshall 你周五前要把 ODM 供应商的事情定下来，不然影响后面的节奏。我们不能再拖了，下轮融资前必须要有一个明确的交付节奏。"',
      source_time: '14:32',
      source_card: '和敦敏的 Series A 跟进会',
      agent_suggestions: [
        '帮我起草一封 follow-up 邮件给 Marshall，语气温和但要给明确节奏',
        '查一下我们目前评估过的 ODM 候选有哪些，各自的优劣',
        '关联一下上次的硬件 roadmap 讨论，看看 ODM 选型会影响到哪些节点'
      ]
    },
    {
      id: 'ai-2',
      text: '把双麦 SNR 数据整理成 marketing 故事',
      owner: '石慧',
      deadline: '本周',
      source_quote: '"石慧你帮我把双麦 15dB 的数据提炼一下，不要用技术语言 —— 改成 freestyle recording 的场景故事，走路、开车、户外都能清晰录音。"',
      source_time: '27:18',
      source_card: '和敦敏的 Series A 跟进会',
      agent_suggestions: [
        '帮我拉一下最近三次户外录音测试的 SNR 数据，整理成表格',
        '写一版 "freestyle recording" 的场景故事草稿，三段就好',
        '查一下竞品 Sandbar、Humane 他们是怎么讲录音清晰度的'
      ]
    },
    {
      id: 'ai-3',
      text: '研究 EO 14117 美国数据法规',
      owner: '明明',
      deadline: '下周前',
      source_quote: '"明明你抽空看一下 EO 14117，这是美国对涉及敏感个人数据的外国控制技术的限制，可能影响 Monostone 进入美国市场的策略。下周前给我一份简短的分析。"',
      source_time: '38:45',
      source_card: '和敦敏的 Series A 跟进会',
      agent_suggestions: [
        '帮我查 EO 14117 最近 3 个月的执行动态',
        '找一下做 AI 硬件的中国公司是怎么应对这个法规的',
        '生成一份 1 页纸分析给 Linear 的合规团队'
      ]
    }
  ],
  'rec-2': [
    {
      id: 'ai-4',
      text: '上线 A/B 动态切换逻辑',
      owner: '林啸',
      deadline: '周五前',
      source_quote: '"那我本周把动态切换逻辑 ship 出去。短会话走 baseline，长会话走 A 组，这样 latency 和准确率都不损失。"',
      source_time: '18:22',
      source_card: '林啸 Memory A/B 对比测试评审',
      agent_suggestions: [
        '帮我看一下当前动态切换的代码 diff 和测试覆盖',
        '起草一份上线公告给团队，说清楚为什么要动态切换',
        '设定一个周四的提醒，跟进林啸的上线进度'
      ]
    },
    {
      id: 'ai-5',
      text: '集成 confidence decay 机制',
      owner: '王浩',
      deadline: '下周',
      source_quote: '"王浩你把 confidence decay 的 v1 做出来，先用指数衰减，参数粗调。记得预留受保护 memory 的锁定机制。"',
      source_time: '21:10',
      source_card: '林啸 Memory A/B 对比测试评审',
      agent_suggestions: [
        '帮我找关于 SM-2 算法和 Ebbinghaus 遗忘曲线的权威资料',
        '列一个 v1 confidence decay 的 task breakdown，按优先级',
        '关联到之前明明走路时的那条灵感录音'
      ]
    },
    {
      id: 'ai-6',
      text: '搭 evaluation dashboard 跟踪长尾指标',
      owner: '林啸',
      deadline: '本周',
      source_quote: '"顺便 dashboard 加几个长尾指标，特别是 p99 latency 和 memory 泄漏率，这样我们能提前发现问题。"',
      source_time: '24:03',
      source_card: '林啸 Memory A/B 对比测试评审',
      agent_suggestions: [
        '列一下需要跟踪的长尾指标清单',
        '看看有没有现成的 dashboard 模板可以复用',
        '关联上次 p95 latency 回归的讨论'
      ]
    }
  ]
};


/* ====== Memory 页的实体 + 洞察数据 ======
 * 对应后端: GET /v1/memory/overview
 *
 * stats       —— Memory Tree L0-L4 层级计数
 * insights    —— 今天学到的新东西 (由 LLM 从最近的长录音中抽取)
 * entities    —— 高频实体列表 (人 / 项目 / 概念 / 组织 / 事件)
 * corrections —— 用户最近的 human correction 记录 (训练反馈)
 */
window.MEMORY_OVERVIEW = {
  stats: {
    L0_scenes: 18,
    L1_projects: 12,
    L2_episodes: 234,
    L3_descriptions: 1842,
    L4_raw: 12453
  },
  insights: [
    {
      id: 'mi-1',
      body: '<b>敦敏</b> 是 Linear Capital 合伙人, 偏好 closed-loop 定位的消费硬件项目, 对 Infra 叙事持保留态度',
      source: '和敦敏的 Series A 跟进会 · 10:34',
      highlight: 'new'
    },
    {
      id: 'mi-2',
      body: 'Linear Capital 本轮带上了 <b>投资总监郑灿</b> 和合伙人 <b>马俊</b>, 阵容罕见加码, 内部对项目重视程度已拉满',
      source: '和敦敏的 Series A 跟进会 · 10:38',
      highlight: 'new'
    },
    {
      id: 'mi-3',
      body: '"freestyle recording" 是 <b>马俊</b> 建议的 marketing 主叙事, 用于替代晦涩的 "15 dB SNR" 技术语言',
      source: '和敦敏的 Series A 跟进会 · 10:58',
      highlight: 'new'
    },
    {
      id: 'mi-4',
      body: '<b>林啸</b> Memory A/B 测试: A 组检索准确率 <b>85%</b> vs baseline <b>71%</b>, 但 p95 latency 从 320ms 涨到 500ms',
      source: '林啸 Memory A/B 对比测试评审 · 16:48',
      highlight: 'new'
    }
  ],
  entities: [
    { id: 'e-1', avatar: '敦', name: '敦敏',          kind: '人',   memory_count: 12,  sub: 'Linear Capital 合伙人 · 最近出现于 Series A 跟进会' },
    { id: 'e-2', avatar: 'M',  name: 'Monostone',     kind: '项目', memory_count: 142, sub: 'AI 记忆戒指项目 · 贯穿全部长录音' },
    { id: 'e-3', avatar: 'Ma', name: 'Marshall',      kind: '人',   memory_count: 45,  sub: '硬件联创 · 前 OPPO / Harman' },
    { id: 'e-4', avatar: '林', name: '林啸',           kind: '人',   memory_count: 38,  sub: '软件联创 / CTO · Memory 架构负责' },
    { id: 'e-5', avatar: 'S',  name: 'Series A',      kind: '事件', memory_count: 23,  sub: '融资轮次 · 跨 4 次会议' },
    { id: 'e-6', avatar: '双', name: '双麦 15 dB SNR', kind: '概念', memory_count: 18,  sub: '产品核心差异化 · freestyle recording 叙事' },
    { id: 'e-7', avatar: 'L',  name: 'Linear Capital', kind: '组织', memory_count: 8,   sub: '领投方 · 上海办公室' }
  ],
  corrections: [
    {
      id: 'c-1',
      body: '你纠正: <b>敦敏</b> 不是"投资总监", 是"合伙人" · 已更新相关 7 条记忆',
      source: '2 小时前 · Agent 已学习',
      effect: 'propagated_7'
    },
    {
      id: 'c-2',
      body: '你纠正: 马俊是 <b>合伙人</b> 不是普通 MD · 已更新 3 条记忆',
      source: '昨天 · Agent 已学习',
      effect: 'propagated_3'
    }
  ]
};


/* ====== Agent IM 聊天记录 ======
 * 对应后端: GET /v1/agent/conversation?date=2026-04-09
 *
 * 消息角色: 'system' (系统提示) | 'user' | 'agent'
 * 消息类型: 'text' | 'steps' (思考步骤) | 'attachment' (附件卡片) | 'actions' (快捷按钮组) | 'typing'
 */
window.AGENT_CONVERSATION = {
  conversation_id: 'conv-2026-04-09',
  agent_model: 'Claude Opus 4.6',
  context_days_loaded: 42,
  messages: [
    {
      role: 'date',
      text: '今天 · 14:30'
    },
    {
      role: 'system',
      type: 'text',
      text: '我是你的 Agent · 已加载今天全部会议纪要和 memory · 有问题直接问, 或按住录音键说话'
    },
    {
      role: 'user',
      type: 'text',
      text: '今天上午敦敏那个会的核心结论是什么?'
    },
    {
      role: 'agent',
      type: 'text',
      text: '三个核心结论:<br>1. <b>定位已对齐</b> — 按 closed-loop 消费硬件估值, 但承认 Infra 叙事的想象空间<br>2. <b>竞争排序</b> — OpenAI 最大威胁, Apple 反而最低<br>3. <b>品类风险 > 对手风险</b> — 用双麦 15 dB + 高频交互对冲<br><br>马俊额外建议把技术语言改成 "freestyle recording" 场景叙事.'
    },
    {
      role: 'user',
      type: 'text',
      text: '帮我起草给 Marshall 的 follow-up 邮件, 基于今早这个会'
    },
    {
      role: 'agent',
      type: 'steps',
      steps: [
        { status: 'done', text: '✓ 调用 memory: 敦敏、Marshall、ODM、Series A' },
        { status: 'done', text: '✓ 检索今早 Series A 会议纪要 (42 分钟)' },
        { status: 'done', text: '✓ 分析 Marshall 的历史沟通偏好 (45 条记忆)' },
        { status: 'done', text: '✓ 参考上周四 ODM 讨论的措辞风格' }
      ]
    },
    {
      role: 'agent',
      type: 'text',
      text: '基于今早 Series A 会议 + Marshall 的沟通偏好, 起草了一版:'
    },
    {
      role: 'agent',
      type: 'attachment',
      attachment: {
        icon: '✉',
        title: 'Re: ODM 合作节奏对齐',
        sub: '收件人: marshall@monostone.com · 3 段 · 语气: 专业+友好'
      }
    },
    {
      role: 'agent',
      type: 'actions',
      actions: [
        { label: '查看全文', toast: '打开邮件全文' },
        { label: '改得正式一点', toast: 'Agent 正在重写, 调整为更正式的语气...' },
        { label: '直接发送', toast: '已通过 Gmail 发送 · 同步到 Linear' }
      ]
    },
    {
      role: 'user',
      type: 'text',
      text: '改得正式一点, 然后把双麦 SNR 数据加进去'
    },
    {
      role: 'agent',
      type: 'typing'
    }
  ]
};
