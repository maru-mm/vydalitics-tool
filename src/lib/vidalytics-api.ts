const API_BASE = "https://api.vidalytics.com/public/v1";

// ─── Custom Error for Whisper fallback ──────────────────────────────

export class MediaUrlAvailableError extends Error {
  mediaUrl: string;
  constructor(message: string, mediaUrl: string) {
    super(message);
    this.name = "MediaUrlAvailableError";
    this.mediaUrl = mediaUrl;
  }
}

// ─── Core Video Types ───────────────────────────────────────────────

export interface VidalyticsVideo {
  id: string;
  title: string;
  folder_id?: string;
  thumbnail?: { desktop: string; mobile: string };
  date_created: string;
  last_published?: string;
  status?: string;
  views?: number;
  url?: string;
  // Mapped aliases for backward-compat with dashboard pages
  name: string;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string;
  duration?: number;
  tags?: string[];
  embed_id?: string;
  funnel_id?: string;
  smart_autoplay?: boolean;
  play_gate_enabled?: boolean;
}

export interface VideoStats {
  video_id: string;
  plays: number;
  unique_plays: number;
  impressions: number;
  play_rate: number;
  avg_watch_time: number;
  avg_percent_watched: number;
  conversions: number;
  conversion_rate: number;
  cta_clicks: number;
  cta_click_rate: number;
  unmute_rate?: number;
}

export interface TimelineStats {
  date: string;
  plays: number;
  unique_plays: number;
  impressions: number;
  conversions: number;
  avg_watch_time: number;
  avg_percent_watched?: number;
  cta_clicks?: number;
}

export interface DropOffStats {
  watches: Record<string, number>;
}

// ─── Folder Types ───────────────────────────────────────────────────

export interface Folder {
  id: string;
  name: string;
  parentFolderId?: string;
  dateCreated?: string;
  videoCount: number;
  // Alias
  parent_id?: string;
  video_count: number;
}

// ─── Advanced Stats Types ───────────────────────────────────────────

export interface AdvancedStatsFilter {
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  url_param?: string;
  url_param_value?: string;
}

export interface SegmentedStats {
  segment: string;
  segment_value: string;
  plays: number;
  unique_plays: number;
  impressions: number;
  conversions: number;
  avg_watch_time: number;
  avg_percent_watched: number;
  cta_clicks: number;
}

export interface RealTimeMetrics {
  video_id: string;
  concurrent_viewers: number;
  timestamp: string;
}

// ─── Session Types ──────────────────────────────────────────────────

export interface ViewerSession {
  session_id: string;
  video_id: string;
  viewer_id?: string;
  started_at: string;
  ended_at?: string;
  watch_time: number;
  percent_watched: number;
  country?: string;
  device?: string;
  browser?: string;
  os?: string;
  referrer?: string;
  converted: boolean;
  cta_clicked: boolean;
  play_gate_submitted: boolean;
}

// ─── Funnel Types ───────────────────────────────────────────────────

export interface Funnel {
  id: string;
  name: string;
  video_ids: string[];
  created_at: string;
  updated_at: string;
}

// ─── Tag Types ──────────────────────────────────────────────────────

export interface Tag {
  id: string;
  name: string;
  video_count: number;
}

// ─── CTA Types ──────────────────────────────────────────────────────

export interface CTAConfig {
  id: string;
  video_id: string;
  type: "exit" | "time";
  display_mode: "reserveSpace" | "expandContainer" | "onTop" | "customHTML";
  title: string;
  link?: { href: string; blank: boolean };
  time_from?: number;
  time_to?: number;
  enabled: boolean;
}

// ─── Webhook Types ──────────────────────────────────────────────────

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  created_at: string;
}

// ─── API Usage ──────────────────────────────────────────────────────

export interface ApiUsage {
  monthly_limit: number;
  current_usage: number;
  remaining: number;
}

// ─── Helper: normalize Vidalytics video response to our interface ──

