// compare_perspectives 工具 — 多嘉宾视角对比

import type { DataStore } from "./data.js";
import type { BM25Index } from "./bm25.js";
import { searchBM25, tokenize } from "./bm25.js";
import { extractMatchSegments } from "./search.js";

export interface GuestPerspective {
  guest: string;
  slug: string;
  episodeTitle: string;
  viewpoints: string[];
}

export interface PerspectivesResult {
  topic: string;
  perspectives: GuestPerspective[];
  guestCount: number;
}

export function comparePerspectives(
  store: DataStore,
  index: BM25Index,
  topic: string,
  maxGuests: number = 6
): PerspectivesResult {
  const bm25Results = searchBM25(index, store, topic, {
    maxResults: 20,
    mode: "OR",
  });

  const queryTerms = tokenize(topic);
  const guestMap = new Map<string, GuestPerspective>();

  for (const r of bm25Results) {
    const meta = store.getEpisode(r.slug);
    if (!meta) continue;

    const guestKey = meta.guest.toLowerCase();

    // 每位嘉宾只取最相关的一期
    if (guestMap.has(guestKey)) continue;
    if (guestMap.size >= maxGuests) break;

    const matches = extractMatchSegments(store, r.slug, queryTerms, 3, 0);
    if (matches.length === 0) continue;

    guestMap.set(guestKey, {
      guest: meta.guest,
      slug: r.slug,
      episodeTitle: meta.title,
      viewpoints: matches.map((m) => m.text),
    });
  }

  return {
    topic,
    perspectives: Array.from(guestMap.values()),
    guestCount: guestMap.size,
  };
}
