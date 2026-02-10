// 知识层类型定义 — 由 AI 通过提示词生成，存储在 data/knowledge.json

export interface Framework {
  name: string;
  description: string;
}

export interface Quote {
  text: string;
  speaker: string;
}

export interface EpisodeKnowledge {
  slug: string;
  summary: string;
  guestBackground: string;
  keyInsights: string[];
  actionableAdvice: string[];
  frameworks: Framework[];
  quotes: Quote[];
  topics: string[];
  controversialTakes: string[];
}

export interface KnowledgeBase {
  episodes: Record<string, EpisodeKnowledge>;
  generatedAt: string;
  version: number;
}
