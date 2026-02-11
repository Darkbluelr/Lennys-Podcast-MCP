# Lenny's Podcast MCP Server

将 [Lenny's Podcast](https://www.lennyspodcast.com/) 的 303 期转录稿变成 AI 可检索的知识库。通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 协议，让 Claude Code、Codex、Gemini CLI 等 AI 工具在对话中自动引用播客内容。

## 你可以用它做什么

- **搜索转录稿** — 在 303 期节目中全文搜索任意关键词，BM25 算法按相关度排序
- **获取建议** — 描述你面临的挑战，获取来自硅谷顶级产品经理、创始人、投资人的相关建议
- **对比观点** — 对比多位嘉宾在同一话题上的不同看法（如招聘策略、增长方法）
- **查看嘉宾档案** — 了解某位嘉宾的专长领域、出现节目、核心主题
- **获取节目洞察** — 查看每期节目的摘要、核心观点、框架方法论、金句、可执行建议

## 10 个工具

| 工具 | 说明 |
|------|------|
| `search_transcripts` | BM25 全文搜索，支持 OR/AND 模式 |
| `get_episode` | 按嘉宾 slug 获取元数据和转录稿 |
| `list_topics` | 列出全部 87 个话题分类 |
| `get_topic_episodes` | 获取某话题下所有节目 |
| `find_episodes` | 按嘉宾 / 日期 / 关键词筛选 |
| `get_podcast_stats` | 知识库统计概览 |
| `get_advice` | 基于情境的多嘉宾建议 |
| `compare_perspectives` | 多嘉宾视角对比 |
| `get_guest_expertise` | 嘉宾专长档案 |
| `get_episode_insights` | 节目深度洞察（摘要/观点/框架/金句） |

## 安装

```bash
git clone https://github.com/Darkbluelr/Lennys-Podcast-MCP.git
cd Lennys-Podcast-MCP
npm install
npm run build
```

## 配置

### Claude Code

```bash
claude mcp add lennys-podcast \
  --scope user \
  --transport stdio \
  -- node /你的路径/Lennys-Podcast-MCP/build/index.js
```

### Codex

编辑 `~/.codex/config.toml`：

```toml
[mcp_servers.lennys-podcast]
type = "stdio"
command = "node"
args = ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
```

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
    }
  }
}
```

### Gemini CLI

编辑 `~/.gemini/settings.json`：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
    }
  }
}
```

> 将 `/你的路径/` 替换为实际的绝对路径。

## 使用示例

配置完成后重启 AI 工具，即可在对话中自然使用：

- "Lenny's Podcast 里有谁讨论过 product market fit？"
- "我正在寻找产品市场契合度，有什么建议？"
- "对比不同嘉宾对 hiring 的看法"
- "Brian Chesky 的专长领域是什么？"
- "总结一下 shreyas-doshi 那期节目的核心观点"

## 项目结构

```
├── episodes/           # 303 期转录稿（YAML frontmatter + 对话内容）
│   └── {guest-name}/
│       └── transcript.md
├── index/              # 87 个话题索引
│   └── {topic}.md
├── data/
│   └── knowledge.json  # 303 期节目的结构化知识（摘要/观点/框架/金句）
├── src/                # MCP Server 源码
│   ├── index.ts        # 入口 + 10 个工具注册
│   ├── bm25.ts         # BM25 搜索引擎
│   ├── data.ts         # 数据加载
│   ├── search.ts       # 片段提取
│   ├── advice.ts       # get_advice 逻辑
│   ├── perspectives.ts # compare_perspectives 逻辑
│   ├── insights.ts     # guest_expertise + episode_insights 逻辑
│   ├── knowledge-types.ts # 知识层类型
│   └── types.ts        # 核心类型
└── build/              # 编译输出
```

## 技术栈

- TypeScript + Node.js
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP 协议实现
- BM25 搜索引擎（自行实现，零外部依赖）
- 纯内存索引，启动时构建，无需外部数据库

## 数据来源

转录稿来自 [chatprd/lennys-podcast-transcripts](https://github.com/chatprd/lennys-podcast-transcripts)。

## 许可证

MIT
