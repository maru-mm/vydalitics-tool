"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import {
  formatNumber,
  formatPercent,
  formatDuration,
  formatDateShort,
  getDateRangeDates,
} from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AreaChartCard, BarChartCard } from "@/components/charts/analytics-charts";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft,
  Play,
  Eye,
  Clock,
  TrendingUp,
  Volume2,
  MousePointerClick,
  Users,
  Monitor,
  Globe,
  Smartphone,
  BarChart3,
  Sparkles,
  Loader2,
  RefreshCw,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  Video,
} from "lucide-react";
import type {
  VidalyticsVideo,
  VideoStats,
  TimelineStats,
  DropOffStats,
  SegmentedStats,
} from "@/lib/vidalytics-api";

interface DropOffPoint {
  second: number;
  label: string;
  viewers: number;
  retention: number;
}

export default function VideoBreakdownPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;
  const { dateRange } = useAppStore();
  const { apiFetch, isConfigured } = useApi();

  const [video, setVideo] = useState<VidalyticsVideo | null>(null);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineStats[]>([]);
  const [dropOff, setDropOff] = useState<DropOffStats | null>(null);
  const [segments, setSegments] = useState<Record<string, SegmentedStats[]>>({});
  const [loading, setLoading] = useState(true);
  const [activeSegment, setActiveSegment] = useState<"device" | "country" | "browser" | "os">("device");

  // AI analysis
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisExpanded, setAnalysisExpanded] = useState(true);

  useEffect(() => {
    if (!videoId || !isConfigured) return;

    setLoading(true);
    const dates = getDateRangeDates(dateRange);

    Promise.allSettled([
      apiFetch<VidalyticsVideo>(`/videos/${videoId}`),
      apiFetch<VideoStats>(`/videos/${videoId}/stats`),
      apiFetch<TimelineStats[]>(`/videos/${videoId}/timeline`, {
        params: { ...dates, interval: "daily" },
      }),
      apiFetch<DropOffStats>(`/videos/${videoId}/drop-off`),
      apiFetch<SegmentedStats[]>(`/videos/${videoId}/segments`, {
        params: { segment: "device" },
      }),
      apiFetch<SegmentedStats[]>(`/videos/${videoId}/segments`, {
        params: { segment: "country" },
      }),
      apiFetch<SegmentedStats[]>(`/videos/${videoId}/segments`, {
        params: { segment: "browser" },
      }),
    ]).then(([videoRes, statsRes, timelineRes, dropOffRes, deviceRes, countryRes, browserRes]) => {
      if (videoRes.status === "fulfilled") setVideo(videoRes.value);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (timelineRes.status === "fulfilled") setTimeline(timelineRes.value);
      if (dropOffRes.status === "fulfilled") setDropOff(dropOffRes.value);

      const segs: Record<string, SegmentedStats[]> = {};
      if (deviceRes.status === "fulfilled") segs.device = deviceRes.value;
      if (countryRes.status === "fulfilled") segs.country = countryRes.value;
      if (browserRes.status === "fulfilled") segs.browser = browserRes.value;
      setSegments(segs);

      setLoading(false);
    });
  }, [videoId, dateRange, apiFetch, isConfigured]);

  const dropOffData = useMemo<DropOffPoint[]>(() => {
    if (!dropOff?.watches) return [];
    const entries = Object.entries(dropOff.watches)
      .map(([sec, count]) => ({ sec: parseInt(sec), count }))
      .sort((a, b) => a.sec - b.sec);

    if (entries.length === 0) return [];
    const maxViewers = entries[0]?.count || 1;

    return entries.map(({ sec, count }) => {
      const mins = Math.floor(sec / 60);
      const secs = sec % 60;
      return {
        second: sec,
        label: sec < 60 ? `${sec}s` : `${mins}:${secs.toString().padStart(2, "0")}`,
        viewers: count,
        retention: (count / maxViewers) * 100,
      };
    });
  }, [dropOff]);

  // Sample drop-off data every N points for clean chart rendering
  const sampledDropOff = useMemo(() => {
    if (dropOffData.length <= 120) return dropOffData;
    const step = Math.ceil(dropOffData.length / 120);
    const sampled: DropOffPoint[] = [];
    for (let i = 0; i < dropOffData.length; i += step) {
      sampled.push(dropOffData[i]);
    }
    if (sampled[sampled.length - 1] !== dropOffData[dropOffData.length - 1]) {
      sampled.push(dropOffData[dropOffData.length - 1]);
    }
    return sampled;
  }, [dropOffData]);

  // Find critical drop-off points (where retention drops significantly between consecutive points)
  const criticalPoints = useMemo(() => {
    if (dropOffData.length < 2) return [];
    const points: { second: number; label: string; dropPct: number }[] = [];
    const maxViewers = dropOffData[0]?.viewers || 1;

    for (let i = 1; i < dropOffData.length; i++) {
      const prev = dropOffData[i - 1];
      const curr = dropOffData[i];
      const dropPct = ((prev.viewers - curr.viewers) / maxViewers) * 100;
      if (dropPct > 3) {
        points.push({
          second: curr.second,
          label: curr.label,
          dropPct,
        });
      }
    }

    return points.sort((a, b) => b.dropPct - a.dropPct).slice(0, 5);
  }, [dropOffData]);

  // Retention milestones
  const retentionMilestones = useMemo(() => {
    if (dropOffData.length === 0) return [];
    const thresholds = [75, 50, 25, 10];
    const milestones: { threshold: number; second: number; label: string }[] = [];

    for (const t of thresholds) {
      const point = dropOffData.find((d) => d.retention <= t);
      if (point) {
        milestones.push({ threshold: t, second: point.second, label: point.label });
      }
    }
    return milestones;
  }, [dropOffData]);

  const requestAnalysis = useCallback(async () => {
    if (!stats || !video) return;
    setAnalysisLoading(true);
    setAnalysis(null);

    try {
      const res = await fetch("/api/ai/video-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoName: video.name || video.title,
          stats,
          dropOff,
          segments,
        }),
      });

      if (!res.ok) throw new Error("Analysis request failed");
      const data = await res.json();
      setAnalysis(data.analysis);
    } catch {
      setAnalysis("Error during analysis. Verify that ANTHROPIC_API_KEY is configured.");
    } finally {
      setAnalysisLoading(false);
    }
  }, [stats, video, dropOff, segments]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/videos")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="h-7 w-48 animate-pulse-soft rounded bg-secondary" />
            <div className="mt-1 h-4 w-32 animate-pulse-soft rounded bg-secondary" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-28 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
        <div className="h-80 animate-pulse-soft rounded-xl border border-border bg-card" />
      </div>
    );
  }

  if (!video) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => router.push("/videos")}>
          <ArrowLeft className="h-4 w-4" /> Back to Videos
        </Button>
        <Card className="py-12 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">Video not found</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/videos")} className="mt-1">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-4 flex-1">
          <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 overflow-hidden">
            {video.thumbnail_url ? (
              <img src={video.thumbnail_url} alt={video.name} className="h-full w-full object-cover" />
            ) : (
              <Video className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{video.name || video.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={video.status === "active" ? "success" : "default"}>
                {video.status || "active"}
              </Badge>
              <span className="text-sm text-muted-foreground">
                Created: {new Date(video.created_at).toLocaleDateString("en-US")}
              </span>
              {video.duration && (
                <span className="text-sm text-muted-foreground">
                  · Duration: {formatDuration(video.duration)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      {stats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Plays"
            value={formatNumber(stats.plays)}
            change={`${formatNumber(stats.unique_plays)} unique`}
            icon={<Play className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Impressions"
            value={formatNumber(stats.impressions)}
            change={`Play Rate: ${formatPercent(stats.play_rate)}`}
            changeType={stats.play_rate > 0.3 ? "positive" : stats.play_rate > 0.15 ? "neutral" : "negative"}
            icon={<Eye className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Unmute Rate"
            value={stats.unmute_rate ? formatPercent(stats.unmute_rate) : "N/A"}
            change={stats.unmute_rate && stats.unmute_rate > 0.5 ? "Good audio engagement" : stats.unmute_rate ? "Below average" : undefined}
            changeType={stats.unmute_rate && stats.unmute_rate > 0.5 ? "positive" : "negative"}
            icon={<Volume2 className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Avg Watch Time"
            value={formatDuration(stats.avg_watch_time)}
            change={`${formatPercent(stats.avg_percent_watched)} of video`}
            changeType={stats.avg_percent_watched > 0.4 ? "positive" : stats.avg_percent_watched > 0.2 ? "neutral" : "negative"}
            icon={<Clock className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Conversions"
            value={formatNumber(stats.conversions)}
            change={`Rate: ${formatPercent(stats.conversion_rate)}`}
            changeType={stats.conversion_rate > 0.03 ? "positive" : stats.conversion_rate > 0.01 ? "neutral" : "negative"}
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="CTA Clicks"
            value={formatNumber(stats.cta_clicks)}
            change={`Rate: ${formatPercent(stats.cta_click_rate)}`}
            changeType={stats.cta_click_rate > 0.05 ? "positive" : "neutral"}
            icon={<MousePointerClick className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Unique Viewers"
            value={formatNumber(stats.unique_plays)}
            change={`of ${formatNumber(stats.plays)} total plays`}
            icon={<Users className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Avg % Watched"
            value={formatPercent(stats.avg_percent_watched)}
            change={stats.avg_percent_watched > 0.5 ? "Great retention" : "Room for improvement"}
            changeType={stats.avg_percent_watched > 0.5 ? "positive" : "negative"}
            icon={<Target className="h-5 w-5 text-primary" />}
          />
        </div>
      )}

      {/* Drop-Off Curve - Frame by Frame */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              Retention Curve (Frame by Frame)
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Percentage of viewers watching each second of the video
            </p>
          </div>
        </div>

        {sampledDropOff.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={350}>
              <AreaChart
                data={sampledDropOff}
              >
                <defs>
                  <linearGradient id="retentionGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="50%" stopColor="#6366f1" stopOpacity={0.1} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
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
                          Retention: <span className="font-medium text-primary">{d.retention.toFixed(1)}%</span>
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Viewers: <span className="font-medium">{formatNumber(d.viewers)}</span>
                        </p>
                      </div>
                    );
                  }}
                />
                {/* Reference lines at key retention thresholds */}
                <ReferenceLine y={50} stroke="#f97316" strokeDasharray="5 5" strokeOpacity={0.5} />
                <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="5 5" strokeOpacity={0.5} />

                {/* Critical drop points */}
                {criticalPoints.slice(0, 3).map((cp) => (
                  <ReferenceLine
                    key={cp.second}
                    x={cp.label}
                    stroke="#ef4444"
                    strokeDasharray="3 3"
                    strokeOpacity={0.4}
                  />
                ))}

                <Area
                  type="monotone"
                  dataKey="retention"
                  stroke="#6366f1"
                  strokeWidth={2.5}
                  fill="url(#retentionGrad)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#6366f1", stroke: "#fff", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>

            {/* Retention Milestones */}
            {retentionMilestones.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {retentionMilestones.map((m) => (
                  <div
                    key={m.threshold}
                    className="rounded-lg border border-border bg-secondary/30 p-3 text-center"
                  >
                    <p className="text-xs font-medium text-muted-foreground">
                      Below {m.threshold}% retention
                    </p>
                    <p className="mt-1 text-lg font-bold text-foreground">{m.label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Critical Drop Points */}
            {criticalPoints.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-danger" />
                  Critical Drop-Off Points
                </h4>
                <div className="space-y-1.5">
                  {criticalPoints.map((cp) => (
                    <div
                      key={cp.second}
                      className="flex items-center gap-3 rounded-lg bg-danger/5 px-3 py-2 text-sm"
                    >
                      <span className="font-mono font-medium text-danger">{cp.label}</span>
                      <div className="h-1.5 flex-1 rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-danger/60"
                          style={{ width: `${Math.min(cp.dropPct * 10, 100)}%` }}
                        />
                      </div>
                      <span className="text-muted-foreground">
                        -{cp.dropPct.toFixed(1)}% of viewers
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <BarChart3 className="h-8 w-8 mb-2" />
            <p>Drop-off data not available for this video</p>
          </div>
        )}
      </Card>

      {/* Timeline */}
      {timeline.length > 0 && (
        <AreaChartCard
          title="Plays & Conversions Over Time"
          data={timeline.map((t) => ({
            name: formatDateShort(t.date),
            plays: t.plays,
            conversions: t.conversions,
          }))}
          dataKey="plays"
          secondaryKey="conversions"
        />
      )}

      {/* Segmented Stats */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Segmented Analysis
          </h3>
          <div className="flex gap-1">
            {(["device", "country", "browser", "os"] as const).map((seg) => (
              <button
                key={seg}
                onClick={() => {
                  setActiveSegment(seg);
                  if (!segments[seg]) {
                    apiFetch<SegmentedStats[]>(`/videos/${videoId}/segments`, {
                      params: { segment: seg },
                    }).then((data) => {
                      setSegments((prev) => ({ ...prev, [seg]: data }));
                    }).catch(() => {});
                  }
                }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  activeSegment === seg
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-secondary"
                }`}
              >
                {seg === "device" && <Monitor className="h-3.5 w-3.5" />}
                {seg === "country" && <Globe className="h-3.5 w-3.5" />}
                {seg === "browser" && <Globe className="h-3.5 w-3.5" />}
                {seg === "os" && <Smartphone className="h-3.5 w-3.5" />}
                {seg === "device" ? "Device" : seg === "country" ? "Country" : seg === "browser" ? "Browser" : "OS"}
              </button>
            ))}
          </div>
        </div>

        {segments[activeSegment] && segments[activeSegment].length > 0 ? (
          <div className="space-y-2">
            {segments[activeSegment]
              .sort((a, b) => b.plays - a.plays)
              .slice(0, 10)
              .map((seg, i) => {
                const maxPlays = segments[activeSegment][0]?.plays || 1;
                const pct = (seg.plays / maxPlays) * 100;
                return (
                  <div key={i} className="flex items-center gap-3">
                    <span className="w-28 truncate text-sm font-medium">{seg.segment_value}</span>
                    <div className="flex-1">
                      <div className="h-6 rounded-full bg-secondary">
                        <div
                          className="flex h-full items-center rounded-full bg-primary/20 px-2"
                          style={{ width: `${Math.max(pct, 5)}%` }}
                        >
                          <span className="text-xs font-medium text-primary">
                            {formatNumber(seg.plays)} plays
                          </span>
                        </div>
                      </div>
                    </div>
                    <span className="w-20 text-right text-sm text-muted-foreground">
                      {formatNumber(seg.conversions)} conv.
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No segmented data available
          </p>
        )}
      </Card>

      {/* AI Analysis */}
      <Card className="border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">AI Video Analysis</h3>
              <p className="text-sm text-muted-foreground">
                Claude analyzes your video performance frame by frame
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {analysis && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAnalysisExpanded(!analysisExpanded)}
              >
                {analysisExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            )}
            <Button
              variant={analysis ? "ghost" : "primary"}
              size="sm"
              onClick={requestAnalysis}
              disabled={analysisLoading || !stats}
            >
              {analysisLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : analysis ? (
                <>
                  <RefreshCw className="h-4 w-4" />
                  Regenerate
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Analyze with AI
                </>
              )}
            </Button>
          </div>
        </div>

        {analysisLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-4 border-primary/20" />
              <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-primary" />
            </div>
            <p className="mt-4 text-sm font-medium text-muted-foreground">
              Claude is analyzing your video...
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Analyzing retention curve, metrics, and segments
            </p>
          </div>
        )}

        {analysis && analysisExpanded && !analysisLoading && (
          <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-p:text-muted-foreground prose-strong:text-foreground prose-li:text-muted-foreground">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{analysis}</ReactMarkdown>
          </div>
        )}

        {!analysis && !analysisLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Sparkles className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Click &quot;Analyze with AI&quot; to get a detailed analysis of your
              video performance, including hook, retention, and improvement suggestions.
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}
