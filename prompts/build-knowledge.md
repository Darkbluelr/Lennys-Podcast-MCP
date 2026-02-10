# 生成知识层

请为 Lenny's Podcast 的节目生成结构化知识，写入 `data/knowledge.json`。你负责的期在末尾给出。

## 步骤

### 1. 检查现有进度

读取项目根目录下的 `data/knowledge.json` 文件。如果文件存在，统计已处理的节目数量。如果不存在，从零开始。

### 2. 获取待处理节目

根据末尾给出的 slug 列表，跳过 `knowledge.json` 中已存在的 slug。

### 3. 逐期处理

对每个未处理的节目：

1. 调用 `get_episode`（slug=节目slug, max_chars=80000）读取完整转录稿
2. 从转录稿中提取以下结构化信息：

```json
{
  "slug": "guest-name",
  "summary": "200-300 词的节目摘要",
  "guestBackground": "嘉宾的职业背景和成就（1-2 句话）",
  "keyInsights": [
    "核心观点 1（一句话）",
    "核心观点 2",
    "核心观点 3",
    "核心观点 4",
    "核心观点 5"
  ],
  "actionableAdvice": [
    "可直接执行的建议 1",
    "可直接执行的建议 2",
    "可直接执行的建议 3"
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
  ],
  "topics": ["topic-1", "topic-2", "topic-3"],
  "controversialTakes": [
    "与主流观点不同的看法或反直觉的观点"
  ]
}
```

3. 将结果追加到 `knowledge.json` 的 `episodes` 对象中
4. **每处理完一期立即保存文件**（防止中断丢失进度）

### 4. 报告进度

处理完本批次后，输出本次处理的期数。

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
- **guestBackground**: 用中文写，嘉宾的职业身份和主要成就（如"Airbnb 联合创始人兼 CEO"）
- **keyInsights**: 5-8 条，每条一句话，是可以直接引用的核心观点，覆盖节目的主要论点
- **actionableAdvice**: 3-5 条，具体可执行的建议（如"在招聘时先定义角色的 scorecard 再面试"）
- **frameworks**: 嘉宾提到的所有具体方法论、模型、框架、心智模型（如果没有则留空数组）
- **quotes**: 3-5 条最有价值的原话（保留英文原文），选择有洞察力、可引用的句子
- **topics**: 3-6 个话题标签，用连字符格式（如 `product-market-fit`、`hiring`、`leadership`）
- **controversialTakes**: 嘉宾提出的反直觉观点或与主流不同的看法（如果没有则留空数组）

## 注意事项

- 如果转录稿内容不足以提取有意义的信息，仍然生成条目但标注 summary 为简短描述
- `generatedAt` 在每次保存时更新为当前时间
- 保持 `version: 1` 不变
- 尽量完备地提取信息，这些数据只会处理一次，后续工具调用依赖这些内容

---

## 你负责的期：

（用户在此处粘贴一组 slug 列表）
