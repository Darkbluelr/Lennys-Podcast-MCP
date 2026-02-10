# Lenny's Podcast MCP Server

将 [Lenny's Podcast](https://www.lennyspodcast.com/) 的 303 期转录稿变成 AI 可按需检索的知识库。通过 [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) 协议，让 Claude Code、Codex 等 AI 编程工具在对话中自动引用播客内容。

## 功能

| 工具 | 说明 |
|------|------|
| `search_transcripts` | 全文搜索转录稿，返回匹配片段 + 上下文 + 相关度排序 |
| `get_episode` | 按嘉宾 slug 获取单期节目元数据和转录稿（支持时间范围截取） |
| `list_topics` | 列出全部 87 个话题分类及节目数 |
| `get_topic_episodes` | 获取某话题下所有节目列表 |
| `find_episodes` | 按嘉宾 / 日期 / 关键词多条件筛选 |
| `get_podcast_stats` | 知识库统计概览 |

## 前置条件

- Node.js >= 18
- [lennys-podcast-transcripts](https://github.com/chatprd/lennys-podcast-transcripts) 仓库（转录稿数据源）

## 安装

```bash
# 1. 克隆转录稿仓库（如果还没有）
git clone https://github.com/chatprd/lennys-podcast-transcripts.git
cd lennys-podcast-transcripts

# 2. 进入 MCP Server 目录
cd mcp-server

# 3. 安装依赖并构建
npm install
npm run build
```

## 配置

### Claude Code

```bash
# 全局配置（所有项目可用）
claude mcp add lennys-podcast \
  --scope user \
  --transport stdio \
  -e LENNYS_REPO_ROOT=/你的路径/lennys-podcast-transcripts \
  -- node /你的路径/lennys-podcast-transcripts/mcp-server/build/index.js
```

或手动编辑 `~/.claude.json`，在 `mcpServers` 中添加：

```json
{
  "lennys-podcast": {
    "command": "node",
    "args": ["/你的路径/lennys-podcast-transcripts/mcp-server/build/index.js"],
    "env": {
      "LENNYS_REPO_ROOT": "/你的路径/lennys-podcast-transcripts"
    }
  }
}
```

如果只想在单个项目中使用，在项目根目录创建 `.mcp.json`：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/lennys-podcast-transcripts/mcp-server/build/index.js"],
      "env": {
        "LENNYS_REPO_ROOT": "/你的路径/lennys-podcast-transcripts"
      }
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
args = ["/你的路径/lennys-podcast-transcripts/mcp-server/build/index.js"]

[mcp_servers.lennys-podcast.env]
LENNYS_REPO_ROOT = "/你的路径/lennys-podcast-transcripts"
```

### Claude Desktop

编辑 `~/Library/Application Support/Claude/claude_desktop_config.json`：

```json
{
  "mcpServers": {
    "lennys-podcast": {
      "command": "node",
      "args": ["/你的路径/lennys-podcast-transcripts/mcp-server/build/index.js"],
      "env": {
        "LENNYS_REPO_ROOT": "/你的路径/lennys-podcast-transcripts"
      }
    }
  }
}
```

> 所有配置中的 `/你的路径/` 替换为实际的绝对路径。

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `LENNYS_REPO_ROOT` | 转录稿仓库根目录的绝对路径 | MCP Server 上两级目录 |

## 使用示例

配置完成后重启 AI 工具，即可在对话中自然使用：

- "Lenny's Podcast 里有谁讨论过 product market fit？"
- "Brian Chesky 在播客里说了什么关于 founder mode 的内容？"
- "列出所有关于 hiring 话题的节目"
- "搜索关于 growth strategy 的观点"

AI 会自动调用对应工具检索转录稿并引用原文回答。

## 开发

```bash
# 监听文件变化自动重新编译
npm run dev

# 手动构建
npm run build

# 启动（通常由 AI 工具自动启动，无需手动运行）
npm start
```

## 技术栈

- TypeScript + Node.js
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP 协议实现
- [gray-matter](https://github.com/jonschlinkert/gray-matter) — YAML frontmatter 解析
- 纯内存索引，无需外部数据库

## 许可证

MIT
