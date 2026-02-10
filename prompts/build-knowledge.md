# 生成知识层

请为 Lenny's Podcast 的节目生成结构化知识，写入 `data/knowledge.json`。

## 步骤

### 1. 检查现有进度

读取项目根目录下的 `data/knowledge.json` 文件。如果文件存在，统计已处理的节目数量。如果不存在，从零开始。

### 2. 获取待处理节目

调用 `get_podcast_stats` 获取总节目数，然后调用 `find_episodes`（max_results=303）获取完整节目列表。跳过 `knowledge.json` 中已存在的 slug。

### 3. 逐期处理（每次对话处理 10 期）

对每个未处理的节目：

1. 调用 `get_episode`（slug=节目slug, max_chars=8000）读取转录稿
2. 从转录稿中提取以下结构化信息：

```json
{
  "slug": "guest-name",
  "summary": "200-300 词的节目摘要，概括主要讨论内容和结论",
  "keyInsights": [
    "核心观点 1（一句话）",
    "核心观点 2",
    "核心观点 3"
  ],
  "frameworks": [
    {
      "name": "框架/方法论名称",
      "description": "简要描述该框架的核心思想和应用方式"
    }
  ],
  "quotes": [
    {
      "text": "值得记住的原话",
      "speaker": "说话人姓名"
    }
  ]
}
```

3. 将结果追加到 `knowledge.json` 的 `episodes` 对象中
4. **每处理完一期立即保存文件**（防止中断丢失进度）

### 4. 报告进度

处理完本批次后，输出：
- 本次处理了 X 期
- 总进度：已完成 Y / 303 期
- 如未全部完成，提示用户再次发送本提示词继续

## knowledge.json 格式

```json
{
  "episodes": {
    "guest-slug": { ... },
    "another-guest": { ... }
  },
  "generatedAt": "2025-01-01T00:00:00Z",
  "version": 1
}
```

## 提取指南

- **summary**: 用中文写，概括嘉宾是谁、讨论了什么、得出了什么结论
- **keyInsights**: 3-5 条，每条一句话，是可以直接引用的观点
- **frameworks**: 嘉宾提到的具体方法论、模型、框架（如果没有则留空数组）
- **quotes**: 2-3 条最有价值的原话（保留英文原文），选择有洞察力、可引用的句子

## 注意事项

- 每次对话只处理 10 期，避免上下文耗尽
- 如果转录稿内容不足以提取有意义的信息，仍然生成条目但标注 summary 为简短描述
- `generatedAt` 在每次保存时更新为当前时间
- 保持 `version: 1` 不变