function normalizeVideo(raw: Record<string, unknown>): VidalyticsVideo {
  const thumb = raw.thumbnail as { desktop?: string; mobile?: string } | undefined;
  return {
    id: raw.id as string,
    title: (raw.title as string) || "",
    name: (raw.title as string) || "",
    folder_id: raw.folder_id as string | undefined,
    thumbnail: thumb ? { desktop: thumb.desktop || "", mobile: thumb.mobile || "" } : undefined,
    thumbnail_url: thumb?.desktop || undefined,
    date_created: (raw.date_created as string) || "",
    created_at: (raw.date_created as string) || "",
    last_published: raw.last_published as string | undefined,
    updated_at: (raw.last_published as string) || (raw.date_created as string) || "",
    status: raw.status as string | undefined,
    views: raw.views as number | undefined,
    url: raw.url as string | undefined,
    duration: undefined,
    tags: [],
    embed_id: undefined,
    funnel_id: undefined,
    smart_autoplay: undefined,
    play_gate_enabled: undefined,
  };
}

function normalizeFolder(raw: Record<string, unknown>): Folder {
  return {
    id: raw.id as string,
    name: (raw.name as string) || "",
    parentFolderId: raw.parentFolderId as string | undefined,
    parent_id: raw.parentFolderId as string | undefined,
    dateCreated: raw.dateCreated as string | undefined,
    videoCount: (raw.videoCount as number) || 0,
    video_count: (raw.videoCount as number) || 0,
  };
}

// ─── Transcript Segment Type ─────────────────────────────────────────

export interface TranscriptSegment {
  startSeconds: number;
  endSeconds: number;
  text: string;
}

// ─── VTT / SRT Parser ───────────────────────────────────────────────

function parseVTTTime(timeStr: string): number {
  const parts = timeStr.split(":");
  if (parts.length === 3) {
    return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]);
}

export function parseVTTtoSegments(raw: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const content = raw.replace(/^WEBVTT[^\n]*\n/, "");
  const blocks = content.split(/\n\n+/);

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let timeLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes("-->")) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx === -1) continue;

    const match = lines[timeLineIdx].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
    if (!match) continue;

    const startSeconds = parseVTTTime(match[1]);
    const endSeconds = parseVTTTime(match[2]);
    const text = lines
      .slice(timeLineIdx + 1)
      .join(" ")
      .replace(/<[^>]+>/g, "")
      .trim();

    if (text) {
      segments.push({ startSeconds, endSeconds, text });
    }
  }

  return segments;
}

function parseVTTtoText(raw: string): string {
  return raw
    .replace(/^WEBVTT[\s\S]*?\n\n/, "")
    .replace(/^\d+\s*\n/gm, "")
    .replace(/[\d:.]+\s*-->\s*[\d:.]+[^\n]*/g, "")
    .replace(/<[^>]+>/g, "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .reduce<string[]>((acc, line) => {
      if (acc.length === 0 || acc[acc.length - 1] !== line) acc.push(line);
      return acc;
    }, [])
    .join("\n");
}

// ─── Client ─────────────────────────────────────────────────────────

export class VidalyticsClient {
  private token: string;

  constructor(token: string) {
    this.token = token;
  }

  private async requestWithRetry(
    url: string,
    options: RequestInit,
    retries = 2
  ): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          ...options,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (res.status === 429) {
          const wait = Math.min(2000 * Math.pow(2, attempt), 10000);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        if (res.status >= 500 && attempt < retries) {
          const wait = 1000 * (attempt + 1);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        return res;
      } catch (err) {
        clearTimeout(timeout);
        if (attempt >= retries) throw err;
        const wait = 1000 * (attempt + 1);
        await new Promise((r) => setTimeout(r, wait));
      }
    }

