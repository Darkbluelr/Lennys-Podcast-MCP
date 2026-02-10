import type { DataStore } from "./data.js";
import type { EpisodeMeta, SearchResult, TranscriptMatch } from "./types.js";

// BM25 参数
const K1 = 1.2;
const B = 0.75;

const STOP_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "i",
  "it", "for", "not", "on", "with", "he", "as", "you", "do", "at",
  "this", "but", "his", "by", "from", "they", "we", "say", "her", "she",
  "or", "an", "will", "my", "one", "all", "would", "there", "their",
  "what", "so", "up", "out", "if", "about", "who", "get", "which",
  "go", "me", "when", "make", "can", "like", "time", "no", "just",
  "him", "know", "take", "people", "into", "year", "your", "good",
  "some", "could", "them", "see", "other", "than", "then", "now",
  "look", "only", "come", "its", "over", "think", "also", "back",
  "after", "use", "two", "how", "our", "work", "first", "well",
  "way", "even", "new", "want", "because", "any", "these", "give",
  "day", "most", "us", "was", "is", "are", "been", "has", "had",
  "did", "were", "said", "does", "being", "am",
  // 播客口语高频词
  "yeah", "right", "okay", "um", "uh", "really", "actually",
  "basically", "literally", "gonna", "wanna", "thing", "things",
  "lot", "kind", "sort", "stuff", "much", "very", "got", "going",
]);

const FIELDS = ["title", "guest", "keywords", "description", "transcript"] as const;
type Field = (typeof FIELDS)[number];

const FIELD_WEIGHTS: Record<Field, number> = {
  title: 8.0,
  guest: 6.0,
  keywords: 5.0,
  description: 3.0,
  transcript: 1.0,
};

// --- 分词器 ---

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));
}

// --- 索引数据结构 ---

interface FieldPostings {
  df: number; // 包含该词的文档数
  postings: Map<string, number>; // slug -> 词频
}

interface DocFieldLengths {
  title: number;
  guest: number;
  keywords: number;
  description: number;
  transcript: number;
}

export interface BM25Index {
  // field:term -> { df, postings }
  terms: Map<string, FieldPostings>;
  docs: Map<string, DocFieldLengths>;
  avgLengths: DocFieldLengths;
  totalDocs: number;
}

// --- 构建索引 ---

export function buildBM25Index(store: DataStore): BM25Index {
  const terms = new Map<string, FieldPostings>();
  const docs = new Map<string, DocFieldLengths>();
  const sumLengths: DocFieldLengths = {
    title: 0, guest: 0, keywords: 0, description: 0, transcript: 0,
  };

  for (const [slug, transcript] of store.getTranscriptEntries()) {
    const meta = store.getEpisode(slug);
    if (!meta) continue;

    const fieldTokens: Record<Field, string[]> = {
      title: tokenize(meta.title),
      guest: tokenize(meta.guest),
      keywords: tokenize(meta.keywords.join(" ")),
      description: tokenize(meta.description),
      transcript: tokenize(transcript),
    };

    const lengths: DocFieldLengths = {
      title: fieldTokens.title.length,
      guest: fieldTokens.guest.length,
      keywords: fieldTokens.keywords.length,
      description: fieldTokens.description.length,
      transcript: fieldTokens.transcript.length,
    };
    docs.set(slug, lengths);

    for (const f of FIELDS) {
      sumLengths[f] += lengths[f];
    }

    // 构建倒排索引
    for (const field of FIELDS) {
      const tf = new Map<string, number>();
      for (const token of fieldTokens[field]) {
        tf.set(token, (tf.get(token) ?? 0) + 1);
      }
      for (const [term, freq] of tf) {
        const key = `${field}:${term}`;
        let entry = terms.get(key);
        if (!entry) {
          entry = { df: 0, postings: new Map() };
          terms.set(key, entry);
        }
        entry.df++;
        entry.postings.set(slug, freq);
      }
    }
  }

  const n = docs.size || 1;
  const avgLengths: DocFieldLengths = {
    title: sumLengths.title / n,
    guest: sumLengths.guest / n,
    keywords: sumLengths.keywords / n,
    description: sumLengths.description / n,
    transcript: sumLengths.transcript / n,
  };

  return { terms, docs, avgLengths, totalDocs: docs.size };
}

// --- BM25 搜索 ---

export function searchBM25(
  index: BM25Index,
  store: DataStore,
  query: string,
  options: {
    maxResults?: number;
    mode?: "AND" | "OR";
  } = {}
): { slug: string; score: number }[] {
  const { maxResults = 10, mode = "OR" } = options;
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const scores = new Map<string, number>();
  const termHits = new Map<string, Set<string>>(); // slug -> matched terms

  for (const term of queryTerms) {
    for (const field of FIELDS) {
      const key = `${field}:${term}`;
      const entry = index.terms.get(key);
      if (!entry) continue;

      const idf = Math.log(
        1 + (index.totalDocs - entry.df + 0.5) / (entry.df + 0.5)
      );

      for (const [slug, tf] of entry.postings) {
        const docLengths = index.docs.get(slug);
        if (!docLengths) continue;

        const fieldLen = docLengths[field];
        const avgLen = index.avgLengths[field] || 1;
        const tfNorm =
          (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (fieldLen / avgLen)));
        const fieldScore = idf * tfNorm * FIELD_WEIGHTS[field];

        scores.set(slug, (scores.get(slug) ?? 0) + fieldScore);

        if (!termHits.has(slug)) termHits.set(slug, new Set());
        termHits.get(slug)!.add(term);
      }
    }
  }

  let results = Array.from(scores.entries()).map(([slug, score]) => ({
    slug,
    score,
  }));

  // AND 模式：只保留包含所有查询词的文档
  if (mode === "AND" && queryTerms.length > 1) {
    results = results.filter(
      (r) => (termHits.get(r.slug)?.size ?? 0) >= queryTerms.length
    );
  }

  // 匹配更多查询词的文档额外加分
  for (const r of results) {
    const hitCount = termHits.get(r.slug)?.size ?? 0;
    r.score *= 1 + (hitCount / queryTerms.length) * 0.5;
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}
