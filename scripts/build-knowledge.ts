#!/usr/bin/env npx tsx
/**
 * 知识层构建脚本
 *
 * 使用 Claude API 为每期节目生成结构化知识（摘要/观点/框架/金句），
 * 并聚合嘉宾档案。
 *
 * 用法:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/build-knowledge.ts
 *
 * 环境变量:
 *   ANTHROPIC_API_KEY  — Claude API 密钥（必需）
 *   LENNYS_REPO_ROOT   — 仓库根目录（默认: ../）
 *   BATCH_SIZE          — 并发数（默认: 3）
 *   MAX_EPISODES        — 最大处理集数（默认: 全部，调试用）
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

// 类型定义（与 src/knowledge-types.ts 一致）
interface Framework {
  name: string;
  description: string;
  source: string;
}
interface Quote {
  text: string;
  speaker: string;
  context: string;
}
interface EpisodeKnowledge {
  slug: string;
  summary: string;
  keyInsights: string[];
  frameworks: Framework[];
  quotes: Quote[];
  adviceTopics: string[];
}
interface GuestProfile {
  name: string;
  episodes: string[];
  expertiseAreas: string[];
  keyThemes: string[];
  bio: string;
}
interface KnowledgeBase {
  episodes: Record<string, EpisodeKnowledge>;
  guests: Record<string, GuestProfile>;
  version: string;
  generatedAt: string;
}

const SCRIPT_DIR = import.meta.dirname ?? new URL(".", import.meta.url).pathname;
const REPO_ROOT = process.env.LENNYS_REPO_ROOT ?? join(SCRIPT_DIR, "../../");
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE ?? "3", 10);
const MAX_EPISODES = process.env.MAX_EPISODES ? parseInt(process.env.MAX_EPISODES, 10) : Infinity;
const OUTPUT_PATH = join(SCRIPT_DIR, "../data/knowledge.json");
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
  console.error("错误: 请设置 ANTHROPIC_API_KEY 环境变量");
  process.exit(1);
}

// 加载已有知识（幂等）
function loadExisting(): KnowledgeBase {
  if (existsSync(OUTPUT_PATH)) {
    try {
      return JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
    } catch {
      // 文件损坏，重新开始
    }
  }
  return {
    episodes: {},
    guests: {},
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
  };
}

// 获取所有节目 slug
function getAllSlugs(): string[] {
  const episodesDir = join(REPO_ROOT, "episodes");
  return readdirSync(episodesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("."))
    .map((d) => d.name);
}

// 读取节目内容（frontmatter + 转录稿前 2000 词 + 后 500 词）
function readEpisodeContent(slug: string): { meta: Record<string, any>; content: string } | null {
  const filePath = join(REPO_ROOT, "episodes", slug, "transcript.md");
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, "utf-8");
  const { data, content } = matter(raw);

  const words = content.split(/\s+/);
  const head = words.slice(0, 2000).join(" ");
  const tail = words.length > 2500 ? words.slice(-500).join(" ") : "";
  const truncated = tail ? `${head}\n\n[...中间省略...]\n\n${tail}` : head;

  return { meta: data, content: truncated };
}

// 调用 Claude API
async function callClaude(prompt: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Claude API 错误 (${response.status}): ${err}`);
  }

  const result = await response.json() as any;
  return result.content[0].text;
}

// 为单期节目生成知识
async function processEpisode(slug: string): Promise<EpisodeKnowledge | null> {
  const episode = readEpisodeContent(slug);
  if (!episode) return null;

  const { meta, content } = episode;
  const guest = meta.guest ?? slug;
  const title = meta.title ?? "";
  const keywords = (meta.keywords ?? []).join(", ");

  const prompt = `你是一个播客知识提取专家。请分析以下 Lenny's Podcast 节目的转录稿，提取结构化知识。

节目信息:
- 嘉宾: ${guest}
- 标题: ${title}
- 关键词: ${keywords}

转录稿内容:
${content}

请以 JSON 格式返回以下信息（不要包含 markdown 代码块标记）:
{
  "summary": "200-300 词的中英文混合摘要，概括节目核心内容",
  "keyInsights": ["3-5 条核心观点，每条 1-2 句话"],
  "frameworks": [{"name": "框架名称", "description": "简要描述", "source": "${guest}"}],
  "quotes": [{"text": "原文金句", "speaker": "说话人", "context": "上下文说明"}],
  "adviceTopics": ["适用的建议话题标签，如 product-market-fit, hiring, growth 等"]
}

注意:
- frameworks 只提取嘉宾明确提出的方法论/框架，没有则返回空数组
- quotes 选择最有洞察力的 2-3 句金句
- adviceTopics 用英文小写连字符格式
- 直接返回 JSON，不要包含任何其他文字`;

  const response = await callClaude(prompt);

  try {
    // 清理可能的 markdown 代码块标记
    const cleaned = response.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      slug,
      summary: parsed.summary ?? "",
      keyInsights: parsed.keyInsights ?? [],
      frameworks: parsed.frameworks ?? [],
      quotes: parsed.quotes ?? [],
      adviceTopics: parsed.adviceTopics ?? [],
    };
  } catch (e) {
    console.error(`  解析 ${slug} 的 JSON 响应失败:`, e);
    return null;
  }
}

// 聚合嘉宾档案
function buildGuestProfiles(
  kb: KnowledgeBase,
  allMeta: Map<string, Record<string, any>>
): void {
  const guestEpisodes = new Map<string, string[]>();
  const guestKeywords = new Map<string, Map<string, number>>();

  for (const [slug, meta] of allMeta) {
    const guest = (meta.guest ?? slug) as string;
    const key = guest.toLowerCase();

    if (!guestEpisodes.has(key)) {
      guestEpisodes.set(key, []);
      guestKeywords.set(key, new Map());
    }
    guestEpisodes.get(key)!.push(slug);

    for (const kw of (meta.keywords ?? []) as string[]) {
      const kwMap = guestKeywords.get(key)!;
      kwMap.set(kw, (kwMap.get(kw) ?? 0) + 1);
    }
  }

  for (const [key, slugs] of guestEpisodes) {
    const firstMeta = allMeta.get(slugs[0]);
    const name = (firstMeta?.guest ?? key) as string;

    // 从知识层提取主题
    const themes = new Set<string>();
    const expertise = new Set<string>();
    for (const slug of slugs) {
      const ek = kb.episodes[slug];
      if (ek) {
        for (const topic of ek.adviceTopics) expertise.add(topic);
        for (const insight of ek.keyInsights.slice(0, 2)) {
          themes.add(insight.slice(0, 80));
        }
      }
    }

    const topKw = Array.from(guestKeywords.get(key)!.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kw]) => kw);

    kb.guests[key] = {
      name,
      episodes: slugs,
      expertiseAreas: Array.from(expertise).slice(0, 8),
      keyThemes: Array.from(themes).slice(0, 5),
      bio: `${name} 在 Lenny's Podcast 中出现 ${slugs.length} 次，主要讨论 ${topKw.slice(0, 3).join("、")} 等话题。`,
    };
  }
}

// 批量处理
async function processBatch(slugs: string[], kb: KnowledgeBase): Promise<number> {
  let processed = 0;
  for (let i = 0; i < slugs.length; i += BATCH_SIZE) {
    const batch = slugs.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (slug) => {
        console.log(`  处理: ${slug}`);
        const knowledge = await processEpisode(slug);
        if (knowledge) {
          kb.episodes[slug] = knowledge;
          processed++;
        }
      })
    );

    for (const r of results) {
      if (r.status === "rejected") {
        console.error(`  批次错误:`, r.reason);
      }
    }

    // 每批次后保存（防止中断丢失）
    saveKnowledge(kb);
    console.log(`  进度: ${Math.min(i + BATCH_SIZE, slugs.length)}/${slugs.length}`);

    // 速率限制：批次间等待 1 秒
    if (i + BATCH_SIZE < slugs.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  return processed;
}

function saveKnowledge(kb: KnowledgeBase): void {
  kb.generatedAt = new Date().toISOString();
  writeFileSync(OUTPUT_PATH, JSON.stringify(kb, null, 2), "utf-8");
}

// 主流程
async function main() {
  console.log("=== Lenny's Podcast 知识层构建 ===\n");

  const kb = loadExisting();
  const existingCount = Object.keys(kb.episodes).length;
  console.log(`已有知识: ${existingCount} 期`);

  const allSlugs = getAllSlugs();
  console.log(`总节目数: ${allSlugs.length}`);

  // 跳过已处理的（幂等）
  const pending = allSlugs
    .filter((s) => !kb.episodes[s])
    .slice(0, MAX_EPISODES);

  if (pending.length === 0) {
    console.log("所有节目已处理完毕，无需更新。");
  } else {
    console.log(`待处理: ${pending.length} 期 (批次大小: ${BATCH_SIZE})\n`);
    const processed = await processBatch(pending, kb);
    console.log(`\n新处理: ${processed} 期`);
  }

  // 读取所有 meta 用于嘉宾档案聚合
  const allMeta = new Map<string, Record<string, any>>();
  for (const slug of allSlugs) {
    const filePath = join(REPO_ROOT, "episodes", slug, "transcript.md");
    if (!existsSync(filePath)) continue;
    const raw = readFileSync(filePath, "utf-8");
    const { data } = matter(raw);
    allMeta.set(slug, data);
  }

  console.log("\n聚合嘉宾档案...");
  buildGuestProfiles(kb, allMeta);

  saveKnowledge(kb);
  const totalEpisodes = Object.keys(kb.episodes).length;
  const totalGuests = Object.keys(kb.guests).length;
  console.log(`\n完成! 知识库: ${totalEpisodes} 期节目, ${totalGuests} 位嘉宾`);
  console.log(`输出: ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error("构建失败:", err);
  process.exit(1);
});
