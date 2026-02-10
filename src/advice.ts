// get_advice 工具 — 基于播客内容提供情境化建议

import type { DataStore } from "./data.js";
import type { BM25Index } from "./bm25.js";
import { searchBM25, tokenize } from "./bm25.js";
import { extractMatchSegments } from "./search.js";

export interface AdviceSource {
  guest: string;
  episodeTitle: string;
  slug: string;
  segments: string[];
  insight?: string; // 来自知识层的预计算观点
}

export interface AdviceResult {
  sources: AdviceSource[];
  hasKnowledge: boolean;
}

export function getAdvice(
  store: DataStore,
  index: BM25Index,
  situation: string,
  maxSources: number = 5
): AdviceResult {
  const bm25Results = searchBM25(index, store, situation, {
    maxResults: maxSources * 2,
    mode: "OR",
  });

  const queryTerms = tokenize(situation);
  const sources: AdviceSource[] = [];

  for (const r of bm25Results) {
    if (sources.length >= maxSources) break;

    const meta = store.getEpisode(r.slug);
    if (!meta) continue;

    const matches = extractMatchSegments(store, r.slug, queryTerms, 3, 1);
    if (matches.length === 0) continue;

    const source: AdviceSource = {
      guest: meta.guest,
      episodeTitle: meta.title,
      slug: r.slug,
      segments: matches.map((m) => m.text),
    };

    // 如有知识层，附加预计算观点
    const knowledge = store.getEpisodeKnowledge(r.slug);
    if (knowledge && knowledge.keyInsights.length > 0) {
      source.insight = knowledge.keyInsights.join(" | ");
    }

    sources.push(source);
  }

  return { sources, hasKnowledge: store.hasKnowledge() };
}
