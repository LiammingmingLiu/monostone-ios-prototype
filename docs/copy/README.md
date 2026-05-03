---
type: copy-library
audience: 林啸 + Prima（CMO 调品牌口吻时）
authority: 这是文案的单一来源；任何 view 里的 toast / 空态 / 错误文字必须 import 这里
---

# 文案库

## 为什么集中收口

- 散文案 → 改一遍要找 N 个文件
- LLM vibecoding 时容易自己造词，破坏一致性
- Prima 调品牌口吻时改一个文件就全改

## 文件分工

| 文件 | 内容 |
|---|---|
| [toast.md](toast.md) | 操作反馈：成功 / 撤销 / 进行中 |
| [empty-state.md](empty-state.md) | 列表为空 / 第一次打开 / 网络断 |
| [error.md](error.md) | API 失败 / 权限拒绝 / 后端异常 |

## 通用规则

- 字数 ≤ 14（toast）；空态 ≤ 30；错误 ≤ 40
- 用 `·` 分隔主信息 + 副信息（不用句号、感叹号）
- 时间统一格式：`今天 15:00` / `明天 09:30` / `5 月 8 日 14:00`
- 引用功能名用反引号（如 `已加到` `提醒事项`）
- 不在文案里出现技术词（`API` `服务器` `endpoint`）；改用"网络" "记忆" "Agent"

## 林啸 vibecoding 怎么用

```swift
// ❌ 不要
Text("已删除")

// ✅ 要
Text(Copy.actionItem.deleted)  // → 来自 docs/copy/toast.md
```

实现细节：用 Swift 的 enum + 静态属性把 docs/copy/*.md 的所有 key codify 一份。

## TODO（明明）

- [ ] 决定 Copy 这个 enum 的位置（App/Core/Copy.swift）
- [ ] toast 文案库填充
- [ ] empty-state 文案库填充
- [ ] error 文案库填充
