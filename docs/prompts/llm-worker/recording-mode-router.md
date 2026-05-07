---
name: llm-worker-recording-mode-router
version: 3
owner: 明明
status: framework-ready · few-shot-pending
last-updated: 2026-05-07
backend-service: llm-worker
related-issue: MON-6, MON-18, MON-20, MON-38
related-data-schema: docs/data/card-recording.md (RecordingMode)
---

# llm-worker · Recording Mode Router

## 用途（v2 重新框架 · 2026-05-04 与明明拍板）

**长 vs 短录音不在这里分类** —— 由 iOS 手势直接决定（按住 = 长 / 按一下 = 短），是物理硬约束。

这个 prompt 只做一件事：**已经被手势确定为"短录音"的 transcript，分到 4 个子类之一**：
- `command` — 让 Agent 替自己做事（"帮我写邮件"、"提醒林啸…"）
- `cal` — 日程 / 有具体时间点要发生的事（"提醒我明天三点开会"、"周五约敦敏吃饭"）→ 写 Apple Calendar
- `todo` — 待办 / 自己要做但**没有具体时间**（"把书还给舟舟"、"订下月机票"）→ 写 Apple 提醒事项
- `idea` — 想法 / 反思 / 不属于前三类

> **类型 schema 演进**：
> - v1：`command | todo | idea | longRec`
> - v2（2026-05-04）：`command | cal | idea` — 删 todo 归 cal；删 longRec（手势决定）
> - **v3（2026-05-07，MON-20）**：`command | cal | todo | idea` — todo 重新引入，但限定意义：**无具体时间** → Apple 提醒事项 (EKReminder)；**有具体时间** → Apple 日历 (EKEvent) 走 cal
> - cal 和 todo 在 iOS 卡片视觉一致（4 段：head / 卡本体 / Smart Brief / 已写入），**唯一差异是写入目标 + 时间字段是否为 null**

## 调用场景

1. **正常路径**：iOS 短按手势上传 → batch-asr-worker 转写完 → llm-worker 调本 prompt → 拿 `recording_mode` → `post-recording-coordinator` 路由到 `command_execute` / `cal_parse` / `idea_attribution` 三条链路之一
2. **场景 A · 长按 fallback**（v2 新增）：iOS 长按手势上传 → batch-asr-worker 转写完 → 如果 transcript `duration_seconds < 120`（即 2 分钟），`post-recording-coordinator` **fallback 调本 prompt** 拿子类 → 当短录音处理（生成对应 detail）。**模型自动归类，不打扰用户**。

## 输入契约

```typescript
{
  recording_id: string,
  transcript: string,
  duration_seconds: number,
  recorded_at: string,            // ISO8601
  user_timezone: string,
  capture_mode: "short" | "long_fallback",  // 区分正常路径 vs 场景 A
}
```

## 输出契约

```typescript
{
  recording_mode: "command" | "cal" | "todo" | "idea",
  confidence: number,             // 0-1
  reason: string,                 // ≤ 30 字解释
  fallback_used: boolean,         // 是否走规则匹配 (confidence < 0.6)
  schema_version: 3,
}
```

## System Prompt（v2 framework，明明 review）

```
你是 Monostone 短录音子类分类器。

输入是用户在手机上「按一下」录音按钮（≤ 15 秒）说的一句话的转写文本，
或长按录音但内容很短（< 120 秒，即 2 分钟）的 fallback 场景。

你的任务：把这句话归到 3 类之一。

类型定义：

1. command — 用户让 Agent 替自己执行外部动作。
   关键词倾向："帮我..."、"让 Agent..."、"发邮件给..."、"通知..."、"安排..."（不是"安排时间"）
   特征：动作的承担者不是用户本人，需要 Agent 调外部 plugin（邮件、Linear、Slack 等）
   例："帮我写封 follow-up 邮件给敦敏"
   例："让 Agent 在 Slack 里通知一下 Marshall"

2. cal — 日程 / **有具体时间点**要发生的事。
   关键词倾向："提醒我..."、"约..."、"明天/周X/X 月 X 日..."、"X 点..."、"会议"、"碰面"
   特征：包含明确的时间点 / 时间段；动作的承担者是用户本人 + 日历
   例："提醒我周五下午三点和林啸开 1on1"
   例："下周二是舟舟生日"

3. todo — 待办 / 自己要做但**没有具体时间**。
   关键词倾向："把 X 还给..."、"订..."、"买..."、"看一下..."、"做个 POC..."（不含时间词或时间词模糊如"有空时"、"这周"、"找时间"）
   特征：用户本人要做的小事；没有具体时间点；可以延后；不是给 Agent 的指令
   例："把那本书还给舟舟"
   例："订下个月去东京的机票"
   例："找时间看一下林啸的 RFC"

4. idea — 想法 / 反思 / 灵感 / 备忘。
   特征：不属于上面两类；用户在自言自语、记一个想法、做一个判断
   例："Memory 的 L2 到 L3 promotion 可以加 confidence decay"
   例："其实我们的核心用户应该再聚焦一点"

产出 JSON，schema 见输出契约。

边界优先级（多类候选时）：
- 同时含时间词和"帮我..." → 优先 command（Agent 来 schedule 这件事）
- 含**具体时间**词（"周五 3 点" / "明天上午"）+ 自己做 → cal
- 含**模糊时间**词（"这周" / "有空时" / "找时间"）+ 自己做 → todo
- 无时间词 + 自己做 → todo
- 无时间词 + 无指令词 + 偏抽象/反思 → idea
- transcript 为空 → idea, confidence=0

confidence 校准：
- > 0.8: 关键词清晰 + 句式典型
- 0.4 ~ 0.8: 有候选词但句式不典型
- < 0.4: 让 iOS 端弹"请确认类型"卡（needs_input 状态）

reason 字段：≤ 30 字，写出关键信号（如 "出现「提醒我」+ 时间词" / "「帮我...」明确指令"）
```

