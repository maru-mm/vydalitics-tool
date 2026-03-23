"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { formatNumber, formatPercent, formatDuration } from "@/lib/utils";
import { Card, StatCard } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  GitBranch,
  Settings,
  Video,
  Play,
  Eye,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import type {
  Funnel,
  VidalyticsVideo,
  VideoStats,
} from "@/lib/vidalytics-api";

interface FunnelWithDetails extends Funnel {
  videos?: VidalyticsVideo[];
  stats?: VideoStats[];
}

export default function FunnelsPage() {
  const apiToken = useAppStore((s) => s.apiToken);
  const { apiFetch } = useApi();
  const [funnels, setFunnels] = useState<FunnelWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedFunnel, setExpandedFunnel] = useState<string | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<Funnel[]>("/funnels")
      .then(setFunnels)
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  const handleExpand = async (funnelId: string) => {
    if (expandedFunnel === funnelId) {
      setExpandedFunnel(null);
      return;
    }
    setExpandedFunnel(funnelId);

    const funnel = funnels.find((f) => f.id === funnelId);
    if (!funnel || funnel.videos) return;

    setLoadingDetails(true);
    try {
      const [videosData, statsData] = await Promise.all([
        Promise.all(
          funnel.video_ids.slice(0, 20).map((vid) =>
            apiFetch<VidalyticsVideo>(`/videos/${vid}`).catch(() => null)
          )
        ),
        funnel.video_ids.length > 0
          ? apiFetch<VideoStats[]>("/bulk-stats", {
              method: "POST",
              body: JSON.stringify({ video_ids: funnel.video_ids.slice(0, 50) }),
            }).catch(() => [] as VideoStats[])
          : Promise.resolve([] as VideoStats[]),
      ]);

      setFunnels((prev) =>
        prev.map((f) =>
          f.id === funnelId
            ? {
                ...f,
                videos: videosData.filter(Boolean) as VidalyticsVideo[],
                stats: statsData,
              }
            : f
        )
      );
    } catch {
      // handled
    } finally {
      setLoadingDetails(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Funnel</h1>
          <p className="text-muted-foreground">I tuoi funnel video</p>
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Funnel</h1>
        <p className="text-muted-foreground">
          {funnels.length} funnel nel tuo account
        </p>
      </div>

      {funnels.length === 0 ? (
        <EmptyState
          icon={<GitBranch className="h-8 w-8" />}
          title="Nessun funnel"
          description="Non ci sono funnel configurati nel tuo account Vidalytics."
        />
      ) : (
        <div className="space-y-3">
          {funnels.map((funnel) => {
            const isExpanded = expandedFunnel === funnel.id;
            const totalPlays = funnel.stats?.reduce((a, s) => a + (s.plays || 0), 0) || 0;
            const totalConversions = funnel.stats?.reduce((a, s) => a + (s.conversions || 0), 0) || 0;
            const avgConvRate =
              funnel.stats && funnel.stats.length > 0
                ? funnel.stats.reduce((a, s) => a + (s.conversion_rate || 0), 0) / funnel.stats.length
                : 0;

            return (
              <div key={funnel.id}>
                <Card className="animate-fade-in cursor-pointer" onClick={() => handleExpand(funnel.id)}>
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                      <GitBranch className="h-5 w-5 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{funnel.name}</h3>
                        <Badge variant="info">{funnel.video_ids.length} video</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Creato: {new Date(funnel.created_at).toLocaleDateString("it-IT")}
                        {funnel.updated_at !== funnel.created_at &&
                          ` · Aggiornato: ${new Date(funnel.updated_at).toLocaleDateString("it-IT")}`}
                      </p>
                    </div>
                    {funnel.stats && (
                      <div className="hidden items-center gap-6 lg:flex">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Play Totali</p>
                          <p className="font-semibold">{formatNumber(totalPlays)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Conversioni</p>
                          <p className="font-semibold">{formatNumber(totalConversions)}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground">Conv. Rate</p>
                          <p className="font-semibold">{formatPercent(avgConvRate)}</p>
                        </div>
                      </div>
                    )}
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronUp className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </Card>

                {isExpanded && (
                  <div className="mt-2 ml-6 space-y-2 animate-fade-in">
                    {loadingDetails ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : funnel.videos && funnel.videos.length > 0 ? (
                      funnel.videos.map((video, idx) => {
                        const videoStats = funnel.stats?.find((s) => s.video_id === video.id);
                        return (
                          <Card key={video.id} className="p-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                                {idx + 1}
                              </div>
                              <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-secondary">
                                {video.thumbnail_url ? (
                                  <img
                                    src={video.thumbnail_url}
                                    alt={video.name}
                                    className="h-full w-full rounded object-cover"
                                  />
                                ) : (
                                  <Video className="h-4 w-4 text-muted-foreground" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <h4 className="truncate text-sm font-medium">{video.name}</h4>
                                {video.duration && (
                                  <p className="text-xs text-muted-foreground">
                                    {formatDuration(video.duration)}
                                  </p>
                                )}
                              </div>
                              {videoStats && (
                                <div className="hidden items-center gap-4 text-sm sm:flex">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Play className="h-3 w-3" />
                                    {formatNumber(videoStats.plays)}
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Eye className="h-3 w-3" />
                                    {formatNumber(videoStats.impressions)}
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {formatDuration(videoStats.avg_watch_time)}
                                  </div>
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <TrendingUp className="h-3 w-3" />
                                    {formatPercent(videoStats.conversion_rate)}
                                  </div>
                                </div>
                              )}
                            </div>
                          </Card>
                        );
                      })
                    ) : (
                      <Card className="py-6 text-center text-sm text-muted-foreground">
                        Nessun video trovato in questo funnel.
                      </Card>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
