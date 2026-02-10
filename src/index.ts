#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DataStore } from "./data.js";
import { searchTranscripts, getTranscriptSegment } from "./search.js";
import type { EpisodeMeta } from "./types.js";

const REPO_ROOT = process.env.LENNYS_REPO_ROOT ?? new URL("../../", import.meta.url).pathname;

function formatEpisodeMeta(ep: EpisodeMeta): string {
  return [
    `**${ep.guest}** — ${ep.title}`,
    `发布日期: ${ep.publish_date} | 时长: ${ep.duration} | 播放量: ${ep.view_count.toLocaleString()}`,
    `话题: ${ep.keywords.length > 0 ? ep.keywords.join(", ") : "未标记"}`,
    `YouTube: ${ep.youtube_url}`,
    `文件: episodes/${ep.slug}/transcript.md`,
  ].join("\n");
}

async function main() {
  const store = new DataStore(REPO_ROOT);
  await store.load();

  const server = new McpServer({
    name: "lennys-podcast",
    version: "1.0.0",
  });

  // Tool 1: search_transcripts — 全文搜索转录稿
  server.tool(
    "search_transcripts",
    `在 Lenny's Podcast 的 ${store.getEpisodeCount()} 期转录稿中搜索关键词或短语。返回匹配的对话片段及上下文。适用于查找特定话题的讨论、观点和建议。`,
    {
      query: z.string().describe("搜索关键词或短语，如 'product market fit'、'hiring'、'growth strategy'"),
      max_results: z.number().optional().default(5).describe("最大返回结果数（默认 5）"),
    },
    async ({ query, max_results }) => {
      const results = searchTranscripts(store, query, max_results);

      if (results.length === 0) {
        return {
          content: [{ type: "text", text: `未找到与 "${query}" 相关的内容。尝试使用更宽泛的关键词。` }],
        };
      }

      const output = results.map((r, i) => {
        const header = `### ${i + 1}. ${r.episode.guest} — ${r.episode.title}`;
        const meta = `发布: ${r.episode.publish_date} | 匹配数: ${r.matches.length} | 相关度: ${r.score}`;
        const matchTexts = r.matches
          .map((m) => `**[${m.timestamp}] ${m.speaker}:**\n${m.text}`)
          .join("\n\n");
        return `${header}\n${meta}\n\n${matchTexts}`;
      });

      return {
        content: [{
          type: "text",
          text: `## 搜索结果: "${query}"\n\n共找到 ${results.length} 期相关节目\n\n${output.join("\n\n---\n\n")}`,
        }],
      };
    }
  );

  // Tool 2: get_episode — 获取单期节目信息和转录稿
  server.tool(
    "get_episode",
    "获取指定节目的元数据和转录稿内容。可通过嘉宾名称的 slug（如 'brian-chesky'）查找，也可指定时间范围只获取部分转录稿。",
    {
      slug: z.string().describe("嘉宾名称 slug，如 'brian-chesky'、'shreyas-doshi'"),
      start_time: z.string().optional().describe("起始时间戳，格式 'HH:MM:SS' 或 'MM:SS'"),
      end_time: z.string().optional().describe("结束时间戳"),
      max_chars: z.number().optional().default(8000).describe("最大返回字符数（默认 8000）"),
    },
    async ({ slug, start_time, end_time, max_chars }) => {
      const meta = store.getEpisode(slug);
      if (!meta) {
        const suggestions = store.getAllEpisodes()
          .filter((e) => e.slug.includes(slug) || e.guest.toLowerCase().includes(slug.toLowerCase()))
          .slice(0, 5)
          .map((e) => `  - ${e.slug} (${e.guest})`);

        return {
          content: [{
            type: "text",
            text: `未找到 slug "${slug}"。${suggestions.length > 0 ? `\n\n你是否在找:\n${suggestions.join("\n")}` : ""}`,
          }],
        };
      }

      const transcript = getTranscriptSegment(store, slug, start_time, end_time, max_chars);
      const metaText = formatEpisodeMeta(meta);

      return {
        content: [{
          type: "text",
          text: `## 节目信息\n\n${metaText}\n\n## 转录稿${start_time || end_time ? ` (${start_time ?? "开始"} - ${end_time ?? "结束"})` : ""}\n\n${transcript ?? "转录稿不可用"}`,
        }],
      };
    }
  );

  // Tool 3: list_topics — 列出所有话题索引
  server.tool(
    "list_topics",
    `列出 Lenny's Podcast 的所有 ${store.getTopicCount()} 个话题分类及每个话题下的节目数量。用于了解有哪些话题可以深入探索。`,
    {},
    async () => {
      const topics = store.getAllTopics()
        .sort((a, b) => b.episodeSlugs.length - a.episodeSlugs.length);

      const lines = topics.map(
        (t) => `- **${t.topic}** (${t.episodeSlugs.length} 期)`
      );

      return {
        content: [{
          type: "text",
          text: `## Lenny's Podcast 话题索引\n\n共 ${topics.length} 个话题，${store.getEpisodeCount()} 期节目\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // Tool 4: get_topic_episodes — 获取某话题下的所有节目
  server.tool(
    "get_topic_episodes",
    "获取指定话题下的所有节目列表及元数据。话题名使用连字符格式，如 'product-management'、'growth-strategy'、'leadership'。",
    {
      topic: z.string().describe("话题名称（连字符格式），如 'product-management'、'ai'、'hiring'"),
    },
    async ({ topic }) => {
      const episodes = store.getTopicEpisodes(topic);

      if (episodes.length === 0) {
        const allTopics = store.getAllTopics().map((t) => t.topic);
        const similar = allTopics
          .filter((t) => t.includes(topic) || topic.includes(t))
          .slice(0, 5);

        return {
          content: [{
            type: "text",
            text: `未找到话题 "${topic}"。${similar.length > 0 ? `\n\n相似话题: ${similar.join(", ")}` : `\n\n使用 list_topics 查看所有可用话题。`}`,
          }],
        };
      }

      const sorted = episodes.sort(
        (a, b) => (b.publish_date ?? "").localeCompare(a.publish_date ?? "")
      );

      const lines = sorted.map(
        (ep) =>
          `- **${ep.guest}** — ${ep.title}\n  ${ep.publish_date} | ${ep.duration} | slug: ${ep.slug}`
      );

      return {
        content: [{
          type: "text",
          text: `## 话题: ${topic}\n\n共 ${episodes.length} 期节目\n\n${lines.join("\n")}`,
        }],
      };
    }
  );

  // Tool 5: find_episodes — 按嘉宾/日期/关键词查找节目
  server.tool(
    "find_episodes",
    "按嘉宾姓名、日期范围或关键词查找节目。支持模糊匹配嘉宾姓名。",
    {
      guest: z.string().optional().describe("嘉宾姓名（支持模糊匹配），如 'Brian'、'Chesky'"),
      date_from: z.string().optional().describe("起始日期 YYYY-MM-DD"),
      date_to: z.string().optional().describe("结束日期 YYYY-MM-DD"),
      keyword: z.string().optional().describe("frontmatter 中的关键词标签，如 'leadership'"),
      max_results: z.number().optional().default(20).describe("最大返回数"),
    },
    async ({ guest, date_from, date_to, keyword, max_results }) => {
      let episodes = store.getAllEpisodes();

      if (guest) {
        const q = guest.toLowerCase();
        episodes = episodes.filter((e) => e.guest.toLowerCase().includes(q));
      }

      if (date_from) {
        episodes = episodes.filter((e) => e.publish_date >= date_from);
      }

      if (date_to) {
        episodes = episodes.filter((e) => e.publish_date <= date_to);
      }

      if (keyword) {
        const kw = keyword.toLowerCase();
        episodes = episodes.filter((e) =>
          e.keywords.some((k) => k.includes(kw) || kw.includes(k))
        );
      }

      episodes.sort((a, b) => (b.publish_date ?? "").localeCompare(a.publish_date ?? ""));
      const limited = episodes.slice(0, max_results);

      if (limited.length === 0) {
        return {
          content: [{ type: "text", text: "未找到符合条件的节目。尝试放宽搜索条件。" }],
        };
      }

      const lines = limited.map((ep) => formatEpisodeMeta(ep));

      return {
        content: [{
          type: "text",
          text: `## 查找结果\n\n共找到 ${episodes.length} 期节目${episodes.length > max_results ? `（显示前 ${max_results} 期）` : ""}\n\n${lines.join("\n\n---\n\n")}`,
        }],
      };
    }
  );

  // Tool 6: get_podcast_stats — 获取播客库统计信息
  server.tool(
    "get_podcast_stats",
    "获取 Lenny's Podcast 转录稿库的统计概览：总集数、话题数、最热门话题、最新/最早节目等。",
    {},
    async () => {
      const allEpisodes = store.getAllEpisodes();
      const topics = store.getAllTopics();

      const sorted = [...allEpisodes].sort((a, b) =>
        (b.publish_date ?? "").localeCompare(a.publish_date ?? "")
      );

      const topTopics = [...topics]
        .sort((a, b) => b.episodeSlugs.length - a.episodeSlugs.length)
        .slice(0, 10);

      const totalViews = allEpisodes.reduce((sum, e) => sum + (e.view_count || 0), 0);

      const latest = sorted[0];
      const earliest = sorted[sorted.length - 1];

      return {
        content: [{
          type: "text",
          text: [
            `## Lenny's Podcast 知识库统计`,
            ``,
            `- **总集数**: ${allEpisodes.length}`,
            `- **话题分类**: ${topics.length} 个`,
            `- **总播放量**: ${totalViews.toLocaleString()}`,
            `- **时间跨度**: ${earliest?.publish_date ?? "N/A"} ~ ${latest?.publish_date ?? "N/A"}`,
            ``,
            `### 最热门话题 (Top 10)`,
            ...topTopics.map((t) => `- ${t.topic} (${t.episodeSlugs.length} 期)`),
            ``,
            `### 最新节目`,
            latest ? formatEpisodeMeta(latest) : "N/A",
          ].join("\n"),
        }],
      };
    }
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("MCP Server 启动失败:", err);
  process.exit(1);
});
