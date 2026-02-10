export interface EpisodeMeta {
  slug: string;
  guest: string;
  title: string;
  youtube_url: string;
  video_id: string;
  publish_date: string;
  description: string;
  duration_seconds: number;
  duration: string;
  view_count: number;
  channel: string;
  keywords: string[];
  filePath: string;
}

export interface Episode extends EpisodeMeta {
  transcript: string;
}

export interface TopicIndex {
  topic: string;
  episodeSlugs: string[];
}

export interface SearchResult {
  episode: EpisodeMeta;
  matches: TranscriptMatch[];
  score: number;
}

export interface TranscriptMatch {
  text: string;
  speaker: string;
  timestamp: string;
  lineNumber: number;
}
