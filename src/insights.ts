// get_guest_expertise + get_episode_insights 工具逻辑

import type { DataStore } from "./data.js";
import { extractOverviewSegments } from "./search.js";

// --- get_guest_expertise ---

export interface GuestExpertise {
  name: string;
  episodes: { slug: string; title: string; date: string }[];
  expertiseAreas: string[];
  topKeywords: string[];
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

  // 从 description 提取专长领域
  const expertiseAreas = extractExpertiseFromDescriptions(
    episodes.map((e) => e.description)
  );

  return {
    name,
    episodes: episodes.map((e) => ({
      slug: e.slug,
      title: e.title,
      date: e.publish_date,
    })),
    expertiseAreas,
    topKeywords,
  };
}

function extractExpertiseFromDescriptions(descriptions: string[]): string[] {
  const phrases = new Map<string, number>();
  const stopPhrases = new Set([
    "lenny's podcast", "this episode", "in this", "we discuss",
    "join us", "subscribe", "listen to", "check out",
  ]);

  for (const desc of descriptions) {
    const quoted = desc.match(/"([^"]+)"/g);
    if (quoted) {
      for (const q of quoted) {
        const clean = q.replace(/"/g, "").toLowerCase().trim();
        if (clean.length > 3 && !stopPhrases.has(clean)) {
          phrases.set(clean, (phrases.get(clean) ?? 0) + 1);
        }
      }
    }

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
  description: string;
  intro: string;
  closing: string;
}

export function getEpisodeInsights(
  store: DataStore,
  slug: string
): EpisodeInsights | null {
  const meta = store.getEpisode(slug);
  if (!meta) return null;

  const { intro, closing } = extractOverviewSegments(store, slug, 4, 3);

  return {
    slug,
    guest: meta.guest,
    title: meta.title,
    date: meta.publish_date,
    keywords: meta.keywords,
    description: meta.description,
    intro,
    closing,
  };
}
