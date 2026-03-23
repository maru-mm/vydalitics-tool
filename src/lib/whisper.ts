import type { TranscriptSegment } from "./vidalytics-api";

const WHISPER_API_URL = "https://api.openai.com/v1/audio/transcriptions";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit
const SEGMENT_DOWNLOAD_CONCURRENCY = 6;

export interface TranscriptResult {
  text: string;
  segments: TranscriptSegment[];
  language?: string;
  duration?: number;
  source: string;
}

interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface WhisperResponse {
  task: string;
  language: string;
  duration: number;
  text: string;
  segments: WhisperSegment[];
}

// ─── URL helpers ─────────────────────────────────────────────────────

function resolveUrl(base: string, relative: string): string {
  if (relative.startsWith("http")) return relative;
  if (relative.startsWith("/")) {
    const u = new URL(base);
    return `${u.protocol}//${u.host}${relative}`;
  }
  return base.substring(0, base.lastIndexOf("/") + 1) + relative;
}

// ─── M3U8 parser ─────────────────────────────────────────────────────

interface M3U8Info {
  isMaster: boolean;
  variants: Array<{ url: string; bandwidth: number }>;
  audioRenditions: Array<{ url: string; language?: string }>;
  segments: string[];
}

function parseM3U8(content: string, baseUrl: string): M3U8Info {
  const lines = content.split("\n").map((l) => l.trim());
  const variants: M3U8Info["variants"] = [];
  const audioRenditions: M3U8Info["audioRenditions"] = [];
  const segments: string[] = [];
  let isMaster = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith("#EXT-X-STREAM-INF:")) {
      isMaster = true;
      const bwMatch = line.match(/BANDWIDTH=(\d+)/);
      const bandwidth = bwMatch ? parseInt(bwMatch[1]) : 0;
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.startsWith("#")) {
        variants.push({ url: resolveUrl(baseUrl, nextLine), bandwidth });
      }
    }

    if (line.startsWith("#EXT-X-MEDIA:") && line.includes("TYPE=AUDIO")) {
      const uriMatch = line.match(/URI="([^"]+)"/);
      const langMatch = line.match(/LANGUAGE="([^"]+)"/);
      if (uriMatch) {
        audioRenditions.push({
          url: resolveUrl(baseUrl, uriMatch[1]),
          language: langMatch?.[1],
        });
      }
    }

    if (line.startsWith("#EXTINF:")) {
      const nextLine = lines[i + 1];
      if (nextLine && !nextLine.startsWith("#")) {
        segments.push(resolveUrl(baseUrl, nextLine));
      }
    }
  }

  return { isMaster, variants, audioRenditions, segments };
}

// ─── HLS download ────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  timeoutMs = 30000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function getHLSSegmentUrls(m3u8Url: string): Promise<string[]> {
  const res = await fetchWithTimeout(m3u8Url);
  if (!res.ok) throw new Error(`Failed to fetch m3u8: ${res.status}`);
  const content = await res.text();
  const info = parseM3U8(content, m3u8Url);

  if (!info.isMaster) return info.segments;

  // Prefer audio-only rendition (smallest download)
  if (info.audioRenditions.length > 0) {
    const audioUrl = info.audioRenditions[0].url;
    const audioRes = await fetchWithTimeout(audioUrl);
    if (audioRes.ok) {
      const audioContent = await audioRes.text();
      const audioInfo = parseM3U8(audioContent, audioUrl);
      if (audioInfo.segments.length > 0) return audioInfo.segments;
    }
  }

  // Fall back to lowest bandwidth video variant
  const sorted = [...info.variants].sort((a, b) => a.bandwidth - b.bandwidth);
  if (sorted.length === 0) throw new Error("No variants in HLS master playlist");

  const varRes = await fetchWithTimeout(sorted[0].url);
  if (!varRes.ok)
    throw new Error(`Failed to fetch variant playlist: ${varRes.status}`);
  const varContent = await varRes.text();
  const varInfo = parseM3U8(varContent, sorted[0].url);

  if (varInfo.segments.length === 0)
    throw new Error("No segments found in HLS variant playlist");
  return varInfo.segments;
}