## 决策规则（产品级，包到 wrapper code 里，不让 LLM 自己判断）

```python
# llm-worker 调用前后包一层规则

def classify(transcript, duration_seconds, capture_mode):
    # 1. 空 transcript 直接 idea
    if not transcript.strip():
        return {"recording_mode": "idea", "confidence": 0.0,
                "reason": "空内容", "fallback_used": False, "schema_version": 2}

    # 2. 极短内容（< 2 秒）直接 idea（误触概率高）
    if duration_seconds < 2:
        return {"recording_mode": "idea", "confidence": 0.3,
                "reason": "时长过短，可能误触", "fallback_used": True, "schema_version": 2}

    # 3. 调 LLM
    result = call_llm(transcript, duration_seconds, capture_mode)

    # 4. confidence < 0.6 走 fallback 规则补强
    if result["confidence"] < 0.6:
        rule_result = rule_based_classify(transcript)
        if rule_result:
            result.update(rule_result, fallback_used=True)

    return result


def rule_based_classify(t):
    """简单规则兜底，避免 LLM hallucinate"""
    cmd_kw = ["帮我", "让 agent", "让 ai", "发邮件", "回复", "转发", "通知"]
    cal_specific_time_kw = ["明天", "后天", "周一", "周二", "周三", "周四", "周五", "周六", "周日",
                            "下周", "号", "点", "上午", "下午", "晚上", "今晚"]
    cal_event_kw = ["约", "碰面", "见面", "会议", "1on1", "提醒我..."]
    todo_kw = ["把", "订", "买", "看一下", "做个", "做一下", "找时间", "有空"]

    t_lower = t.lower()
    if any(k in t_lower for k in cmd_kw):
        return {"recording_mode": "command", "confidence": 0.7, "reason": "命中指令关键词"}
    has_specific_time = any(k in t for k in cal_specific_time_kw)
    has_cal_event = any(k in t for k in cal_event_kw)
    if has_specific_time and has_cal_event:
        return {"recording_mode": "cal", "confidence": 0.75, "reason": "具体时间+日程词"}
    if any(k in t for k in todo_kw):
        return {"recording_mode": "todo", "confidence": 0.7, "reason": "命中待办关键词，无具体时间"}
    if has_cal_event:
        return {"recording_mode": "cal", "confidence": 0.6, "reason": "日程词但时间不明，仍归 cal"}
    return None  # idea fallback by LLM
```

## Few-shot

> **明明补 ≥ 4 个真实语料 few-shot**，覆盖：
> - 多意图（cmd + 时间）→ 优先 command 的例子
> - 含糊（短句没明确意图）→ idea 的例子
> - 中英混合 / 工作场景术语
> - 长按 fallback 场景（capture_mode = "long_fallback"）

### 示范 few-shot（我写 3 个，明明补完）

```jsonc
// Example 1: 明确 command + 含时间，优先 command
{
  "input": {
    "transcript": "帮我下周三给敦敏发一封 follow-up 邮件，重点说估值和 GTM。",
    "duration_seconds": 7,
    "capture_mode": "short"
  },
  "output": {
    "recording_mode": "command",
    "confidence": 0.95,
    "reason": "「帮我」+ 明确动作（发邮件），时间是任务约束不是日程",
    "fallback_used": false,
    "schema_version": 2
  }
}

// Example 2: 明确 cal
{
  "input": {
    "transcript": "提醒我周五下午三点和林啸开 Memory 模块评审会。",
    "duration_seconds": 6,
    "capture_mode": "short"
  },
  "output": {
    "recording_mode": "cal",
    "confidence": 0.92,
    "reason": "「提醒我」+ 具体时间 + 会议",
    "fallback_used": false,
    "schema_version": 2
  }
}

// Example 3: 模糊 → idea
{
  "input": {
    "transcript": "其实 confidence decay 这件事，应该往 SM-2 算法那个方向想。",
    "duration_seconds": 5,
    "capture_mode": "short"
  },
  "output": {
    "recording_mode": "idea",
    "confidence": 0.85,
    "reason": "无指令无时间，纯反思",
    "fallback_used": false,
    "schema_version": 2
  }
}
```

## 边界

- 空 transcript → `recording_mode="idea", confidence=0`
- duration < 2s → `recording_mode="idea", confidence=0.3, fallback_used=true`（极短误触）
- 长按 fallback (`capture_mode="long_fallback"`) → 走同一个 prompt，但不暴露给用户"模型猜的"，detail 直接当对应子类形态显示

## v3 变更点（vs v2）

| 项 | v2 | v3 |
|---|---|---|
| 输出类型 | command / cal / idea | command / cal / **todo** / idea |
| todo 类 | 删除（归 cal） | **重新引入**，限定意义：无具体时间 → Apple 提醒事项 |
| cal 类 | 涵盖所有"提醒我"语义 | 限定**有具体时间** → Apple 日历 |
| 时间词分级 | 不区分 | 区分"具体时间"vs"模糊时间" |

## 版本历史

- v1 (2026-05-02): 4 类分类骨架（含 longRec / todo）
- v2 (2026-05-04): MON-18 重新框架。手势主导长短，prompt 缩窄到短录音子类 3 选 1（cmd/cal/idea），新增长按 fallback 场景
- v3 (2026-05-07): MON-20 重新引入 todo 类（无具体时间 → Apple 提醒事项），cal 严格限定有具体时间 → Apple 日历。schema 4 类

## Eval

明明补完 few-shot 后，跑 `eval/recording-mode-router-fixtures.md`（待建）
