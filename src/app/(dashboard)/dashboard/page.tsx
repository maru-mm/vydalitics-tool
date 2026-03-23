"use client";

import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import {
  formatNumber,
  formatPercent,
  formatDuration,
  getDateRangeDates,
  formatDateShort,
} from "@/lib/utils";
import { StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { AreaChartCard, BarChartCard } from "@/components/charts/analytics-charts";
import {
  Play,
  Eye,
  Clock,
  TrendingUp,
  MousePointer,
  Settings,
  Video,
  RefreshCw,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type {
  VidalyticsVideo,
  VideoStats,
  TimelineStats,
} from "@/lib/vidalytics-api";
import type { DateRange } from "@/lib/store";

export default function DashboardPage() {
  const { apiToken, dateRange, setDateRange } = useAppStore();
  const { apiFetch } = useApi();
  const [videos, setVideos] = useState<VidalyticsVideo[]>([]);
  const [stats, setStats] = useState<VideoStats[]>([]);
  const [timeline, setTimeline] = useState<TimelineStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    setError(null);

    try {
      const vids = await apiFetch<VidalyticsVideo[]>("/videos");
      setVideos(vids);
      setLoading(false);

      if (vids.length > 0) {
        const topIds = vids.slice(0, 10).map((v) => v.id);

        apiFetch<VideoStats[]>("/bulk-stats", {
          method: "POST",
          body: JSON.stringify({ video_ids: topIds }),
        })
          .then(setStats)
          .catch(() => {});

        apiFetch<TimelineStats[]>(`/videos/${vids[0].id}/timeline`, {
          params: {
            ...getDateRangeDates(dateRange),
            interval: "daily",
          },
        })
          .then(setTimeline)
          .catch(() => {});
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore di connessione");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken, dateRange]);

  const chartTimeline = useMemo(
    () =>
      timeline.map((t) => ({
        name: formatDateShort(t.date),
        plays: t.plays,
        conversions: t.conversions,
      })),
    [timeline]
  );

  const topVideos = useMemo(() => {
    return stats
      .map((s) => ({
        name: videos.find((v) => v.id === s.video_id)?.name || s.video_id.slice(0, 12),
        plays: s.plays,
      }))
      .sort((a, b) => b.plays - a.plays)
      .slice(0, 8);
  }, [stats, videos]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Panoramica delle tue performance video</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse-soft rounded-xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-80 animate-pulse-soft rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Panoramica delle tue performance video</p>
        </div>
        <EmptyState
          icon={<RefreshCw className="h-8 w-8" />}
          title="Errore di caricamento"
          description={`Non è stato possibile caricare i dati: ${error}`}
          action={
            <Button onClick={() => fetchData()}>
              <RefreshCw className="h-4 w-4" />
              Riprova
            </Button>
          }
        />
      </div>
    );
  }

  const totalPlays = stats.reduce((a, s) => a + (s.plays || 0), 0);
  const totalImpressions = stats.reduce((a, s) => a + (s.impressions || 0), 0);
  const avgWatchTime =
    stats.length > 0
      ? stats.reduce((a, s) => a + (s.avg_watch_time || 0), 0) / stats.length
      : 0;
  const avgConvRate =
    stats.length > 0
      ? stats.reduce((a, s) => a + (s.conversion_rate || 0), 0) / stats.length
      : 0;
  const totalCTAClicks = stats.reduce((a, s) => a + (s.cta_clicks || 0), 0);

  const hasData = videos.length > 0;
  const ranges: { label: string; value: DateRange }[] = [
    { label: "7G", value: "7d" },
    { label: "14G", value: "14d" },
    { label: "30G", value: "30d" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            {hasData
              ? `${videos.length} video monitorati`
              : "Panoramica delle tue performance video"}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
            variant="ghost"
            size="sm"
            onClick={() => fetchData(false)}
            disabled={refreshing}
          >
            {refreshing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Play Totali"
          value={formatNumber(totalPlays)}
          icon={<Play className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Impressioni"
          value={formatNumber(totalImpressions)}
          icon={<Eye className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Tempo Medio"
          value={formatDuration(avgWatchTime)}
          icon={<Clock className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="Conv. Rate"
          value={formatPercent(avgConvRate)}
          icon={<TrendingUp className="h-5 w-5 text-primary" />}
        />
        <StatCard
          label="CTA Clicks"
          value={formatNumber(totalCTAClicks)}
          icon={<MousePointer className="h-5 w-5 text-primary" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AreaChartCard
          title="Play & Conversioni"
          data={chartTimeline.length > 0 ? chartTimeline : [{ name: "-", plays: 0, conversions: 0 }]}
          dataKey="plays"
          secondaryKey="conversions"
        />
        <BarChartCard
          title="Top Video per Play"
          data={topVideos.length > 0 ? topVideos : [{ name: "-", plays: 0 }]}
          dataKey="plays"
        />
      </div>

      {!hasData && (
        <EmptyState
          icon={<Video className="h-8 w-8" />}
          title="Nessun video trovato"
          description="Non abbiamo trovato video nel tuo account. Carica un video su Vidalytics per iniziare."
        />
      )}
    </div>
  );
}
