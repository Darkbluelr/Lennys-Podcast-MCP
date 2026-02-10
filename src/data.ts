import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import matter from "gray-matter";
import type { EpisodeMeta, Episode, TopicIndex } from "./types.js";
import type { KnowledgeBase, EpisodeKnowledge, GuestProfile } from "./knowledge-types.js";

export class DataStore {
  private episodes: Map<string, EpisodeMeta> = new Map();
  private transcripts: Map<string, string> = new Map();
  private topics: Map<string, TopicIndex> = new Map();
  private guestIndex: Map<string, string[]> = new Map();
  private knowledge: KnowledgeBase | null = null;
  private ready = false;

  constructor(private repoRoot: string) {}

  async load(): Promise<void> {
    this.loadEpisodes();
    this.loadTopics();
    this.buildGuestIndex();
    this.loadKnowledge();
    this.ready = true;
  }

  private loadEpisodes(): void {
    const episodesDir = join(this.repoRoot, "episodes");
    const dirs = readdirSync(episodesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith("."))
      .map((d) => d.name);

    for (const slug of dirs) {
      const filePath = join(episodesDir, slug, "transcript.md");
      if (!existsSync(filePath)) continue;

      const raw = readFileSync(filePath, "utf-8");
      const { data, content } = matter(raw);

      const meta: EpisodeMeta = {
        slug,
        guest: data.guest ?? slug,
        title: data.title ?? "",
        youtube_url: data.youtube_url ?? "",
        video_id: data.video_id ?? "",
        publish_date: data.publish_date instanceof Date
          ? data.publish_date.toISOString().slice(0, 10)
          : String(data.publish_date ?? ""),
        description: data.description ?? "",
        duration_seconds: data.duration_seconds ?? 0,
        duration: data.duration ?? "",
        view_count: data.view_count ?? 0,
        channel: data.channel ?? "",
        keywords: data.keywords ?? [],
        filePath,
      };

      this.episodes.set(slug, meta);
      this.transcripts.set(slug, content);
    }
  }

  private loadTopics(): void {
    const indexDir = join(this.repoRoot, "index");
    if (!existsSync(indexDir)) return;

    const files = readdirSync(indexDir).filter(
      (f) => f.endsWith(".md") && f !== "README.md" && f !== "episodes.md"
    );

    for (const file of files) {
      const topic = basename(file, ".md");
      const raw = readFileSync(join(indexDir, file), "utf-8");
      const slugs: string[] = [];

      for (const line of raw.split("\n")) {
        const match = line.match(/\[.*?\]\(\.\.\/episodes\/([^/]+)\//);
        if (match) slugs.push(match[1]);
      }

      this.topics.set(topic, { topic, episodeSlugs: slugs });
    }
  }

  private buildGuestIndex(): void {
    for (const [slug, meta] of this.episodes) {
      const normalized = meta.guest.toLowerCase();
      const existing = this.guestIndex.get(normalized) ?? [];
      existing.push(slug);
      this.guestIndex.set(normalized, existing);
    }
  }

  getEpisode(slug: string): EpisodeMeta | undefined {
    return this.episodes.get(slug);
  }

  getTranscript(slug: string): string | undefined {
    return this.transcripts.get(slug);
  }

  getAllEpisodes(): EpisodeMeta[] {
    return Array.from(this.episodes.values());
  }

  getAllTopics(): TopicIndex[] {
    return Array.from(this.topics.values());
  }

  getTopicEpisodes(topic: string): EpisodeMeta[] {
    const index = this.topics.get(topic);
    if (!index) return [];
    return index.episodeSlugs
      .map((s) => this.episodes.get(s))
      .filter((e): e is EpisodeMeta => e !== undefined);
  }

  findByGuest(query: string): EpisodeMeta[] {
    const q = query.toLowerCase();
    const results: EpisodeMeta[] = [];
    for (const [slug, meta] of this.episodes) {
      if (meta.guest.toLowerCase().includes(q)) {
        results.push(meta);
      }
    }
    return results;
  }

  getEpisodeCount(): number {
    return this.episodes.size;
  }

  getTopicCount(): number {
    return this.topics.size;
  }

  getTranscriptEntries(): IterableIterator<[string, string]> {
    return this.transcripts.entries();
  }

  // --- 知识层（可选，优雅降级）---

  private loadKnowledge(): void {
    const knowledgePath = join(this.repoRoot, "mcp-server", "data", "knowledge.json");
    if (!existsSync(knowledgePath)) return;
    try {
      const raw = readFileSync(knowledgePath, "utf-8");
      this.knowledge = JSON.parse(raw) as KnowledgeBase;
    } catch {
      // 解析失败则跳过，不影响核心功能
    }
  }

  hasKnowledge(): boolean {
    return this.knowledge !== null;
  }

  getEpisodeKnowledge(slug: string): EpisodeKnowledge | undefined {
    return this.knowledge?.episodes[slug];
  }

  getGuestProfile(name: string): GuestProfile | undefined {
    if (!this.knowledge) return undefined;
    const lower = name.toLowerCase();
    return Object.values(this.knowledge.guests).find(
      (g) => g.name.toLowerCase().includes(lower)
    );
  }

  getAllGuestProfiles(): GuestProfile[] {
    if (!this.knowledge) return [];
    return Object.values(this.knowledge.guests);
  }
}
