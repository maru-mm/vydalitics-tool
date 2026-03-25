"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import {
  formatNumber,
  formatPercent,
  formatDuration,
  cn,
} from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Play,
  Clock,
  TrendingDown,
  Target,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Video,
  Search,
  Microscope,
  Brain,
  Eye,
  FileText,
  ArrowRight,
  CheckCircle2,
  BarChart3,
  Table2,
  Expand,
  Shrink,
  X,
  Download,
  Copy,
  Check,
} from "lucide-react";
import type {
  VidalyticsVideo,
  VideoStats,
  DropOffStats,
  TranscriptSegment,
} from "@/lib/vidalytics-api";

// ─── Types ───────────────────────────────────────────────────────────

interface DropOffPoint {
  second: number;
  label: string;
  viewers: number;
  retention: number;
}

interface TableRow {
  id: number;
  fromSecond: number;
  toSecond: number;
  fromLabel: string;
  toLabel: string;
  dropPct: number;
  retentionBefore: number;
  retentionAfter: number;
  viewersBefore: number;
  viewersAfter: number;
  transcriptContext: string;
  geminiAnalysis: string | null;
  geminiLoading: boolean;
  claudeGeneralAnalysis: string | null;
  claudeSuggestions: string | null;
  claudeLoading: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getTranscriptAtTimestamp(
  segments: TranscriptSegment[],
  second: number,
  windowSeconds = 15
): string {
  if (!segments.length) return "";
  const start = Math.max(0, second - windowSeconds);
  const end = second + windowSeconds;
  const relevant = segments.filter(
    (s) => s.endSeconds >= start && s.startSeconds <= end
  );
  return relevant.map((s) => s.text).join(" ");
}

function getSeverityColor(dropPct: number): string {
  if (dropPct >= 8) return "text-red-600";
  if (dropPct >= 5) return "text-orange-500";
  return "text-amber-500";
}

// ─── Frame Capture ──────────────────────────────────────────────────

async function captureFrameAtTimestamp(
  hlsUrl: string,
  timestamp: number,
  width = 640
): Promise<string | null> {
  const HlsModule = await import("hls.js");
  const Hls = HlsModule.default;

  return new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, 20000);

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.style.position = "fixed";
    video.style.left = "-9999px";
    video.style.top = "-9999px";
    document.body.appendChild(video);

    let hls: InstanceType<typeof Hls> | null = null;

    function cleanup() {
      clearTimeout(timeout);
      if (hls) {
        hls.destroy();
        hls = null;
      }
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (video.parentNode) video.parentNode.removeChild(video);
    }

    function grabFrame() {
      try {
        const canvas = document.createElement("canvas");
        const aspect = video.videoHeight / video.videoWidth;
        canvas.width = width;
        canvas.height = Math.round(width * aspect);
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          cleanup();
          return resolve(null);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
        cleanup();
        resolve(dataUrl);
      } catch {
        cleanup();
        resolve(null);
      }
    }

    if (Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 10, maxMaxBufferLength: 15 });
      hls.loadSource(hlsUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.currentTime = timestamp;
      });

      video.addEventListener("seeked", grabFrame, { once: true });

      hls.on(
        Hls.Events.ERROR,
        (_: unknown, data: { fatal?: boolean }) => {
          if (data.fatal) {
            cleanup();
            resolve(null);
          }
        }
      );
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = hlsUrl;
      video.addEventListener(
        "loadedmetadata",
        () => {
          video.currentTime = timestamp;
        },
        { once: true }
      );
      video.addEventListener("seeked", grabFrame, { once: true });
      video.addEventListener(
        "error",
        () => {
          cleanup();
          resolve(null);
        },
        { once: true }
      );
    } else {
      cleanup();
      resolve(null);
    }
  });
}

function getSeverityBadge(
  dropPct: number
): "danger" | "warning" | "info" {
  if (dropPct >= 8) return "danger";
  if (dropPct >= 5) return "warning";
  return "info";
}

function getSeverityLabel(dropPct: number): string {
  if (dropPct >= 8) return "Critico";
  if (dropPct >= 5) return "Importante";
  return "Moderato";
}

// ─── Pulsing Dot (SVG) ──────────────────────────────────────────────

