// 知识层类型定义 — 预计算的结构化知识（可选，优雅降级）

export interface Framework {
  name: string;
  description: string;
  source: string; // 嘉宾名
}

export interface Quote {
  text: string;
  speaker: string;
  context: string;
}

export interface EpisodeKnowledge {
  slug: string;
  summary: string;           // 200-300 词摘要
  keyInsights: string[];     // 3-5 条核心观点
  frameworks: Framework[];   // 框架/方法论
  quotes: Quote[];           // 金句
  adviceTopics: string[];    // 建议话题标签
}

export interface GuestProfile {
  name: string;
  episodes: string[];        // slug 列表
  expertiseAreas: string[];  // 专长领域
  keyThemes: string[];       // 核心主题
  bio: string;               // 简介
}

export interface KnowledgeBase {
  episodes: Record<string, EpisodeKnowledge>;
  guests: Record<string, GuestProfile>;
  version: string;
  generatedAt: string;
}
