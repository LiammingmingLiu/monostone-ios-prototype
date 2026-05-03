---
type: data-schema
entity: Recording / RecordingSummary / RecordingUnderstanding
backend-source:
  - POST /recordings (multimodal-ingestion-service)
  - GET /recordings/{recording_id}/summary (understanding-service)
  - GET /recordings/{recording_id}/understanding (understanding-service)
related-prompts:
  - docs/prompts/llm-worker/summary-prompt.md
  - docs/prompts/llm-worker/understanding-prompt.md
  - docs/prompts/llm-worker/recording-mode-router.md
related-spec: docs/features/M1-recording-and-multimodal.md
---

# Card · Recording

> iOS HomeView 的卡片 + RecordingDetailView 的所有数据来自这三个后端响应：
> - `POST /recordings` 创建时返回 `recording_id`
> - `GET /recordings/{id}/summary` 拿摘要
> - `GET /recordings/{id}/understanding` 拿结构化理解（参与人 / Action Items / 决策 / Memory 节点）

## Recording (创建时)

```swift
struct Recording: Codable, Identifiable {
    let id: String                  // recording_id
    let createdAt: String           // ISO8601
    let durationSeconds: Int
    let recordingMode: RecordingMode  // command / todo / idea / longRec, 由 llm-worker 决定
    let status: RecordingStatus
    var schemaVersion: Int = 1

    enum CodingKeys: String, CodingKey {
        case id = "recording_id"
        case createdAt = "created_at"
        case durationSeconds = "duration_seconds"
        case recordingMode = "recording_mode"
        case status
        case schemaVersion = "schema_version"
    }
}

enum RecordingStatus: String, Codable {
    case uploading    // iOS 端
    case transcribing // batch-asr-worker 处理中
    case structuring  // llm-worker 处理中
    case done
    case failed
}

enum RecordingMode: String, Codable {
    case command, todo, idea, longRec
}
```

## RecordingSummary (`GET /recordings/{id}/summary`)

```swift
struct RecordingSummary: Codable {
    let recordingId: String
    let title: String                  // LLM 生成，可被用户编辑
    let oneLineSummary: String         // 1-2 句概览
    let durationSeconds: Int
    let createdAt: String
    let participants: [Participant]?   // longRec 才有
    var schemaVersion: Int = 1

    enum CodingKeys: String, CodingKey {
        case recordingId = "recording_id"
        case title, participants
        case oneLineSummary = "one_line_summary"
        case durationSeconds = "duration_seconds"
        case createdAt = "created_at"
        case schemaVersion = "schema_version"
    }
}

struct Participant: Codable, Identifiable {
    let id: String
    let displayName: String
    let avatarURL: String?
    let confidence: Double  // 说话人识别置信度
}
```

## RecordingUnderstanding (`GET /recordings/{id}/understanding`)

```swift
struct RecordingUnderstanding: Codable {
    let recordingId: String
    let recordingMode: RecordingMode
    let structuredSummary: StructuredSummary?  // 6 section 中的 §结构化摘要
    let actionItems: [ActionItem]
    let decisions: [Decision]
    let memoryNodeIds: [String]                 // 写入 memory-tree 的节点 id
    let fullTranscript: String                  // ASR 原文
    let ideaAttribution: IdeaAttribution?       // recordingMode=idea 才有
    let commandDraft: CommandDraft?             // recordingMode=command 才有
    let todoParse: TodoParse?                   // recordingMode=todo 才有
    var schemaVersion: Int = 1

    // CodingKeys 略
}

struct StructuredSummary: Codable {
    let sections: [SummarySection]
}

struct ActionItem: Codable, Identifiable {
    let id: String
    let text: String
    let owner: String?      // 责任人（说话人识别 + 用户校正）
    let dueAt: String?      // ISO8601
    let status: ActionItemStatus
    let syncTarget: SyncTarget?  // reminders / linear / null
}

enum ActionItemStatus: String, Codable {
    case pending, accepted, deleted, completed
}

struct Decision: Codable, Identifiable {
    let id: String
    let text: String
    let rationale: String?  // 决策依据，可选展开
}

// ===== 灵感（M1）=====
struct IdeaAttribution: Codable {
    let primaryProjectId: String?
    let primaryProjectConfidence: Double  // 0-1, < 0.6 让用户选
    let candidates: [ProjectCandidate]
    let relatedIdeaIds: [String]          // 相关灵感 memory_node_ids
}

struct ProjectCandidate: Codable {
    let projectId: String
    let confidence: Double
    let reason: String
}

// ===== 短录音 command（M2）=====
struct CommandDraft: Codable {
    let commandType: CommandType  // email / calendar / linear / slack ...
    let payload: [String: AnyCodable]  // 类型化的草稿内容
    let suggestedPluginId: String      // 例如 "email-sender"
    let needsUserConfirmation: Bool
}

enum CommandType: String, Codable {
    case email, calendarEvent, linearIssue, slack, custom
}

// ===== 短录音 todo（M2）=====
struct TodoParse: Codable {
    let parsedTitle: String
    let scheduledAt: String?    // ISO8601, 可空
    let location: String?
    let recurrence: String?     // RRULE 字符串
    let confidence: Double
    let conflicts: [CalendarConflict]?  // EventKit 冲突检测
}
```

## JSON 例子

```json
{
  "recording_id": "rec_01HX...",
  "recording_mode": "longRec",
  "structured_summary": {
    "sections": [...]
  },
  "action_items": [
    {
      "id": "ai_01...",
      "text": "周五前发送 Series A 跟进邮件给敦敏",
      "owner": "明明",
      "due_at": "2026-05-08T17:00:00+08:00",
      "status": "pending",
      "sync_target": "reminders"
    }
  ],
  "memory_node_ids": ["mn_01...", "mn_02..."],
  "schema_version": 1
}
```

## TODO（让林啸 curl 一份样本贴回来）

- [ ] `GET /recordings/{id}/summary` 真实 sample
- [ ] `GET /recordings/{id}/understanding` 真实 sample（4 种 mode 各一个）
- [ ] 校对字段名是否完全一致