    throw new Error("Max retries exceeded");
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const res = await this.requestWithRetry(
      `${API_BASE}${endpoint}`,
      {
        ...options,
        headers: {
          "X-API-Key": this.token,
          Accept: "application/json",
          "Content-Type": "application/json",
          ...options.headers,
        },
      }
    );

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Vidalytics API error ${res.status}: ${body}`);
    }

    return res.json();
  }

  // Unwrap the { status, content: { data } } envelope
  private async requestData<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const raw = await this.request<{ status: boolean; content?: { data?: T } }>(
      endpoint,
      options
    );
    if (raw.content?.data !== undefined) return raw.content.data;
    return raw as unknown as T;
  }

  // Unwrap { status, content: { ... } } (content directly, not content.data)
  private async requestContent<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const raw = await this.request<{ status: boolean; content?: T }>(
      endpoint,
      options
    );
    if (raw.content !== undefined) return raw.content;
    return raw as unknown as T;
  }

  // ── Videos ──────────────────────────────────────────────────────

  async getVideos(params?: {
    folder_id?: string;
    tag?: string;
    page?: number;
    per_page?: number;
  }): Promise<VidalyticsVideo[]> {
    const qs = new URLSearchParams();
    if (params?.folder_id) qs.set("folderId", params.folder_id);
    const query = qs.toString();
    const rawList = await this.requestData<Record<string, unknown>[]>(
      `/video${query ? `?${query}` : ""}`
    );
    return (rawList || []).map(normalizeVideo);
  }

  async getVideo(id: string): Promise<VidalyticsVideo> {
    const raw = await this.requestData<Record<string, unknown>>(`/video/${id}`);
    return normalizeVideo(raw);
  }

  async updateVideo(
    id: string,
    data: Partial<Pick<VidalyticsVideo, "name" | "folder_id" | "tags" | "smart_autoplay">>
  ): Promise<VidalyticsVideo> {
    const body: Record<string, unknown> = {};
    if (data.name) body.title = data.name;
    if (data.folder_id) body.folder_id = data.folder_id;
    const raw = await this.requestData<Record<string, unknown>>(`/video/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
    return normalizeVideo(raw);
  }

  async deleteVideo(id: string): Promise<void> {
    await this.request<void>(`/video/${id}`, { method: "DELETE" });
  }

  // ── Stats ───────────────────────────────────────────────────────

  async getVideoStats(
    id: string,
    filters?: { dateFrom?: string; dateTo?: string } & AdvancedStatsFilter
  ): Promise<VideoStats> {
    const qs = new URLSearchParams();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    qs.set("dateFrom", filters?.dateFrom || thirtyDaysAgo.toISOString().split("T")[0]);
    qs.set("dateTo", filters?.dateTo || now.toISOString().split("T")[0]);
    const query = qs.toString();
    const raw = await this.requestContent<Record<string, unknown>>(
      `/stats/video/${id}${query ? `?${query}` : ""}`
    );
    return {
      video_id: id,
      plays: (raw.plays as number) || 0,
      unique_plays: (raw.playsUnique as number) || 0,
      impressions: (raw.impressions as number) || 0,
      play_rate: (raw.playRate as number) || 0,
      avg_watch_time: (raw.avgWatchTime as number) || 0,
      avg_percent_watched: (raw.avgPercentWatched as number) || 0,
      conversions: (raw.conversions as number) || 0,
      conversion_rate: (raw.conversionRate as number) || 0,
      cta_clicks: (raw.ctaClicks as number) || 0,
      cta_click_rate: (raw.ctaClickRate as number) || 0,
      unmute_rate: (raw.unmuteRate as number) || 0,
    };
  }

  async getVideoTimeline(
    id: string,
    params?: {
      start_date?: string;
      end_date?: string;
      interval?: "hourly" | "daily";
      filters?: AdvancedStatsFilter;
    }
  ): Promise<TimelineStats[]> {
    const qs = new URLSearchParams();
    qs.set("videoGuids", id);
    qs.set("metrics", "plays,impressions,conversions");
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    qs.set("dateFrom", params?.start_date || sevenDaysAgo.toISOString().split("T")[0]);
    qs.set("dateTo", params?.end_date || now.toISOString().split("T")[0]);
    qs.set("segment", "segment.all");
    const raw = await this.requestData<
      Array<{ date: string; data: Array<{ metrics: Record<string, number> }> }>
    >(`/stats/videos/timeline?${qs.toString()}`);

    if (!raw || !Array.isArray(raw)) return [];

    // The timeline structure is nested: content.data[].segment, content.data[].data[].date, etc.
    // Flatten to our simple TimelineStats format
    return raw.map((entry) => {
      const metrics = entry.data?.[0]?.metrics || {};
      return {
        date: entry.date || "",
        plays: metrics.plays || 0,
        unique_plays: metrics.playsUnique || 0,
        impressions: metrics.impressions || 0,
        conversions: metrics.conversions || 0,
        avg_watch_time: metrics.avgWatchTime || 0,
        avg_percent_watched: metrics.avgPercentWatched || 0,
        cta_clicks: metrics.ctaClicks || 0,
      };
    });
  }

  async getDropOff(
    id: string,
    params?: { dateFrom?: string; dateTo?: string }
  ): Promise<DropOffStats> {
    const qs = new URLSearchParams();
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    qs.set("dateFrom", params?.dateFrom || thirtyDaysAgo.toISOString().split("T")[0]);
    qs.set("dateTo", params?.dateTo || now.toISOString().split("T")[0]);
    const query = qs.toString();
    const raw = await this.requestContent<{ all: DropOffStats }>(
      `/stats/video/${id}/drop-off${query ? `?${query}` : ""}`
    );
    return raw.all;
  }

  async getBulkStats(videoIds: string[]): Promise<VideoStats[]> {
    const ids = videoIds.slice(0, 20);
    const BATCH_SIZE = 5;
    const results: VideoStats[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((id) => this.getVideoStats(id))
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
      }
    }
    return results;
  }

  async getSegmentedStats(
    id: string,
    segment: "country" | "device" | "browser" | "os",
    params?: { start_date?: string; end_date?: string }
  ): Promise<SegmentedStats[]> {
    const qs = new URLSearchParams();
    qs.set("videoGuids", id);
    qs.set("metrics", "plays,impressions,conversions");
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    qs.set("dateFrom", params?.start_date || thirtyDaysAgo.toISOString().split("T")[0]);
    qs.set("dateTo", params?.end_date || now.toISOString().split("T")[0]);

    const segmentMap: Record<string, string> = {
      country: "segment.geo",
      device: "segment.devices",
      browser: "segment.browsers",
      os: "segment.os",
    };
    qs.set("segment", segmentMap[segment] || "segment.all");

    const raw = await this.requestData<
      Array<{ segment: string; data: Array<{ date: string; data: Array<{ videoGuid: string; metrics: Record<string, number> }> }> }>
    >(`/stats/videos/timeline?${qs.toString()}`);

    if (!raw || !Array.isArray(raw)) return [];

    return raw.map((entry) => {
      let totalPlays = 0;
      let totalConversions = 0;
      let totalImpressions = 0;
      for (const d of entry.data || []) {
        for (const v of d.data || []) {
          totalPlays += v.metrics?.plays || 0;
          totalConversions += v.metrics?.conversions || 0;
          totalImpressions += v.metrics?.impressions || 0;
        }
      }
      return {
        segment: segment,
        segment_value: entry.segment || "N/A",
        plays: totalPlays,
        unique_plays: 0,
        impressions: totalImpressions,
        conversions: totalConversions,
        avg_watch_time: 0,
        avg_percent_watched: 0,
        cta_clicks: 0,
      };
    });
  }

  async getRealTimeMetrics(videoId: string): Promise<RealTimeMetrics> {
    const raw = await this.requestContent<{ watching: number }>(
      `/stats/video/${videoId}/live-metrics`
    );
    return {
      video_id: videoId,
      concurrent_viewers: raw.watching || 0,
      timestamp: new Date().toISOString(),
    };
  }

  async getBulkRealTime(videoIds: string[]): Promise<RealTimeMetrics[]> {
    const ids = videoIds.slice(0, 20);
    const BATCH_SIZE = 5;
    const results: RealTimeMetrics[] = [];

    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const batch = ids.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map((id) => this.getRealTimeMetrics(id))
      );
      for (const r of batchResults) {
        if (r.status === "fulfilled") results.push(r.value);
      }
    }
    return results;
  }

  // ── Sessions (not available in public API — stub) ──────────────

  async getVideoSessions(
    videoId: string,
    params?: {
      start_date?: string;
      end_date?: string;
      page?: number;
      per_page?: number;
      filters?: AdvancedStatsFilter;
    }
  ): Promise<ViewerSession[]> {
    void params;
    void videoId;
    return [];
  }

  // ── Folders ─────────────────────────────────────────────────────

  async getFolders(): Promise<Folder[]> {
    const rawList = await this.requestData<
      Array<Record<string, unknown>>
    >("/folder");
    return (rawList || []).map(normalizeFolder);
  }

  async createFolder(name: string, parentId?: string): Promise<Folder> {
    const raw = await this.requestData<Record<string, unknown>>("/folder", {
      method: "POST",
      body: JSON.stringify({ name, parentFolderId: parentId }),
    });
    return normalizeFolder(raw);
  }

  async updateFolder(id: string, name: string): Promise<Folder> {
    const raw = await this.requestData<Record<string, unknown>>(`/folder/${id}`, {
      method: "PUT",
      body: JSON.stringify({ name }),
    });
    return normalizeFolder(raw);
  }

  async deleteFolder(id: string): Promise<void> {
    await this.request<void>(`/folder/${id}`, { method: "DELETE" });
  }

  // ── Funnels (not in public API — stub) ─────────────────────────

  async getFunnels(): Promise<Funnel[]> {
    return [];
  }

  async getFunnel(id: string): Promise<Funnel> {
    return { id, name: "", video_ids: [], created_at: "", updated_at: "" };
  }

  // ── Tags (not in public API — stub) ───────────────────────────

  async getTags(): Promise<Tag[]> {
    return [];
  }

  async addTagToVideo(videoId: string, tag: string): Promise<VidalyticsVideo> {
    void tag;
    return this.getVideo(videoId);
  }

  async removeTagFromVideo(videoId: string, tag: string): Promise<VidalyticsVideo> {
    void tag;
    return this.getVideo(videoId);
  }

  // ── Embed ───────────────────────────────────────────────────────

  async getEmbedCode(
    videoId: string,
    options?: { autoplay?: boolean; muted?: boolean; responsive?: boolean }
  ): Promise<{ html: string }> {
    void options;
    const raw = await this.requestData<{ html?: string }>(`/embed/video/${videoId}`);
    return { html: raw.html || "" };
  }

  // ── Webhooks (not in public API — stub) ────────────────────────

  async getWebhooks(): Promise<Webhook[]> {
    return [];
  }

  async createWebhook(url: string, events: string[]): Promise<Webhook> {
    return { id: Date.now().toString(), url, events, active: true, created_at: new Date().toISOString() };
  }

  async deleteWebhook(id: string): Promise<void> {
    void id;
  }

  // ── Video Script / Captions ─────────────────────────────────────

  /**
   * Extracts the media URL (HLS m3u8 or direct MP4) and optional caption VTT
   * URLs from the Vidalytics embed player config.
   */
  async extractMediaInfo(
    videoId: string
  ): Promise<{
    hlsUrl?: string;
    mp4Url?: string;
    captionVttUrl?: string;
    embedBaseUrl?: string;
  }> {
    const result: {
      hlsUrl?: string;
      mp4Url?: string;
      captionVttUrl?: string;
      embedBaseUrl?: string;
    } = {};

    try {
      const embedData = await this.requestData<{ html?: string }>(
        `/embed/video/${videoId}`
      );
      const html = embedData?.html || "";
      const urlMatch = html.match(
        /https:\/\/[a-zA-Z0-9-]+\.vidalytics\.com\/embeds\/[^'"\s)]+/
      );

      if (!urlMatch) return result;

      result.embedBaseUrl = urlMatch[0].replace(/\/$/, "");

      const playerRes = await fetch(result.embedBaseUrl + "/player.min.js");
      if (!playerRes.ok) return result;

      const playerJs = await playerRes.text();

      // Try to extract structured config
      const configMatch = playerJs.match(
        /options:\s*(\{[\s\S]*?"duration":\s*\d+[\s\S]*?\})/
      );
      if (configMatch) {
        try {
          const config = JSON.parse(configMatch[1]);

          // Caption VTT
          const captionVtt =
            config?.player?.vtt?.captions ||
            config?.player?.vtt?.subtitles;
          if (captionVtt) result.captionVttUrl = captionVtt;

          // HLS source
          const hls = config?.player?.media?.hls?.source;
          if (hls) result.hlsUrl = hls;

          // MP4 / direct source
          const mp4 =
            config?.player?.media?.mp4?.source ||
            config?.player?.media?.progressive?.source;
          if (mp4) result.mp4Url = mp4;
        } catch {
          // Config parse failed
        }
      }

      // Fallback: regex for HLS URL in the JS
      if (!result.hlsUrl) {
        const hlsMatch = playerJs.match(
          /https?:\/\/[^"'\s]+\.m3u8[^"'\s]*/
        );
        if (hlsMatch) result.hlsUrl = hlsMatch[0];
      }

      // Fallback: regex for MP4 URL in the JS
      if (!result.mp4Url) {
        const mp4Match = playerJs.match(
          /https?:\/\/[^"'\s]+\.mp4[^"'\s]*/
        );
        if (mp4Match) result.mp4Url = mp4Match[0];
      }

      // Fallback: regex for VTT URLs in the JS
      if (!result.captionVttUrl) {
        const vttMatch = playerJs.match(
          /https?:\/\/[^"'\s]+(?:caption|subtitle)[^"'\s]*\.vtt/i
        );
        if (vttMatch) result.captionVttUrl = vttMatch[0];
      }
    } catch {
      // Embed extraction failed
    }

    return result;
  }

  async getVideoScript(
    videoId: string
  ): Promise<{
    text: string;
    language?: string;
    source: string;
    segments: TranscriptSegment[];
    mediaUrl?: string;
  }> {
    // Strategy 1: Direct captions API endpoint
    try {
      const captions = await this.requestData<
        Array<{
          id?: string;
          language?: string;
          url?: string;
          content?: string;
          text?: string;
        }>
      >(`/video/${videoId}/captions`);

      if (captions && captions.length > 0) {
        const cap = captions[0];
        if (cap.text)
          return {
            text: cap.text,
            language: cap.language,
            source: "api",
            segments: [],
          };
        if (cap.content) {
          return {
            text: parseVTTtoText(cap.content),
            language: cap.language,
            source: "api",
            segments: parseVTTtoSegments(cap.content),
          };
        }
        if (cap.url) {
          const vttRes = await fetch(cap.url);
          if (vttRes.ok) {
            const rawVtt = await vttRes.text();
            return {
              text: parseVTTtoText(rawVtt),
              language: cap.language,
              source: "api",
              segments: parseVTTtoSegments(rawVtt),
            };
          }
        }
      }
    } catch {
      // Endpoint may not exist
    }

    // Strategy 2: Extract from embed config
    const mediaInfo = await this.extractMediaInfo(videoId);

    // Try caption VTT first (fast, no Whisper needed)
    if (mediaInfo.captionVttUrl) {
      try {
        const vttRes = await fetch(mediaInfo.captionVttUrl);
        if (vttRes.ok) {
          const rawVtt = await vttRes.text();
          const text = parseVTTtoText(rawVtt);
          if (text.length > 20) {
            return {
              text,
              source: "embed-vtt",
              segments: parseVTTtoSegments(rawVtt),
            };
          }
        }
      } catch {
        // VTT fetch failed
      }
    }

    // Try HLS subtitles track
    if (mediaInfo.hlsUrl) {
      try {
        const m3u8Res = await fetch(mediaInfo.hlsUrl);
        if (m3u8Res.ok) {
          const m3u8 = await m3u8Res.text();
          const subtitleMatch = m3u8.match(
            /#EXT-X-MEDIA:TYPE=SUBTITLES[^\n]*URI="([^"]+)"/
          );
          if (subtitleMatch) {
            const base = mediaInfo.hlsUrl.substring(
              0,
              mediaInfo.hlsUrl.lastIndexOf("/") + 1
            );
            const subUrl = subtitleMatch[1].startsWith("http")
              ? subtitleMatch[1]
              : base + subtitleMatch[1];
            const subRes = await fetch(subUrl);
            if (subRes.ok) {
              const rawVtt = await subRes.text();
              const text = parseVTTtoText(rawVtt);
              if (text.length > 20) {
                return {
                  text,
                  source: "hls-subtitles",
                  segments: parseVTTtoSegments(rawVtt),
                };
              }
            }
          }
        }
      } catch {
        // HLS subtitle extraction failed
      }
    }

    // No captions found — return mediaUrl so the caller can use Whisper
    const mediaUrl = mediaInfo.hlsUrl || mediaInfo.mp4Url;
    if (mediaUrl) {
      throw new MediaUrlAvailableError(
        "Subtitles not found, but a media URL is available for Whisper transcription.",
        mediaUrl
      );
    }

    throw new Error(
      "Subtitles/script not available and no media URL extracted. " +
        "Make sure the video exists and is published on Vidalytics."
    );
  }

  // ── Account / Usage ─────────────────────────────────────────────

  async getAccountInfo(): Promise<{
    plan: string;
    api_requests_used: number;
    api_requests_limit: number;
    email: string;
  }> {
    const usage = await this.requestContent<ApiUsage>("/stats/usage");
    return {
      plan: "Premium",
      api_requests_used: usage.current_usage || 0,
      api_requests_limit: usage.monthly_limit || 3000,
      email: "",
    };
  }
}
