// get_guest_expertise + get_episode_insights 工具逻辑

import type { DataStore } from "./data.js";
import { extractOverviewSegments } from "./search.js";

// --- get_guest_expertise ---

export interface GuestExpertise {
  name: string;
  episodes: { slug: string; title: string; date: string }[];
  expertiseAreas: string[];
  topKeywords: string[];
  bio?: string;
  keyThemes?: string[];
}

export function getGuestExpertise(
  store: DataStore,
  guestQuery: string
): GuestExpertise | null {
  const episodes = store.findByGuest(guestQuery);
  if (episodes.length === 0) return null;

  const name = episodes[0].guest;

  // 从所有节目的 keywords 聚合专长领域
  const keywordCounts = new Map<string, number>();
  for (const ep of episodes) {
    for (const kw of ep.keywords) {
      keywordCounts.set(kw, (keywordCounts.get(kw) ?? 0) + 1);
    }
  }
  const topKeywords = Array.from(keywordCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([kw]) => kw);

  // 从 description 提取专长领域（取前 3 期的描述关键信息）
  const expertiseAreas = extractExpertiseFromDescriptions(
    episodes.map((e) => e.description)
  );

  const result: GuestExpertise = {
    name,
    episodes: episodes.map((e) => ({
      slug: e.slug,
      title: e.title,
      date: e.publish_date,
    })),
    expertiseAreas,
    topKeywords,
  };

  // 如有知识层，附加完整档案
  const profile = store.getGuestProfile(guestQuery);
  if (profile) {
    result.bio = profile.bio;
    result.keyThemes = profile.keyThemes;
    if (profile.expertiseAreas.length > 0) {
      result.expertiseAreas = profile.expertiseAreas;
    }
  }

  return result;
}

function extractExpertiseFromDescriptions(descriptions: string[]): string[] {
  // 从描述中提取高频有意义的短语
  const phrases = new Map<string, number>();
  const stopPhrases = new Set([
    "lenny's podcast", "this episode", "in this", "we discuss",
    "join us", "subscribe", "listen to", "check out",
  ]);

  for (const desc of descriptions) {
    // 提取引号内的短语和关键名词短语
    const quoted = desc.match(/"([^"]+)"/g);
    if (quoted) {
      for (const q of quoted) {
        const clean = q.replace(/"/g, "").toLowerCase().trim();
        if (clean.length > 3 && !stopPhrases.has(clean)) {
          phrases.set(clean, (phrases.get(clean) ?? 0) + 1);
        }
      }
    }

    // 提取 "about X" / "on X" 模式
    const aboutMatches = desc.match(/(?:about|on|discusses?|explores?)\s+([^,.!?]+)/gi);
    if (aboutMatches) {
      for (const m of aboutMatches) {
        const topic = m.replace(/^(?:about|on|discusses?|explores?)\s+/i, "").trim().toLowerCase();
        if (topic.length > 3 && topic.length < 60 && !stopPhrases.has(topic)) {
          phrases.set(topic, (phrases.get(topic) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(phrases.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([phrase]) => phrase);
}

// --- get_episode_insights ---

export interface EpisodeInsights {
  slug: string;
  guest: string;
  title: string;
  date: string;
  keywords: string[];
  summary?: string;
  keyInsights?: string[];
  frameworks?: { name: string; description: string }[];
  quotes?: { text: string; speaker: string }[];
  // 降级模式：无知识层时从 metadata + 首尾片段生成
  overview?: { description: string; intro: string; closing: string };
}

export function getEpisodeInsights(
  store: DataStore,
  slug: string
): EpisodeInsights | null {
  const meta = store.getEpisode(slug);
  if (!meta) return null;

  const result: EpisodeInsights = {
    slug,
    guest: meta.guest,
    title: meta.title,
    date: meta.publish_date,
    keywords: meta.keywords,
  };

  // 优先使用知识层
  const knowledge = store.getEpisodeKnowledge(slug);
  if (knowledge) {
    result.summary = knowledge.summary;
    result.keyInsights = knowledge.keyInsights;
    result.frameworks = knowledge.frameworks.map((f) => ({
      name: f.name,
      description: f.description,
    }));
    result.quotes = knowledge.quotes.map((q) => ({
      text: q.text,
      speaker: q.speaker,
    }));
    return result;
  }

  // 降级：从 metadata + 首尾片段生成概览
  const { intro, closing } = extractOverviewSegments(store, slug, 4, 3);
  result.overview = {
    description: meta.description,
    intro,
    closing,
  };

  return result;
}
