"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import {
  formatNumber,
  formatPercent,
  formatDuration,
  getDateRangeDates,
  formatDateShort,
} from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaChartCard, BarChartCard } from "@/components/charts/analytics-charts";
import {
  BarChart3,
  Settings,
  Globe,
  Monitor,
  Compass,
  Laptop,
  Play,
  Eye,
  Clock,
  TrendingUp,
  MousePointer,
  Loader2,
  Filter,
  X,
  Download,
  FolderOpen,
} from "lucide-react";
import Link from "next/link";
import type {
  VidalyticsVideo,
  VideoStats,
  TimelineStats,
  SegmentedStats,
  Folder,
} from "@/lib/vidalytics-api";
import type { DateRange } from "@/lib/store";

type SegmentType = "country" | "device" | "browser" | "os";

const segmentIcons: Record<SegmentType, React.ReactNode> = {
  country: <Globe className="h-4 w-4" />,
  device: <Monitor className="h-4 w-4" />,
  browser: <Compass className="h-4 w-4" />,
  os: <Laptop className="h-4 w-4" />,
};

const segmentLabels: Record<SegmentType, string> = {
  country: "Country",
  device: "Device",
  browser: "Browser",
  os: "OS",
};

export default function AnalyticsPage() {
  const { apiToken, dateRange, setDateRange, isAdmin } = useAppStore();
  const { apiFetch } = useApi();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [videos, setVideos] = useState<VidalyticsVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [stats, setStats] = useState<VideoStats | null>(null);
  const [timeline, setTimeline] = useState<TimelineStats[]>([]);
  const [segments, setSegments] = useState<SegmentedStats[]>([]);
  const [segmentType, setSegmentType] = useState<SegmentType>("country");
  const [loading, setLoading] = useState(false);
  const [loadingSegments, setLoadingSegments] = useState(false);

  // Advanced filters (Enterprise)
  const [showFilters, setShowFilters] = useState(false);
  const [filterCountry, setFilterCountry] = useState("");
  const [filterDevice, setFilterDevice] = useState("");
  const [filterBrowser, setFilterBrowser] = useState("");
  const [filterOs, setFilterOs] = useState("");
  const [filterReferrer, setFilterReferrer] = useState("");
  const [filterUrlParam, setFilterUrlParam] = useState("");
  const [filterUrlParamValue, setFilterUrlParamValue] = useState("");

  const activeFilterCount = [
    filterCountry,
    filterDevice,
    filterBrowser,
    filterOs,
    filterReferrer,
    filterUrlParam,
  ].filter(Boolean).length;

  const buildFilterParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (filterCountry) params.country = filterCountry;
    if (filterDevice) params.device = filterDevice;
    if (filterBrowser) params.browser = filterBrowser;
    if (filterOs) params.os = filterOs;
    if (filterReferrer) params.referrer = filterReferrer;
    if (filterUrlParam) params.url_param = filterUrlParam;
    if (filterUrlParamValue) params.url_param_value = filterUrlParamValue;
    return params;
  };

  const clearFilters = () => {
    setFilterCountry("");
    setFilterDevice("");
    setFilterBrowser("");
    setFilterOs("");
    setFilterReferrer("");
    setFilterUrlParam("");
    setFilterUrlParamValue("");
  };

  useEffect(() => {
    Promise.all([
      apiFetch<Folder[]>("/folders"),
      fetch("/api/admin/vsl-config").then((r) => r.json()).catch(() => ({ allowedFolderIds: [] })),
    ])
      .then(([allFolders, config]) => {
        const allowed: string[] = config.allowedFolderIds || [];
        const visibleFolders = isAdmin
          ? allFolders
          : allFolders.filter((f: Folder) => allowed.includes(f.id));
        setFolders(visibleFolders);
        if (visibleFolders.length > 0 && !selectedFolderId) {
          setSelectedFolderId(visibleFolders[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken, isAdmin]);

  useEffect(() => {
    if (!selectedFolderId) return;
    apiFetch<VidalyticsVideo[]>(`/videos?folder_id=${selectedFolderId}`)
      .then((vids) => {
        setVideos(vids);
        if (vids.length > 0 && !selectedVideoId) {
          setSelectedVideoId(vids[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFolderId, apiToken]);

  useEffect(() => {
    if (!selectedVideoId) return;
    setLoading(true);
    const dates = getDateRangeDates(dateRange);
    const filterParams = buildFilterParams();

    Promise.all([
      apiFetch<VideoStats>(`/videos/${selectedVideoId}/stats`, {
        params: { ...filterParams },
      }),
      apiFetch<TimelineStats[]>(`/videos/${selectedVideoId}/timeline`, {
        params: { ...dates, interval: "daily", ...filterParams },
      }),
    ])
      .then(([s, t]) => {
        setStats(s);
        setTimeline(t);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, dateRange, apiToken, filterCountry, filterDevice, filterBrowser, filterOs, filterReferrer, filterUrlParam, filterUrlParamValue]);

  useEffect(() => {
    if (!selectedVideoId) return;
    setLoadingSegments(true);
    const dates = getDateRangeDates(dateRange);
    apiFetch<SegmentedStats[]>(`/videos/${selectedVideoId}/segments`, {
      params: { segment: segmentType, ...dates },
    })
      .then(setSegments)
      .catch(() => setSegments([]))
      .finally(() => setLoadingSegments(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, segmentType, dateRange, apiToken]);

  const handleExportStats = () => {
    if (!stats || !selectedVideoId) return;
    const videoName = videos.find((v) => v.id === selectedVideoId)?.name || selectedVideoId;
    const data = {
      video: videoName,
      video_id: selectedVideoId,
      date_range: dateRange,
      filters: buildFilterParams(),
      stats,
      timeline,
      segments,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${selectedVideoId}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCSV = () => {
    if (timeline.length === 0) return;
    const headers = ["Date", "Plays", "Unique Plays", "Impressions", "Conversions", "Avg Watch Time", "% Watched", "CTA Clicks"];
    const rows = timeline.map((t) => [
      t.date,
      String(t.plays),
      String(t.unique_plays),
      String(t.impressions),
      String(t.conversions),
      String(t.avg_watch_time),
      String(t.avg_percent_watched || ""),
      String(t.cta_clicks || ""),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timeline-${selectedVideoId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ranges: { label: string; value: DateRange }[] = [
    { label: "7D", value: "7d" },
    { label: "14D", value: "14d" },
    { label: "30D", value: "30d" },
  ];

  const chartTimeline = timeline.map((t) => ({
    name: formatDateShort(t.date),
    plays: t.plays,
    impressions: t.impressions,
    conversions: t.conversions,
  }));

  const segmentChartData = segments.map((s) => ({
    name: s.segment_value || "Unknown",
    plays: s.plays,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">
            Detailed performance analysis per video
          </p>
        </div>
        <div className="flex items-center gap-3">
          {folders.length > 1 && (
            <div className="flex items-center gap-1.5">
              <FolderOpen className="h-4 w-4 text-muted-foreground" />
              <select
                value={selectedFolderId || ""}
                onChange={(e) => {
                  setSelectedFolderId(e.target.value);
                  setSelectedVideoId(null);
                  setStats(null);
                  setTimeline([]);
                  setSegments([]);
                }}
                className="h-10 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} ({f.videoCount ?? f.video_count ?? 0})
                  </option>
                ))}
              </select>
            </div>
          )}
          <select
            value={selectedVideoId || ""}
            onChange={(e) => setSelectedVideoId(e.target.value)}
            className="h-10 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          >
            {videos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <div className="flex rounded-lg border border-border bg-white">
            {ranges.map((r) => (
              <button
                key={r.value}
                onClick={() => setDateRange(r.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  dateRange === r.value
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:text-foreground"
                } first:rounded-l-lg last:rounded-r-lg`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button
            variant={showFilters ? "primary" : "ghost"}
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="h-4 w-4" />
            {activeFilterCount > 0 && (
              <span className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] text-white">
                {activeFilterCount}
              </span>
            )}
          </Button>
            <Button variant="ghost" size="sm" onClick={handleExportCSV} disabled={timeline.length === 0} title="Export CSV">
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <Card className="animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Advanced Filters</h3>
              <Badge variant="info">Enterprise</Badge>
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-3 w-3" />
                Reset Filters
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Globe className="h-3 w-3" /> Country
              </label>
              <input
                type="text"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                placeholder="e.g. US, GB, DE"
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Monitor className="h-3 w-3" /> Device
              </label>
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">All</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Compass className="h-3 w-3" /> Browser
              </label>
              <select
                value={filterBrowser}
                onChange={(e) => setFilterBrowser(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">All</option>
                <option value="chrome">Chrome</option>
                <option value="safari">Safari</option>
                <option value="firefox">Firefox</option>
                <option value="edge">Edge</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Laptop className="h-3 w-3" /> Operating System
              </label>
              <select
                value={filterOs}
                onChange={(e) => setFilterOs(e.target.value)}
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">All</option>
                <option value="windows">Windows</option>
                <option value="macos">macOS</option>
                <option value="ios">iOS</option>
                <option value="android">Android</option>
                <option value="linux">Linux</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Referrer</label>
              <input
                type="text"
                value={filterReferrer}
                onChange={(e) => setFilterReferrer(e.target.value)}
                placeholder="e.g. google.com"
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">URL Param</label>
              <input
                type="text"
                value={filterUrlParam}
                onChange={(e) => setFilterUrlParam(e.target.value)}
                placeholder="e.g. utm_source"
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">URL Param Value</label>
              <input
                type="text"
                value={filterUrlParamValue}
                onChange={(e) => setFilterUrlParamValue(e.target.value)}
                placeholder="e.g. facebook"
                className="h-8 w-full rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-32 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            label="Play"
            value={formatNumber(stats.plays)}
            icon={<Play className="h-5 w-5 text-primary" />}
          />
          <StatCard
          label="Impressions"
          value={formatNumber(stats.impressions)}
          icon={<Eye className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Avg Watch Time"
            value={formatDuration(stats.avg_watch_time)}
            icon={<Clock className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="Conv. Rate"
            value={formatPercent(stats.conversion_rate)}
            icon={<TrendingUp className="h-5 w-5 text-primary" />}
          />
          <StatCard
            label="CTA Clicks"
            value={formatNumber(stats.cta_clicks)}
            icon={<MousePointer className="h-5 w-5 text-primary" />}
          />
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <AreaChartCard
          title="Plays & Conversions Timeline"
          data={chartTimeline.length > 0 ? chartTimeline : [{ name: "-", plays: 0, conversions: 0, impressions: 0 }]}
          dataKey="plays"
          secondaryKey="conversions"
        />
        <AreaChartCard
          title="Impressions Over Time"
          data={chartTimeline.length > 0 ? chartTimeline : [{ name: "-", plays: 0, conversions: 0, impressions: 0 }]}
          dataKey="impressions"
          color="#f97316"
        />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2.5">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Segmented Report</h2>
              <p className="text-sm text-muted-foreground">
                Analysis by {segmentLabels[segmentType].toLowerCase()}
                {" "}(Enterprise)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {(Object.keys(segmentLabels) as SegmentType[]).map((st) => (
                <button
                  key={st}
                  onClick={() => setSegmentType(st)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    segmentType === st
                      ? "bg-primary text-white"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                >
                  {segmentIcons[st]}
                  {segmentLabels[st]}
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" onClick={handleExportStats} disabled={!stats} title="Export JSON">
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {loadingSegments ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : segments.length > 0 ? (
          <div className="space-y-3">
            {segments.slice(0, 10).map((seg, i) => {
              const maxPlays = Math.max(...segments.map((s) => s.plays), 1);
              return (
                <div key={i} className="flex items-center gap-4">
                  <span className="w-28 truncate text-sm font-medium">
                    {seg.segment_value || "N/A"}
                  </span>
                  <div className="flex-1">
                    <div className="h-6 w-full rounded-full bg-secondary">
                      <div
                        className="flex h-6 items-center rounded-full bg-primary/20 px-2 text-xs font-medium text-primary transition-all"
                        style={{ width: `${Math.max((seg.plays / maxPlays) * 100, 5)}%` }}
                      >
                        {formatNumber(seg.plays)} play
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="info">{formatPercent(seg.avg_percent_watched)} watched</Badge>
                    <Badge variant="success">{seg.conversions} conv.</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No segmented data available. This feature requires the Enterprise plan.
          </div>
        )}
      </Card>
    </div>
  );
}
