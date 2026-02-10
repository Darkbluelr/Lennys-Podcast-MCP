# Lenny's Podcast MCP Server

将 [Lenny's Podcast](https://www.lennyspodcast.com/) 的 303 期转录稿变成 AI 可按需检索的知识库。通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 协议，让 Claude Code、Codex 等 AI 编程工具在对话中自动引用播客内容。

## 功能

### 基础工具

| 工具 | 说明 |
|------|------|
| `search_transcripts` | **BM25 全文搜索**转录稿，支持 OR/AND 模式，按相关度排序 |
| `get_episode` | 按嘉宾 slug 获取单期节目元数据和转录稿（支持时间范围截取） |
| `list_topics` | 列出全部 87 个话题分类及节目数 |
| `get_topic_episodes` | 获取某话题下所有节目列表 |
| `find_episodes` | 按嘉宾 / 日期 / 关键词多条件筛选 |
| `get_podcast_stats` | 知识库统计概览 |

### 增强工具（v2.0 新增）

| 工具 | 说明 |
|------|------|
| `get_advice` | 描述情境/挑战，获取多位嘉宾的相关建议和观点 |
| `compare_perspectives` | 对比多位嘉宾在同一话题上的不同观点 |
| `get_guest_expertise` | 获取嘉宾专长档案：节目、领域、主题、关键词 |
| `get_episode_insights` | 获取节目深度洞察：摘要、观点、框架、金句 |

### 技术特性

- **BM25 搜索引擎**：替代精确匹配，支持多词查询、字段加权（标题 8x > 嘉宾 6x > 关键词 5x > 描述 3x > 转录稿 1x）
- **知识层（可选）**：通过 Claude API 预计算每期节目的摘要、观点、框架、金句，增强工具输出质量
- **优雅降级**：无知识层时所有工具仍可正常工作，有知识层时输出更丰富

## 前置条件

- Node.js >= 18

## 安装

```bash
# 1. 克隆本仓库
git clone https://github.com/Darkbluelr/Lennys-Podcast-MCP.git
cd Lennys-Podcast-MCP

# 2. 安装依赖并构建
npm install
npm run build
```

## 构建知识层（可选）

知识层通过 Claude API 为每期节目生成结构化知识，可显著提升 `get_advice`、`get_episode_insights` 等工具的输出质量。

```bash
# 设置 API 密钥并运行
ANTHROPIC_API_KEY=sk-... npm run build:knowledge

# 可选参数
BATCH_SIZE=5 MAX_EPISODES=10 ANTHROPIC_API_KEY=sk-... npm run build:knowledge
```

- 脚本幂等：已处理的节目会自动跳过
- 每批次自动保存，中断后可继续
- 输出文件：`data/knowledge.json`

## 配置

### Claude Code

```bash
# 全局配置（所有项目可用）
claude mcp add lennys-podcast \
  --scope user \
  --transport stdio \
  -- node /你的路径/Lennys-Podcast-MCP/build/index.js
```

或手动编辑 `~/.claude.json`，在 `mcpServers` 中添加：

```json
{
  "lennys-podcast": {
    "command": "node",
    "args": ["/你的路径/Lennys-Podcast-MCP/build/index.js"]
  }
}
```

如果只想在单个项目中使用，在项目根目录创建 `.mcp.json`：

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

### Codex

编辑 `~/.codex/config.toml`，在 `[mcp_servers]` 部分添加：

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

> 所有配置中的 `/你的路径/` 替换为实际的绝对路径。不再需要设置 `LENNYS_REPO_ROOT` 环境变量。

## 项目结构

```
├── episodes/           # 303 期转录稿（YAML frontmatter + 对话内容）
│   └── {guest-name}/
│       └── transcript.md
├── index/              # 87 个话题索引
│   └── {topic}.md
├── src/                # MCP Server 源码
│   ├── index.ts        # 入口 + 10 个工具注册
│   ├── bm25.ts         # BM25 搜索引擎
│   ├── data.ts         # 数据加载 + 知识层
│   ├── search.ts       # 片段提取
│   ├── advice.ts       # get_advice 逻辑
│   ├── perspectives.ts # compare_perspectives 逻辑
│   ├── insights.ts     # guest_expertise + episode_insights 逻辑
│   ├── knowledge-types.ts # 知识层类型
│   └── types.ts        # 核心类型
├── scripts/
│   └── build-knowledge.ts  # 知识层构建脚本
└── data/
    └── knowledge.json  # 预计算知识（可选，需构建）
```

## 使用示例

配置完成后重启 AI 工具，即可在对话中自然使用：

- "Lenny's Podcast 里有谁讨论过 product market fit？"
- "我正在寻找产品市场契合度，有什么建议？"（触发 `get_advice`）
- "对比不同嘉宾对 hiring 的看法"（触发 `compare_perspectives`）
- "Brian Chesky 的专长领域是什么？"（触发 `get_guest_expertise`）
- "总结一下 shreyas-doshi 那期节目的核心观点"（触发 `get_episode_insights`）

AI 会自动调用对应工具检索转录稿并引用原文回答。

## 开发

```bash
# 监听文件变化自动重新编译
npm run dev

# 手动构建
npm run build

# 构建知识层
ANTHROPIC_API_KEY=sk-... npm run build:knowledge

# 启动（通常由 AI 工具自动启动，无需手动运行）
npm start
```

## 数据来源

转录稿数据来自 [chatprd/lennys-podcast-transcripts](https://github.com/chatprd/lennys-podcast-transcripts)。

## 技术栈

- TypeScript + Node.js
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP 协议实现
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — YAML frontmatter 解析
- BM25 搜索引擎（自行实现，零外部依赖）
- 纯内存索引，无需外部数据库

## 许可证

MIT