function PulsingDot({ cx, cy, dropPct, onClick }: { cx: number; cy: number; dropPct: number; onClick?: () => void }) {
  const color = dropPct >= 8 ? "#ef4444" : dropPct >= 5 ? "#f97316" : "#eab308";
  return (
    <g style={{ cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={color} strokeWidth={2} opacity={0.6}>
        <animate attributeName="r" from="6" to="18" dur="1.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.6" to="0" dur="1.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={6} fill="none" stroke={color} strokeWidth={1.5} opacity={0.4}>
        <animate attributeName="r" from="6" to="15" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
        <animate attributeName="opacity" from="0.4" to="0" dur="1.5s" begin="0.5s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.15}>
        <animate attributeName="opacity" values="0.15;0.35;0.15" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="#fff" strokeWidth={2} />
    </g>
  );
}

// ─── Popup Cell Component ────────────────────────────────────────────

function PopupCell({
  content,
  isMarkdown,
  maxHeight = 80,
  loading,
  emptyText = "—",
  title,
}: {
  content: string | null;
  isMarkdown?: boolean;
  maxHeight?: number;
  loading?: boolean;
  emptyText?: string;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    if (contentRef.current) {
      setOverflows(contentRef.current.scrollHeight > maxHeight + 10);
    }
  }, [content, maxHeight]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Analizzando...</span>
      </div>
    );
  }

  if (!content) {
    return (
      <span className="text-xs text-muted-foreground italic">{emptyText}</span>
    );
  }

  return (
    <>
      <div
        className={cn(
          "relative cursor-pointer group",
          overflows && "hover:bg-primary/[0.03] rounded-md -mx-1 px-1 transition-colors"
        )}
        onClick={() => overflows && setOpen(true)}
      >
        <div
          ref={contentRef}
          className="overflow-hidden"
          style={{ maxHeight }}
        >
          {isMarkdown ? (
            <div className="prose prose-xs max-w-none prose-headings:text-foreground prose-headings:text-xs prose-headings:font-semibold prose-headings:mt-2 prose-headings:mb-1 prose-p:text-[11px] prose-p:leading-relaxed prose-p:text-muted-foreground prose-p:my-0.5 prose-strong:text-foreground prose-strong:text-[11px] prose-li:text-[11px] prose-li:text-muted-foreground prose-li:my-0 prose-ul:my-1 prose-ol:my-1">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
              {content}
            </p>
          )}
        </div>
        {overflows && (
          <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white to-transparent pointer-events-none" />
        )}
        {overflows && (
          <span className="mt-1 flex items-center gap-1 text-[10px] font-medium text-primary opacity-60 group-hover:opacity-100 transition-opacity">
            <Expand className="h-3 w-3" /> Leggi tutto
          </span>
        )}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative mx-4 w-full max-w-xl max-h-[80vh] overflow-y-auto rounded-2xl border border-border bg-white shadow-2xl animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-white/95 backdrop-blur-sm px-5 py-3 rounded-t-2xl">
              <span className="text-sm font-semibold text-foreground">
                {title || "Dettaglio Analisi"}
              </span>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <Shrink className="h-4 w-4" />
              </button>
            </div>
            <div className="px-5 py-4">
              {isMarkdown ? (
                <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:text-sm prose-headings:font-semibold prose-headings:mt-3 prose-headings:mb-1.5 prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-muted-foreground prose-p:my-1 prose-strong:text-foreground prose-strong:text-[13px] prose-li:text-[13px] prose-li:text-muted-foreground prose-li:my-0.5 prose-ul:my-1.5 prose-ol:my-1.5">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                </div>
              ) : (
                <p className="text-[13px] leading-relaxed text-muted-foreground whitespace-pre-wrap">
                  {content}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Video Frame Preview Modal ──────────────────────────────────────

function VideoFramePreview({
  streamUrl,
  timestamp,
  drop,
  thumbnailUrl,
  onClose,
}: {
  streamUrl: string | null;
  timestamp: number;
  drop: {
    second: number;
    dropPct: number;
    retentionBefore: number;
    retentionAfter: number;
    label: string;
  };
  thumbnailUrl?: string;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const hlsRef = useRef<{ destroy: () => void } | null>(null);

  useEffect(() => {
    if (!streamUrl) {
      setIsLoading(false);
      setError(true);
      return;
    }

    const video = videoRef.current;
    if (!video) return;

    setIsLoading(true);
    setError(false);

    import("hls.js")
      .then((HlsModule) => {
        const Hls = HlsModule.default;

        if (Hls.isSupported()) {
          const hls = new Hls();
          hlsRef.current = hls;
          hls.loadSource(streamUrl);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            video.currentTime = timestamp;
          });

          video.addEventListener("seeked", () => setIsLoading(false), {
            once: true,
          });

          hls.on(Hls.Events.ERROR, (_: unknown, data: { fatal?: boolean }) => {
            if (data.fatal) {
              setError(true);
              setIsLoading(false);
            }
          });
        } else if (
          video.canPlayType("application/vnd.apple.mpegurl")
        ) {
          video.src = streamUrl;
          video.addEventListener(
            "loadedmetadata",
            () => {
              video.currentTime = timestamp;
            },
            { once: true }
          );
          video.addEventListener("seeked", () => setIsLoading(false), {
            once: true,
          });
          video.addEventListener(
            "error",
            () => {
              setError(true);
              setIsLoading(false);
            },
            { once: true }
          );
        } else {
          setError(true);
          setIsLoading(false);
        }
      })
      .catch(() => {
        setError(true);
        setIsLoading(false);
      });

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [streamUrl, timestamp]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const severityColor =
    drop.dropPct >= 8
      ? "text-red-500"
      : drop.dropPct >= 5
      ? "text-orange-500"
      : "text-amber-500";

  const severityBg =
    drop.dropPct >= 8
      ? "bg-red-500/10"
      : drop.dropPct >= 5
      ? "bg-orange-500/10"
      : "bg-amber-500/10";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl mx-4 rounded-2xl bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 rounded-full bg-black/50 p-2 text-white hover:bg-black/70 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Video area */}
        <div className="relative aspect-video bg-black">
          <video
            ref={videoRef}
            className="w-full h-full object-contain"
            playsInline
            poster={thumbnailUrl}
            onClick={togglePlay}
            style={{ cursor: "pointer" }}
          />

          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60">
              <Loader2 className="h-10 w-10 text-white animate-spin" />
              <p className="mt-3 text-sm text-white/70">
                Caricamento frame a {formatTimestamp(timestamp)}...
              </p>
            </div>
          )}

          {!isLoading && !isPlaying && !error && (
            <div
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
              onClick={togglePlay}
            >
              <div className="rounded-full bg-white/20 backdrop-blur-sm p-5 transition-transform hover:scale-110">
                <Play className="h-10 w-10 text-white fill-white" />
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-white">
              <AlertTriangle className="h-10 w-10 mb-3 text-amber-400" />
              <p className="text-sm font-medium">
                Impossibile caricare il video
              </p>
              <p className="text-xs text-white/50 mt-1">
                Lo stream HLS non è disponibile per questo video
              </p>
            </div>
          )}

          {/* Timestamp badge */}
          <div className="absolute top-3 left-3 rounded-lg bg-black/60 backdrop-blur-sm px-3 py-1.5">
            <span className="font-mono text-sm font-bold text-white">
              {formatTimestamp(timestamp)}
            </span>
          </div>
        </div>

        {/* Drop info bar */}
        <div className="px-5 py-4 border-t border-border bg-secondary/30">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <div className={cn("rounded-lg p-2", severityBg)}>
                <TrendingDown className={cn("h-4 w-4", severityColor)} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  Drop
                </p>
                <p
                  className={cn(
                    "text-lg font-bold font-mono leading-tight",
                    severityColor
                  )}
                >
                  -{drop.dropPct.toFixed(1)}%
                </p>
              </div>
            </div>

            <div className="h-10 w-px bg-border" />

            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Intervallo
              </p>
              <p className="font-mono font-semibold text-sm">{drop.label}</p>
            </div>

            <div className="h-10 w-px bg-border" />

            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                Retention
              </p>
              <p className="font-medium text-sm">
                {drop.retentionBefore.toFixed(0)}% →{" "}
                <span className={severityColor}>
                  {drop.retentionAfter.toFixed(0)}%
                </span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────

export default function VSLAnalysisPage({
  pageTitle = "Analisi Profonda VSL",
  pageSubtitle = "Drop-off, frame analysis (Gemini) e suggerimenti (Claude) in una vista unica",
}: {
  pageTitle?: string;
  pageSubtitle?: string;
} = {}) {
  const { dateRange } = useAppStore();
  const { apiFetch, isConfigured } = useApi();

  // Video selection
  const [videos, setVideos] = useState<VidalyticsVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showVideoSelector, setShowVideoSelector] = useState(false);
  const selectorRef = useRef<HTMLDivElement>(null);

  // Data
  const [video, setVideo] = useState<VidalyticsVideo | null>(null);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [dropOff, setDropOff] = useState<DropOffStats | null>(null);
  const [transcript, setTranscript] = useState<{
    text: string;
    segments: TranscriptSegment[];
  } | null>(null);
  const [transcriptError, setTranscriptError] = useState(false);
  const [transcriptNeedsOpenAI, setTranscriptNeedsOpenAI] = useState(false);
  const [transcriptSource, setTranscriptSource] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(false);

  // Table data
  const [tableRows, setTableRows] = useState<TableRow[]>([]);
  const [analysisStarted, setAnalysisStarted] = useState(false);

  // Claude full report
  const [claudeReport, setClaudeReport] = useState<string | null>(null);
  const [claudeReportLoading, setClaudeReportLoading] = useState(false);
  const [claudeReportExpanded, setClaudeReportExpanded] = useState(true);

  // Video frame preview
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [selectedDrop, setSelectedDrop] = useState<{
    second: number;
    dropPct: number;
    retentionBefore: number;
    retentionAfter: number;
    label: string;
  } | null>(null);

  // Script download modal
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [scriptCopied, setScriptCopied] = useState(false);

  // ─── Data Loading ────────────────────────────────────────────────

  useEffect(() => {
    if (!isConfigured) return;
    setVideosLoading(true);
    apiFetch<VidalyticsVideo[]>("/videos")
      .then(setVideos)
      .catch(() => {})
      .finally(() => setVideosLoading(false));
  }, [apiFetch, isConfigured]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        selectorRef.current &&
        !selectorRef.current.contains(e.target as Node)
      ) {
        setShowVideoSelector(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) || v.title?.toLowerCase().includes(q)
    );
  }, [videos, searchQuery]);

  useEffect(() => {
    if (!selectedVideoId || !isConfigured) return;
    setDataLoading(true);
    setVideo(null);
    setStats(null);
    setDropOff(null);
    setTranscript(null);
    setTranscriptError(false);
    setTranscriptNeedsOpenAI(false);
    setTranscriptSource(null);
    setTableRows([]);
    setClaudeReport(null);
    setAnalysisStarted(false);
    setStreamUrl(null);
    setSelectedDrop(null);

    Promise.allSettled([
      apiFetch<VidalyticsVideo>(`/videos/${selectedVideoId}`),
      apiFetch<VideoStats>(`/videos/${selectedVideoId}/stats`),
      apiFetch<DropOffStats>(`/videos/${selectedVideoId}/drop-off`),
      apiFetch<{ text: string; segments: TranscriptSegment[]; source?: string }>(
        `/videos/${selectedVideoId}/script`
      ),
    ]).then(([videoRes, statsRes, dropOffRes, scriptRes]) => {
      if (videoRes.status === "fulfilled") setVideo(videoRes.value);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (dropOffRes.status === "fulfilled") setDropOff(dropOffRes.value);
      if (scriptRes.status === "fulfilled") {
        setTranscript(scriptRes.value);
        setTranscriptSource(scriptRes.value.source || "vtt");
      } else {
        setTranscriptError(true);
        const reason = scriptRes.reason;
        if (reason?.message?.includes("OpenAI")) {
          setTranscriptNeedsOpenAI(true);
        }
      }
      setDataLoading(false);
    });

    apiFetch<{ hlsUrl: string; posterUrl: string | null; duration: number | null }>(
      `/videos/${selectedVideoId}/stream`
    )
      .then((res) => setStreamUrl(res.hlsUrl))
      .catch(() => {});
  }, [selectedVideoId, apiFetch, isConfigured, dateRange]);

  // ─── Drop-off processing ────────────────────────────────────────

  const dropOffData = useMemo<DropOffPoint[]>(() => {
    if (!dropOff?.watches) return [];
    const entries = Object.entries(dropOff.watches)
      .map(([sec, count]) => ({ sec: parseInt(sec), count }))
      .sort((a, b) => a.sec - b.sec);
    if (entries.length === 0) return [];
    const maxViewers = entries[0]?.count || 1;
    return entries.map(({ sec, count }) => ({
      second: sec,
      label: formatTimestamp(sec),
      viewers: count,
      retention: (count / maxViewers) * 100,
    }));
  }, [dropOff]);

  const sampledDropOff = useMemo(() => {
    if (dropOffData.length <= 150) return dropOffData;
    const step = Math.ceil(dropOffData.length / 150);
    const sampled: DropOffPoint[] = [];
    for (let i = 0; i < dropOffData.length; i += step) {
      sampled.push(dropOffData[i]);
    }
    if (sampled[sampled.length - 1] !== dropOffData[dropOffData.length - 1]) {
      sampled.push(dropOffData[dropOffData.length - 1]);
    }
    return sampled;
  }, [dropOffData]);

  const computedCriticalDrops = useMemo(() => {
    if (dropOffData.length < 2) return [];
    const maxViewers = dropOffData[0]?.viewers || 1;
    const points: Array<{
      fromSecond: number;
      toSecond: number;
      dropPct: number;
      retentionBefore: number;
      retentionAfter: number;
      viewersBefore: number;
      viewersAfter: number;
    }> = [];
    const windowSize = Math.max(3, Math.floor(dropOffData.length * 0.02));
    for (let i = windowSize; i < dropOffData.length; i++) {
      const prev = dropOffData[i - windowSize];
      const curr = dropOffData[i];
      const dropPct = ((prev.viewers - curr.viewers) / maxViewers) * 100;
      if (dropPct > 2.5) {
        points.push({
          fromSecond: prev.second,
          toSecond: curr.second,
          dropPct,
          retentionBefore: prev.retention,
          retentionAfter: curr.retention,
          viewersBefore: prev.viewers,
          viewersAfter: curr.viewers,
        });
      }
    }
    const deduped: typeof points = [];
    const sorted = points.sort((a, b) => b.dropPct - a.dropPct);
    for (const p of sorted) {
      const overlaps = deduped.some(
        (d) =>
          Math.abs(d.fromSecond - p.fromSecond) < 20 ||
          Math.abs(d.toSecond - p.toSecond) < 20
      );
      if (!overlaps) deduped.push(p);
      if (deduped.length >= 8) break;
    }
    return deduped.sort((a, b) => a.fromSecond - b.fromSecond);
  }, [dropOffData]);

  const retentionMilestones = useMemo(() => {
    if (dropOffData.length === 0) return [];
    const thresholds = [75, 50, 25, 10];
    const milestones: { threshold: number; second: number; label: string }[] =
      [];
    for (const t of thresholds) {
      const point = dropOffData.find((d) => d.retention <= t);
      if (point) {
        milestones.push({
          threshold: t,
          second: point.second,
          label: formatTimestamp(point.second),
        });
      }
    }
    return milestones;
  }, [dropOffData]);

  const criticalDropDots = useMemo(() => {
    if (!sampledDropOff.length || !computedCriticalDrops.length) return [];
    return computedCriticalDrops.map((drop) => {
      let closest = sampledDropOff[0];
      let minDist = Math.abs(sampledDropOff[0].second - drop.toSecond);
      for (const pt of sampledDropOff) {
        const dist = Math.abs(pt.second - drop.toSecond);
        if (dist < minDist) {
          minDist = dist;
          closest = pt;
        }
      }
      return {
        label: closest.label,
        retention: closest.retention,
        dropPct: drop.dropPct,
        fromSecond: drop.fromSecond,
        toSecond: drop.toSecond,
        retentionBefore: drop.retentionBefore,
        retentionAfter: drop.retentionAfter,
        viewersBefore: drop.viewersBefore,
        viewersAfter: drop.viewersAfter,
      };
    });
  }, [sampledDropOff, computedCriticalDrops]);

  // ─── Analysis orchestration ──────────────────────────────────────

  const startAnalysis = useCallback(async () => {
    if (!video || computedCriticalDrops.length === 0) return;
    setAnalysisStarted(true);
    const segments = transcript?.segments || [];

    const rows: TableRow[] = computedCriticalDrops.map((d, i) => ({
      id: i,
      ...d,
      fromLabel: formatTimestamp(d.fromSecond),
      toLabel: formatTimestamp(d.toSecond),
      transcriptContext: getTranscriptAtTimestamp(segments, d.fromSecond, 20),
      geminiAnalysis: null,
      geminiLoading: true,
      claudeGeneralAnalysis: null,
      claudeSuggestions: null,
      claudeLoading: true,
    }));
    setTableRows(rows);

    // 1) Capture frames + run Gemini for each drop
    const geminiResults: (string | null)[] = new Array(rows.length).fill(null);

    const geminiPromises = rows.map(async (row, i) => {
      // Capture frame from the HLS stream at the drop timestamp
      let frameBase64: string | null = null;
      if (streamUrl) {
        try {
          frameBase64 = await captureFrameAtTimestamp(
            streamUrl,
            row.fromSecond,
            640
          );
        } catch {
          // Frame capture failed, continue without it
        }
      }

      try {
        const res = await fetch("/api/ai/gemini-frame", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            videoName: video.name || video.title,
            timestamp: row.fromSecond,
            timestampLabel: row.fromLabel,
            dropPct: row.dropPct,
            retentionBefore: row.retentionBefore,
            retentionAfter: row.retentionAfter,
            transcriptContext: row.transcriptContext,
            frameBase64,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          geminiResults[i] = data.analysis;
          setTableRows((prev) =>
            prev.map((r) =>
              r.id === i
                ? { ...r, geminiAnalysis: data.analysis, geminiLoading: false }
                : r
            )
          );
        } else {
          setTableRows((prev) =>
            prev.map((r) =>
              r.id === i
                ? {
                    ...r,
                    geminiAnalysis: "Errore Gemini",
                    geminiLoading: false,
                  }
                : r
            )
          );
        }
      } catch {
        setTableRows((prev) =>
          prev.map((r) =>
            r.id === i
              ? { ...r, geminiAnalysis: "Errore Gemini", geminiLoading: false }
              : r
          )
        );
      }
    });

    await Promise.allSettled(geminiPromises);

    // 2) Run Claude table analysis + full report in parallel
    const claudeTablePromise = fetch("/api/ai/claude-table-analysis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoName: video.name || video.title,
        drops: rows.map((r, i) => ({
          timestampLabel: `${r.fromLabel} → ${r.toLabel}`,
          dropPct: r.dropPct,
          retentionBefore: r.retentionBefore,
          retentionAfter: r.retentionAfter,
          transcriptContext: r.transcriptContext,
          geminiAnalysis: geminiResults[i] || "N/D",
        })),
        fullTranscript: transcript?.text || "",
        stats,
      }),
    });

    setClaudeReportLoading(true);
    const claudeReportPromise = fetch("/api/ai/claude-improvements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videoName: video.name || video.title,
        fullTranscript: transcript?.text || "",
        criticalDrops: rows.map((r, i) => ({
          timestampLabel: `${r.fromLabel} → ${r.toLabel}`,
          dropPct: r.dropPct,
          retentionBefore: r.retentionBefore,
          retentionAfter: r.retentionAfter,
          transcriptContext: r.transcriptContext,
        })),
        geminiAnalyses: geminiResults.map((g) => g || "N/D"),
        stats,
      }),
    });

    // Handle Claude table results
    try {
      const tableRes = await claudeTablePromise;
      if (tableRes.ok) {
        const data = await tableRes.json();
        if (data.drops && Array.isArray(data.drops)) {
          setTableRows((prev) =>
            prev.map((r) => {
              const match = data.drops[r.id];
              if (!match) return { ...r, claudeLoading: false };
              return {
                ...r,
                claudeGeneralAnalysis: match.generalAnalysis || null,
                claudeSuggestions: match.suggestions || null,
                claudeLoading: false,
              };
            })
          );
        } else {
          setTableRows((prev) =>
            prev.map((r) => ({ ...r, claudeLoading: false }))
          );
        }
      } else {
        setTableRows((prev) =>
          prev.map((r) => ({ ...r, claudeLoading: false }))
        );
      }
    } catch {
      setTableRows((prev) =>
        prev.map((r) => ({ ...r, claudeLoading: false }))
      );
    }

    // Handle Claude full report
    try {
      const reportRes = await claudeReportPromise;
      if (reportRes.ok) {
        const data = await reportRes.json();
        setClaudeReport(data.improvements);
      } else {
        setClaudeReport("Errore nella generazione del report.");
      }
    } catch {
      setClaudeReport("Errore nella generazione del report.");
    } finally {
      setClaudeReportLoading(false);
    }
  }, [video, computedCriticalDrops, transcript, stats, streamUrl]);

  // ─── Script download handlers ─────────────────────────────────────

  const handleDownloadScript = useCallback(() => {
    if (!transcript?.text || !video) return;
    const filename = `${(video.name || video.title || "vsl-script").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    const blob = new Blob([transcript.text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [transcript, video]);

  const handleCopyScript = useCallback(() => {
    if (!transcript?.text) return;
    navigator.clipboard.writeText(transcript.text);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  }, [transcript]);

  // ─── Render helpers ──────────────────────────────────────────────

  if (!isConfigured) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="rounded-2xl bg-primary/10 p-5 mb-4">
          <Microscope className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold">Configura API Token</h2>
        <p className="mt-2 text-muted-foreground max-w-md">
          Vai nelle Impostazioni per configurare il tuo token API Vidalytics
          prima di utilizzare l&apos;analisi VSL.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 p-2.5">
          <Microscope className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {pageTitle}
          </h1>
          <p className="text-sm text-muted-foreground">
            {pageSubtitle}
          </p>
        </div>
      </div>

      {/* ── Video Selector ──────────────────────────────────────── */}
      <Card className="relative">
        <div className="flex items-center gap-3 mb-3">
          <Video className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">Seleziona Video</h3>
        </div>
        <div className="relative" ref={selectorRef}>
          <div
            className="flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-3 cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => setShowVideoSelector(!showVideoSelector)}
          >
            <Search className="h-4 w-4 text-muted-foreground" />
            {video ? (
              <div className="flex items-center gap-3 flex-1">
                {video.thumbnail_url && (
                  <img
                    src={video.thumbnail_url}
                    alt=""
                    className="h-8 w-14 rounded object-cover"
                  />
                )}
                <span className="font-medium truncate">
                  {video.name || video.title}
                </span>
                <Badge variant="success" className="ml-auto shrink-0">
                  Selezionato
                </Badge>
              </div>
            ) : (
              <span className="text-muted-foreground flex-1">
                {videosLoading
                  ? "Caricamento video..."
                  : "Cerca e seleziona un video..."}
              </span>
            )}
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                showVideoSelector && "rotate-180"
              )}
            />
          </div>
          {showVideoSelector && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-auto rounded-xl border border-border bg-white shadow-xl animate-fade-in">
              <div className="sticky top-0 bg-white p-2 border-b border-border">
                <input
                  type="text"
                  placeholder="Cerca video..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-secondary px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/20"
                  autoFocus
                />
              </div>
              {filteredVideos.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Nessun video trovato
                </div>
              ) : (
                filteredVideos.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVideoId(v.id);
                      setShowVideoSelector(false);
                      setSearchQuery("");
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/80",
                      selectedVideoId === v.id && "bg-primary/5"
                    )}
                  >
                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-secondary overflow-hidden">
                      {v.thumbnail_url ? (
                        <img
                          src={v.thumbnail_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Video className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">
                        {v.name || v.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.status || "active"}
                        {v.duration ? ` · ${formatDuration(v.duration)}` : ""}
                      </p>
                    </div>
                    {selectedVideoId === v.id && (
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      </Card>

      {/* ── Loading skeleton ────────────────────────────────────── */}
      {dataLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse-soft rounded-xl border border-border bg-card"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse-soft rounded-xl border border-border bg-card" />
        </div>
      )}

      {/* ── Main content ────────────────────────────────────────── */}
      {!dataLoading && video && stats && (
        <>
          {/* Quick Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Play Totali"
              value={formatNumber(stats.plays)}
              change={`${formatNumber(stats.unique_plays)} unici`}
              icon={<Play className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="% Media Guardata"
              value={formatPercent(stats.avg_percent_watched)}
              change={
                stats.avg_percent_watched > 0.5
                  ? "Buona retention"
                  : "Sotto la media"
              }
              changeType={
                stats.avg_percent_watched > 0.5 ? "positive" : "negative"
              }
              icon={<Target className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Tempo Medio"
              value={formatDuration(stats.avg_watch_time)}
              change={`Play Rate: ${formatPercent(stats.play_rate)}`}
              icon={<Clock className="h-5 w-5 text-primary" />}
            />
            <StatCard
              label="Conversioni"
              value={formatNumber(stats.conversions)}
              change={`Rate: ${formatPercent(stats.conversion_rate)}`}
              changeType={
                stats.conversion_rate > 0.03
                  ? "positive"
                  : stats.conversion_rate > 0.01
                  ? "neutral"
                  : "negative"
              }
              icon={<TrendingDown className="h-5 w-5 text-primary" />}
            />
          </div>

          {/* Retention Chart */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  Curva di Retention
                </h3>
                <p className="text-sm text-muted-foreground mt-0.5">
                  I marcatori rossi indicano i punti di drop-off significativi
                </p>
              </div>
              <div className="flex items-center gap-2">
                {transcript && (
                  <>
                    <Badge variant="success">
                      <FileText className="h-3 w-3 mr-1" />
                      {transcriptSource?.includes("whisper")
                        ? "Whisper AI"
                        : "Transcript OK"}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowScriptModal(true)}
                      title="Visualizza e scarica lo script"
                    >
                      <FileText className="h-4 w-4" />
                      Script
                    </Button>
                  </>
                )}
                {transcriptError && !transcriptNeedsOpenAI && (
                  <Badge variant="warning">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    No transcript
                  </Badge>
                )}
                {transcriptNeedsOpenAI && (
                  <Badge variant="info">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Configura OpenAI Key
                  </Badge>
                )}
              </div>
            </div>

            {sampledDropOff.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={340}>
                  <AreaChart data={sampledDropOff}>
                    <defs>
                      <linearGradient
                        id="retGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="5%"
                          stopColor="#6366f1"
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor="#6366f1"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      stroke="#94a3b8"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      stroke="#94a3b8"
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.[0]) return null;
                        const d = payload[0].payload as DropOffPoint;
                        return (
                          <div className="rounded-lg border border-border bg-white p-3 shadow-lg">
                            <p className="text-sm font-semibold">{d.label}</p>
                            <p className="text-sm text-muted-foreground">
                              Retention:{" "}
                              <span className="font-medium text-primary">
                                {d.retention.toFixed(1)}%
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Spettatori:{" "}
                              <span className="font-medium">
                                {formatNumber(d.viewers)}
                              </span>
                            </p>
                          </div>
                        );
                      }}
                    />
                    <ReferenceLine
                      y={50}
                      stroke="#f97316"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                    />
                    <ReferenceLine
                      y={25}
                      stroke="#ef4444"
                      strokeDasharray="5 5"
                      strokeOpacity={0.5}
                    />
                    {computedCriticalDrops.slice(0, 5).map((cp, i) => (
                      <ReferenceLine
                        key={i}
                        x={formatTimestamp(cp.fromSecond)}
                        stroke="#ef4444"
                        strokeDasharray="3 3"
                        strokeOpacity={0.6}
                        label={{
                          value: `#${i + 1}`,
                          position: "top",
                          fill: "#ef4444",
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      />
                    ))}
                    {criticalDropDots.map((dot, i) => (
                      <ReferenceDot
                        key={`pulse-${i}`}
                        x={dot.label}
                        y={dot.retention}
                        r={0}
                        shape={(props: { cx?: number; cy?: number }) => (
                          <PulsingDot
                            cx={props.cx ?? 0}
                            cy={props.cy ?? 0}
                            dropPct={dot.dropPct}
                            onClick={() =>
                              setSelectedDrop({
                                second: dot.toSecond,
                                dropPct: dot.dropPct,
                                retentionBefore: dot.retentionBefore,
                                retentionAfter: dot.retentionAfter,
                                label: `${formatTimestamp(dot.fromSecond)} → ${formatTimestamp(dot.toSecond)}`,
                              })
                            }
                          />
                        )}
                      />
                    ))}
                    <Area
                      type="monotone"
                      dataKey="retention"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#retGrad)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: "#6366f1",
                        stroke: "#fff",
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>

                {retentionMilestones.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {retentionMilestones.map((m) => (
                      <div
                        key={m.threshold}
                        className="rounded-lg border border-border bg-secondary/30 p-3 text-center"
                      >
                        <p className="text-xs font-medium text-muted-foreground">
                          Sotto {m.threshold}%
                        </p>
                        <p className="mt-1 text-lg font-bold">{m.label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <BarChart3 className="h-8 w-8 mb-2" />
                <p>Dati di drop-off non disponibili</p>
              </div>
            )}
          </Card>

          {/* ════════════════════════════════════════════════════════
              EXCEL-STYLE TABLE
              ════════════════════════════════════════════════════════ */}
          {computedCriticalDrops.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Table2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Analisi Drop-Off — Vista Tabella
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {computedCriticalDrops.length} drop significativi ·
                      Timestamp, copy, Gemini, analisi, suggerimenti
                    </p>
                  </div>
                </div>
                {!analysisStarted && (
                  <Button variant="primary" onClick={startAnalysis}>
                    <Zap className="h-4 w-4" />
                    Avvia Analisi AI
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
                {analysisStarted && (
                  <Badge variant="info">
                    <Loader2
                      className={cn(
                        "h-3 w-3 mr-1",
                        tableRows.some(
                          (r) => r.geminiLoading || r.claudeLoading
                        ) && "animate-spin"
                      )}
                    />
                    {tableRows.every(
                      (r) => !r.geminiLoading && !r.claudeLoading
                    )
                      ? "Analisi completata"
                      : "Analisi in corso..."}
                  </Badge>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px]">
                  <thead>
                    <tr className="bg-secondary/60 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <th className="sticky left-0 z-10 bg-secondary/60 w-[100px] px-4 py-3 border-b border-r border-border">
                        Timestamp
                      </th>
                      <th className="w-[70px] px-4 py-3 border-b border-r border-border">
                        Drop
                      </th>
                      <th className="w-[220px] px-4 py-3 border-b border-r border-border">
                        Copy VSL
                      </th>
                      <th className="w-[260px] px-4 py-3 border-b border-r border-border">
                        <span className="flex items-center gap-1">
                          <Eye className="h-3 w-3 text-amber-500" />
                          Analisi Visuale (Gemini)
                        </span>
                      </th>
                      <th className="w-[220px] px-4 py-3 border-b border-r border-border">
                        Analisi Generale
                      </th>
                      <th className="w-[260px] px-4 py-3 border-b border-border">
                        <span className="flex items-center gap-1">
                          <Brain className="h-3 w-3 text-primary" />
                          Suggerimenti (Claude)
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analysisStarted ? tableRows : computedCriticalDrops.map((d, i) => ({
                      id: i,
                      ...d,
                      fromLabel: formatTimestamp(d.fromSecond),
                      toLabel: formatTimestamp(d.toSecond),
                      transcriptContext: getTranscriptAtTimestamp(
                        transcript?.segments || [],
                        d.fromSecond,
                        20
                      ),
                      geminiAnalysis: null,
                      geminiLoading: false,
                      claudeGeneralAnalysis: null,
                      claudeSuggestions: null,
                      claudeLoading: false,
                    }))).map((row, idx) => (
                      <tr
                        key={row.id}
                        className={cn(
                          "align-top transition-colors",
                          idx % 2 === 0 ? "bg-white" : "bg-secondary/20",
                          "hover:bg-primary/[0.03]"
                        )}
                      >
                        {/* Timestamp */}
                        <td className="sticky left-0 z-10 px-4 py-3 border-r border-border bg-inherit">
                          <div className="flex flex-col gap-1">
                            <span className="font-mono text-sm font-bold text-foreground">
                              {row.fromLabel}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              → {row.toLabel}
                            </span>
                            <Badge
                              variant={getSeverityBadge(row.dropPct)}
                              className="w-fit text-[9px] mt-0.5"
                            >
                              {getSeverityLabel(row.dropPct)}
                            </Badge>
                          </div>
                        </td>

                        {/* Drop % */}
                        <td className="px-4 py-3 border-r border-border">
                          <div className="flex flex-col gap-1">
                            <span
                              className={cn(
                                "text-lg font-bold font-mono",
                                getSeverityColor(row.dropPct)
                              )}
                            >
                              -{row.dropPct.toFixed(1)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground leading-tight">
                              {row.retentionBefore.toFixed(0)}% →{" "}
                              {row.retentionAfter.toFixed(0)}%
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {formatNumber(
                                row.viewersBefore - row.viewersAfter
                              )}{" "}
                              persi
                            </span>
                          </div>
                        </td>

                        {/* Copy VSL */}
                        <td className="px-4 py-3 border-r border-border">
                          <PopupCell
                            content={
                              row.transcriptContext
                                ? `"${row.transcriptContext}"`
                                : null
                            }
                            maxHeight={80}
                            emptyText="Transcript non disponibile"
                            title={`Copy VSL — ${row.fromLabel}`}
                          />
                        </td>

                        {/* Gemini */}
                        <td className="px-4 py-3 border-r border-border">
                          <PopupCell
                            content={row.geminiAnalysis}
                            isMarkdown
                            maxHeight={80}
                            loading={row.geminiLoading}
                            emptyText={
                              analysisStarted
                                ? "In attesa..."
                                : "Clicca 'Avvia Analisi AI'"
                            }
                            title={`Analisi Visuale Gemini — ${row.fromLabel}`}
                          />
                        </td>

                        {/* Analisi Generale */}
                        <td className="px-4 py-3 border-r border-border">
                          <PopupCell
                            content={row.claudeGeneralAnalysis}
                            maxHeight={80}
                            loading={row.claudeLoading}
                            emptyText={
                              analysisStarted
                                ? "In attesa..."
                                : "Clicca 'Avvia Analisi AI'"
                            }
                            title={`Analisi Generale — ${row.fromLabel}`}
                          />
                        </td>

                        {/* Suggerimenti Claude */}
                        <td className="px-4 py-3">
                          <PopupCell
                            content={row.claudeSuggestions}
                            maxHeight={80}
                            loading={row.claudeLoading}
                            emptyText={
                              analysisStarted
                                ? "In attesa..."
                                : "Clicca 'Avvia Analisi AI'"
                            }
                            title={`Suggerimenti Claude — ${row.fromLabel}`}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* ════════════════════════════════════════════════════════
              CLAUDE FULL REPORT
              ════════════════════════════════════════════════════════ */}
          {analysisStarted && (
            <Card className="border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Brain className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">
                      Report Completo — Claude AI
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Piano strategico di miglioramento con riscritture e
                      priorità
                    </p>
                  </div>
                </div>
                {claudeReport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setClaudeReportExpanded(!claudeReportExpanded)}
                  >
                    {claudeReportExpanded ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </div>

              {claudeReportLoading && (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="relative">
                    <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
                    <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-primary" />
                  </div>
                  <p className="mt-4 text-sm font-medium text-muted-foreground">
                    Claude sta generando il report completo...
                  </p>
                </div>
              )}

              {claudeReport && claudeReportExpanded && !claudeReportLoading && (
                <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground prose-h2:text-lg prose-h3:text-base">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {claudeReport}
                  </ReactMarkdown>
                </div>
              )}

              {!claudeReport && !claudeReportLoading && (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Loader2 className="h-8 w-8 text-muted-foreground/40 animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground">
                    In attesa del completamento delle analisi Gemini...
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* No drops found */}
          {!dataLoading &&
            dropOffData.length > 0 &&
            computedCriticalDrops.length === 0 && (
              <Card className="py-8 text-center">
                <CheckCircle2 className="mx-auto h-10 w-10 text-success mb-3" />
                <h3 className="text-lg font-semibold">
                  Nessun Drop Critico Rilevato
                </h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                  La curva di retention è stabile — non ci sono drop-off
                  significativi.
                </p>
              </Card>
            )}
        </>
      )}

      {/* ── Empty State ─────────────────────────────────────────── */}
      {!selectedVideoId && !dataLoading && (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-20">
          <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 p-6 mb-4">
            <Microscope className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-xl font-bold">Analizza la tua VSL</h3>
          <p className="mt-2 max-w-lg text-center text-sm text-muted-foreground leading-relaxed">
            Seleziona un video per ottenere una tabella completa con drop-off,
            trascrizione, analisi frame-by-frame (Gemini) e suggerimenti di
            miglioramento (Claude).
          </p>
          <div className="mt-6 flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Table2 className="h-4 w-4 text-primary" />
              <span>Vista Excel</span>
            </div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-amber-500" />
              <span>Gemini AI</span>
            </div>
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <span>Claude AI</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Video Frame Preview Modal ─────────────────────────── */}
      {selectedDrop && (
        <VideoFramePreview
          streamUrl={streamUrl}
          timestamp={selectedDrop.second}
          drop={selectedDrop}
          thumbnailUrl={video?.thumbnail_url}
          onClose={() => setSelectedDrop(null)}
        />
      )}

      {/* ── Script VSL Modal ─────────────────────────────────── */}
      {showScriptModal && transcript && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setShowScriptModal(false)}
        >
          <div
            className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-border bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold">Script VSL</h3>
                <p className="text-sm text-muted-foreground">
                  {video?.name || video?.title}
                  {transcriptSource && (
                    <Badge variant="success" className="ml-2 text-[10px]">
                      {transcriptSource.includes("whisper") ? "Whisper AI" : transcriptSource}
                    </Badge>
                  )}
                </p>
              </div>
              <button
                onClick={() => setShowScriptModal(false)}
                className="rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              <pre className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground font-sans">
                {transcript.text}
              </pre>
            </div>

            <div className="flex items-center justify-between border-t border-border px-6 py-3">
              <span className="text-xs text-muted-foreground">
                {transcript.text.split(/\s+/).length} parole · {transcript.segments.length} segmenti
              </span>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleCopyScript}>
                  {scriptCopied ? (
                    <>
                      <Check className="h-4 w-4" /> Copiato!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Copia
                    </>
                  )}
                </Button>
                <Button size="sm" onClick={handleDownloadScript}>
                  <Download className="h-4 w-4" /> Scarica .txt
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