async function downloadSegments(
  segmentUrls: string[]
): Promise<{ buffers: Buffer[]; sizes: number[] }> {
  const buffers: (Buffer | null)[] = new Array(segmentUrls.length).fill(null);
  const sizes: number[] = new Array(segmentUrls.length).fill(0);

  for (let i = 0; i < segmentUrls.length; i += SEGMENT_DOWNLOAD_CONCURRENCY) {
    const batch = segmentUrls.slice(i, i + SEGMENT_DOWNLOAD_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(async (url, j) => {
        const res = await fetchWithTimeout(url, 60000);
        if (!res.ok) throw new Error(`Segment ${i + j} failed: ${res.status}`);
        const ab = await res.arrayBuffer();
        return { index: i + j, buffer: Buffer.from(ab) };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        buffers[r.value.index] = r.value.buffer;
        sizes[r.value.index] = r.value.buffer.length;
      }
    }
  }

  return {
    buffers: buffers.filter((b): b is Buffer => b !== null),
    sizes: sizes.filter((_, i) => buffers[i] !== null),
  };
}

// ─── Whisper API call ────────────────────────────────────────────────

async function callWhisper(
  audioBuffer: Buffer,
  apiKey: string,
  filename: string
): Promise<WhisperResponse> {
  const blob = new Blob([audioBuffer]);
  const formData = new FormData();
  formData.append("file", blob, filename);
  formData.append("model", "whisper-1");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");

  const res = await fetch(WHISPER_API_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Whisper API error ${res.status}: ${errText}`);
  }

  return res.json();
}

// ─── Chunk-aware transcription ───────────────────────────────────────
// Groups HLS segments into <=25MB chunks and transcribes each separately,
// then stitches the results with correct time offsets.

async function transcribeChunked(
  segmentBuffers: Buffer[],
  apiKey: string
): Promise<TranscriptResult> {
  const chunks: Buffer[][] = [[]];
  let currentSize = 0;

  for (const seg of segmentBuffers) {
    if (currentSize + seg.length > MAX_FILE_SIZE && chunks[chunks.length - 1].length > 0) {
      chunks.push([]);
      currentSize = 0;
    }
    chunks[chunks.length - 1].push(seg);
    currentSize += seg.length;
  }

  let fullText = "";
  const allSegments: TranscriptSegment[] = [];
  let timeOffset = 0;
  let language: string | undefined;
  let totalDuration = 0;

  for (let i = 0; i < chunks.length; i++) {
    const chunkBuffer = Buffer.concat(chunks[i]);
    const result = await callWhisper(chunkBuffer, apiKey, `chunk_${i}.mpeg`);

    if (!language && result.language) language = result.language;

    fullText += (fullText ? " " : "") + result.text;

    for (const seg of result.segments || []) {
      allSegments.push({
        startSeconds: Math.round((seg.start + timeOffset) * 100) / 100,
        endSeconds: Math.round((seg.end + timeOffset) * 100) / 100,
        text: seg.text.trim(),
      });
    }

    timeOffset += result.duration || 0;
    totalDuration += result.duration || 0;
  }

  return {
    text: fullText,
    segments: allSegments,
    language,
    duration: totalDuration,
    source: chunks.length > 1 ? "whisper-chunked" : "whisper",
  };
}

// ─── Public API ──────────────────────────────────────────────────────

export async function transcribeFromHLS(
  m3u8Url: string,
  openaiKey: string
): Promise<TranscriptResult> {
  const segmentUrls = await getHLSSegmentUrls(m3u8Url);
  const { buffers } = await downloadSegments(segmentUrls);

  if (buffers.length === 0) throw new Error("No audio segments downloaded");

  return transcribeChunked(buffers, openaiKey);
}

export async function transcribeFromDirectUrl(
  mediaUrl: string,
  openaiKey: string
): Promise<TranscriptResult> {
  const res = await fetchWithTimeout(mediaUrl, 120000);
  if (!res.ok) throw new Error(`Failed to download media: ${res.status}`);

  const ab = await res.arrayBuffer();
  const buffer = Buffer.from(ab);

  if (buffer.length > MAX_FILE_SIZE) {
    throw new Error(
      `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). ` +
        "Direct URL download exceeds 25MB Whisper limit. Use HLS stream instead."
    );
  }

  const ext = mediaUrl.split("?")[0].split(".").pop() || "mp4";
  const result = await callWhisper(buffer, openaiKey, `audio.${ext}`);

  return {
    text: result.text,
    segments: (result.segments || []).map((seg) => ({
      startSeconds: Math.round(seg.start * 100) / 100,
      endSeconds: Math.round(seg.end * 100) / 100,
      text: seg.text.trim(),
    })),
    language: result.language,
    duration: result.duration,
    source: "whisper",
  };
}

export async function transcribeFromUrl(
  mediaUrl: string,
  openaiKey: string
): Promise<TranscriptResult> {
  if (mediaUrl.includes(".m3u8")) {
    return transcribeFromHLS(mediaUrl, openaiKey);
  }
  return transcribeFromDirectUrl(mediaUrl, openaiKey);
}
