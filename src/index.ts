#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { DataStore } from "./data.js";
import { searchTranscripts, getTranscriptSegment, extractMatchSegments } from "./search.js";
import { buildBM25Index, searchBM25, tokenize } from "./bm25.js";
import type { BM25Index } from "./bm25.js";
import { getAdvice } from "./advice.js";
import { comparePerspectives } from "./perspectives.js";
import { getGuestExpertise, getEpisodeInsights } from "./insights.js";
import type { EpisodeMeta } from "./types.js";

const REPO_ROOT = process.env.LENNYS_REPO_ROOT ?? new URL("../", import.meta.url).pathname;

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

  // 构建 BM25 索引
  const bm25Index = buildBM25Index(store);

  const server = new McpServer({
    name: "lennys-podcast",
    version: "2.0.0",
  });

  // Tool 1: search_transcripts — BM25 全文搜索转录稿
  server.tool(
    "search_transcripts",
    `在 Lenny's Podcast 的 ${store.getEpisodeCount()} 期转录稿中搜索关键词或短语。使用 BM25 算法按相关度排序，支持多词查询。返回匹配的对话片段及上下文。适用于查找特定话题的讨论、观点和建议。`,
    {
      query: z.string().describe("搜索关键词或短语，如 'product market fit'、'hiring'、'growth strategy'"),
      max_results: z.number().optional().default(5).describe("最大返回结果数（默认 5）"),
      mode: z.enum(["OR", "AND"]).optional().default("OR").describe("搜索模式：OR（默认，更灵活）或 AND（要求包含所有词）"),
    },
    async ({ query, max_results, mode }) => {
      const bm25Results = searchBM25(bm25Index, store, query, {
        maxResults: max_results,
        mode,
      });

      if (bm25Results.length === 0) {
        return {
          content: [{ type: "text", text: `未找到与 "${query}" 相关的内容。尝试使用更宽泛的关键词或切换到 OR 模式。` }],
        };
      }

      const queryTerms = tokenize(query);
      const output = bm25Results.map((r, i) => {
        const meta = store.getEpisode(r.slug);
        if (!meta) return "";
        const matches = extractMatchSegments(store, r.slug, queryTerms, 3, 1);
        const header = `### ${i + 1}. ${meta.guest} — ${meta.title}`;
        const metaLine = `发布: ${meta.publish_date} | 相关度: ${r.score.toFixed(1)}`;
        const matchTexts = matches.length > 0
          ? matches.map((m) => `**[${m.timestamp}] ${m.speaker}:**\n${m.text}`).join("\n\n")
          : `话题: ${meta.keywords.join(", ")}`;
        return `${header}\n${metaLine}\n\n${matchTexts}`;
      }).filter(Boolean);

      return {
        content: [{
          type: "text",
          text: `## 搜索结果: "${query}" (${mode} 模式)\n\n共找到 ${bm25Results.length} 期相关节目\n\n${output.join("\n\n---\n\n")}`,
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
            `- **知识层**: ${store.hasKnowledge() ? "已加载" : "未构建（使用 npm run build:knowledge 生成）"}`,
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

  // Tool 7: get_advice — 基于播客内容的情境化建议
  server.tool(
    "get_advice",
    "描述你面临的情境或挑战，获取来自多位播客嘉宾（硅谷顶级产品经理、创始人、投资人）的相关建议和观点。适用于产品、增长、招聘、领导力、创业等话题。",
    {
      situation: z.string().describe("描述你面临的情境或挑战，如 '我正在寻找产品市场契合度' 或 '如何建立高效的产品团队'"),
      max_sources: z.number().optional().default(5).describe("最大引用来源数（默认 5）"),
    },
    async ({ situation, max_sources }) => {
      const result = getAdvice(store, bm25Index, situation, max_sources);

      if (result.sources.length === 0) {
        return {
          content: [{ type: "text", text: `未找到与此情境相关的建议。尝试用不同的方式描述你的挑战。` }],
        };
      }

      const sections = result.sources.map((s, i) => {
        const lines = [
          `### ${i + 1}. ${s.guest} — ${s.episodeTitle}`,
          `slug: ${s.slug}`,
        ];
        if (s.insight) {
          lines.push(`\n**核心观点**: ${s.insight}`);
        }
        lines.push(`\n**相关讨论片段**:`);
        for (const seg of s.segments) {
          lines.push(seg);
        }
        return lines.join("\n");
      });

      const footer = result.hasKnowledge
        ? ""
        : "\n\n---\n*提示: 运行 `npm run build:knowledge` 构建知识层可获得更丰富的预计算观点。*";

      return {
        content: [{
          type: "text",
          text: `## 来自 Lenny's Podcast 嘉宾的建议\n\n**情境**: ${situation}\n\n共找到 ${result.sources.length} 位专家的相关观点\n\n${sections.join("\n\n---\n\n")}${footer}`,
        }],
      };
    }
  );

  // Tool 8: compare_perspectives — 多嘉宾视角对比
  server.tool(
    "compare_perspectives",
    "对比多位播客嘉宾在同一话题上的不同观点和方法论。适用于了解业界对某个话题的多元看法，如招聘策略、增长方法、产品优先级等。",
    {
      topic: z.string().describe("要对比的话题，如 'hiring'、'product market fit'、'pricing strategy'"),
      max_guests: z.number().optional().default(6).describe("最大对比嘉宾数（默认 6）"),
    },
    async ({ topic, max_guests }) => {
      const result = comparePerspectives(store, bm25Index, topic, max_guests);

      if (result.perspectives.length === 0) {
        return {
          content: [{ type: "text", text: `未找到关于 "${topic}" 的多方观点。尝试使用更宽泛的话题描述。` }],
        };
      }

      const sections = result.perspectives.map((p, i) => {
        const lines = [
          `### ${i + 1}. ${p.guest}`,
          `节目: ${p.episodeTitle} (${p.slug})`,
        ];
        if (p.insight) {
          lines.push(`\n**核心观点**: ${p.insight}`);
        }
        lines.push(`\n**相关发言**:`);
        for (const v of p.viewpoints) {
          lines.push(v);
        }
        return lines.join("\n");
      });

      const footer = result.hasKnowledge
        ? ""
        : "\n\n---\n*提示: 构建知识层后可获得更精准的观点提取和对比。*";

      return {
        content: [{
          type: "text",
          text: `## 多视角对比: "${topic}"\n\n共 ${result.guestCount} 位嘉宾的观点\n\n${sections.join("\n\n---\n\n")}${footer}`,
        }],
      };
    }
  );

  // Tool 9: get_guest_expertise — 嘉宾专长档案
  server.tool(
    "get_guest_expertise",
    "获取指定嘉宾的专长档案：出现的节目、专长领域、核心主题、高频关键词。支持模糊匹配姓名。",
    {
      guest: z.string().describe("嘉宾姓名（支持模糊匹配），如 'Brian Chesky'、'Shreyas'、'Lenny'"),
    },
    async ({ guest }) => {
      const result = getGuestExpertise(store, guest);

      if (!result) {
        const suggestions = store.getAllEpisodes()
          .filter((e) => e.guest.toLowerCase().includes(guest.toLowerCase().slice(0, 3)))
          .map((e) => e.guest)
          .filter((v, i, a) => a.indexOf(v) === i)
          .slice(0, 5);

        return {
          content: [{
            type: "text",
            text: `未找到嘉宾 "${guest}"。${suggestions.length > 0 ? `\n\n你是否在找:\n${suggestions.map((s) => `  - ${s}`).join("\n")}` : ""}`,
          }],
        };
      }

      const lines = [
        `## 嘉宾档案: ${result.name}`,
        ``,
        `**出现节目**: ${result.episodes.length} 期`,
      ];

      if (result.bio) {
        lines.push(`**简介**: ${result.bio}`);
      }

      if (result.expertiseAreas.length > 0) {
        lines.push(`\n### 专长领域`);
        for (const area of result.expertiseAreas) {
          lines.push(`- ${area}`);
        }
      }

      if (result.keyThemes && result.keyThemes.length > 0) {
        lines.push(`\n### 核心主题`);
        for (const theme of result.keyThemes) {
          lines.push(`- ${theme}`);
        }
      }

      if (result.topKeywords.length > 0) {
        lines.push(`\n### 高频话题标签`);
        lines.push(result.topKeywords.join(", "));
      }

      lines.push(`\n### 节目列表`);
      for (const ep of result.episodes) {
        lines.push(`- **${ep.title}** (${ep.date}) — slug: ${ep.slug}`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
      };
    }
  );

  // Tool 10: get_episode_insights — 节目深度洞察
  server.tool(
    "get_episode_insights",
    "获取指定节目的深度洞察：摘要、核心观点、框架方法论、金句。如已构建知识层则返回预计算的结构化知识，否则返回基于 metadata 和首尾片段的概览。",
    {
      slug: z.string().describe("节目 slug，如 'brian-chesky'、'shreyas-doshi'"),
    },
    async ({ slug }) => {
      const result = getEpisodeInsights(store, slug);

      if (!result) {
        const suggestions = store.getAllEpisodes()
          .filter((e) => e.slug.includes(slug) || e.guest.toLowerCase().includes(slug.toLowerCase()))
          .slice(0, 5)
          .map((e) => `  - ${e.slug} (${e.guest})`);

        return {
          content: [{
            type: "text",
            text: `未找到节目 "${slug}"。${suggestions.length > 0 ? `\n\n你是否在找:\n${suggestions.join("\n")}` : ""}`,
          }],
        };
      }

      const lines = [
        `## ${result.guest} — ${result.title}`,
        `发布: ${result.date} | 话题: ${result.keywords.join(", ")}`,
      ];

      if (result.summary) {
        lines.push(`\n### 摘要\n${result.summary}`);
      }

      if (result.keyInsights && result.keyInsights.length > 0) {
        lines.push(`\n### 核心观点`);
        for (const insight of result.keyInsights) {
          lines.push(`- ${insight}`);
        }
      }

      if (result.frameworks && result.frameworks.length > 0) {
        lines.push(`\n### 框架与方法论`);
        for (const f of result.frameworks) {
          lines.push(`- **${f.name}**: ${f.description}`);
        }
      }

      if (result.quotes && result.quotes.length > 0) {
        lines.push(`\n### 金句`);
        for (const q of result.quotes) {
          lines.push(`> "${q.text}" — ${q.speaker}`);
        }
      }

      if (result.overview) {
        lines.push(`\n### 节目概览`);
        lines.push(`**描述**: ${result.overview.description}`);
        lines.push(`\n**开场片段**:\n${result.overview.intro}`);
        lines.push(`\n**结尾片段**:\n${result.overview.closing}`);
        lines.push(`\n---\n*提示: 运行 \`npm run build:knowledge\` 构建知识层可获得完整的摘要、观点和框架提取。*`);
      }

      return {
        content: [{ type: "text", text: lines.join("\n") }],
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
