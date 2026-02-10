import type { DataStore } from "./data.js";
import type { EpisodeMeta, SearchResult, TranscriptMatch } from "./types.js";

interface ParsedSegment {
  speaker: string;
  timestamp: string;
  text: string;
  lineNumber: number;
}

function parseTranscriptSegments(transcript: string): ParsedSegment[] {
  const lines = transcript.split("\n");
  const segments: ParsedSegment[] = [];
  let current: ParsedSegment | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const speakerMatch = line.match(
      /^(.+?)\s*\((\d{1,2}:\d{2}(?::\d{2})?)\)\s*:?\s*$/
    );

    if (speakerMatch) {
      if (current) segments.push(current);
      current = {
        speaker: speakerMatch[1].trim(),
        timestamp: speakerMatch[2],
        text: "",
        lineNumber: i + 1,
      };
    } else if (current && line.trim()) {
      current.text += (current.text ? " " : "") + line.trim();
    }
  }
  if (current) segments.push(current);
  return segments;
}

function buildSearchPattern(query: string): RegExp {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(escaped, "gi");
}

function scoreMatch(
  meta: EpisodeMeta,
  matches: TranscriptMatch[],
  query: string
): number {
  let score = matches.length;
  const q = query.toLowerCase();

  if (meta.title.toLowerCase().includes(q)) score += 10;
  if (meta.guest.toLowerCase().includes(q)) score += 5;
  if (meta.description.toLowerCase().includes(q)) score += 3;
  for (const kw of meta.keywords) {
    if (kw.includes(q) || q.includes(kw)) score += 2;
  }

  return score;
}

export function searchTranscripts(
  store: DataStore,
  query: string,
  maxResults: number = 10,
  contextSegments: number = 1
): SearchResult[] {
  const pattern = buildSearchPattern(query);
  const results: SearchResult[] = [];

  for (const [slug, transcript] of store.getTranscriptEntries()) {
    const meta = store.getEpisode(slug);
    if (!meta) continue;

    const segments = parseTranscriptSegments(transcript);
    const matches: TranscriptMatch[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (pattern.test(seg.text)) {
        pattern.lastIndex = 0;

        const contextParts: string[] = [];
        const start = Math.max(0, i - contextSegments);
        const end = Math.min(segments.length - 1, i + contextSegments);
        for (let j = start; j <= end; j++) {
          const s = segments[j];
          const prefix = j === i ? ">>> " : "    ";
          contextParts.push(
            `${prefix}${s.speaker} (${s.timestamp}): ${s.text}`
          );
        }

        matches.push({
          text: contextParts.join("\n"),
          speaker: seg.speaker,
          timestamp: seg.timestamp,
          lineNumber: seg.lineNumber,
        });
      }
    }

    if (matches.length > 0) {
      const dedupedMatches = matches.slice(0, 5);
      results.push({
        episode: meta,
        matches: dedupedMatches,
        score: scoreMatch(meta, dedupedMatches, query),
      });
    }
  }

  results.sort((a, b) => b.score - a.score);
  return results.slice(0, maxResults);
}

export function getTranscriptSegment(
  store: DataStore,
  slug: string,
  startTime?: string,
  endTime?: string,
  maxChars: number = 8000
): string | null {
  const transcript = store.getTranscript(slug);
  if (!transcript) return null;

  if (!startTime && !endTime) {
    return transcript.slice(0, maxChars);
  }

  const segments = parseTranscriptSegments(transcript);
  const startSeconds = startTime ? timeToSeconds(startTime) : 0;
  const endSeconds = endTime ? timeToSeconds(endTime) : Infinity;

  const filtered = segments.filter((s) => {
    const sec = timeToSeconds(s.timestamp);
    return sec >= startSeconds && sec <= endSeconds;
  });

  const text = filtered
    .map((s) => `${s.speaker} (${s.timestamp}):\n${s.text}`)
    .join("\n\n");

  return text.slice(0, maxChars);
}

function timeToSeconds(time: string): number {
  const parts = time.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return 0;
}
