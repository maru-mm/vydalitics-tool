"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Radio,
  Settings,
  Users,
  Activity,
  Pause,
  Play,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import type { VidalyticsVideo, RealTimeMetrics } from "@/lib/vidalytics-api";

export default function RealTimePage() {
  const apiToken = useAppStore((s) => s.apiToken);
  const { apiFetch } = useApi();
  const [videos, setVideos] = useState<VidalyticsVideo[]>([]);
  const [metrics, setMetrics] = useState<RealTimeMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [history, setHistory] = useState<{ time: string; total: number }[]>([]);

  const fetchMetrics = useCallback(async () => {
    if (videos.length === 0) return;
    try {
      const ids = videos.slice(0, 50).map((v) => v.id);
      const data = await apiFetch<RealTimeMetrics[]>("/realtime", {
        method: "POST",
        body: JSON.stringify({ video_ids: ids }),
      });
      setMetrics(data);
      setLastUpdate(new Date());

      const total = data.reduce((a, m) => a + (m.concurrent_viewers || 0), 0);
      setHistory((prev) => {
        const next = [
          ...prev,
          {
            time: new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }),
            total,
          },
        ];
        return next.slice(-30);
      });
    } catch {
      // silently fail for polling
    }
  }, [videos, apiFetch]);

  useEffect(() => {
    setLoading(true);
    apiFetch<VidalyticsVideo[]>("/videos")
      .then(setVideos)
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  useEffect(() => {
    if (videos.length === 0 || paused) return;
    fetchMetrics();

    intervalRef.current = setInterval(fetchMetrics, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [videos, paused, fetchMetrics]);

  const totalViewers = metrics.reduce((a, m) => a + (m.concurrent_viewers || 0), 0);

  const sortedMetrics = [...metrics]
    .filter((m) => m.concurrent_viewers > 0)
    .sort((a, b) => b.concurrent_viewers - a.concurrent_viewers);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Real-Time</h1>
          <p className="text-muted-foreground">
            Spettatori attivi in questo momento (Enterprise)
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-sm text-muted-foreground">
              Ultimo aggiornamento: {lastUpdate.toLocaleTimeString("it-IT")}
            </span>
          )}
          <Button
            variant={paused ? "primary" : "secondary"}
            size="sm"
            onClick={() => setPaused(!paused)}
          >
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            {paused ? "Riprendi" : "Pausa"}
          </Button>
          <Button variant="ghost" size="sm" onClick={fetchMetrics}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Spettatori Attivi</p>
              <p className="mt-2 text-4xl font-bold tracking-tight text-primary">
                {formatNumber(totalViewers)}
              </p>
            </div>
            <div className="rounded-lg bg-primary/10 p-2.5">
              <Users className="h-5 w-5 text-primary" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success" />
            </span>
            <span className="text-sm text-muted-foreground">Live</span>
          </div>
        </Card>

        <Card className="animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Video Attivi</p>
              <p className="mt-2 text-4xl font-bold tracking-tight">
                {sortedMetrics.length}
              </p>
            </div>
            <div className="rounded-lg bg-accent/10 p-2.5">
              <Activity className="h-5 w-5 text-accent" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            su {videos.length} totali
          </p>
        </Card>

        <Card className="animate-fade-in">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Aggiornamento</p>
              <p className="mt-2 text-4xl font-bold tracking-tight">~1m</p>
            </div>
            <div className="rounded-lg bg-success/10 p-2.5">
              <Radio className="h-5 w-5 text-success" />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Polling ogni 60 secondi
          </p>
        </Card>
      </div>

      {history.length > 1 && (
        <Card>
          <h3 className="mb-4 text-sm font-semibold">Storico Spettatori (sessione)</h3>
          <div className="flex h-32 items-end gap-1">
            {history.map((h, i) => {
              const max = Math.max(...history.map((x) => x.total), 1);
              const height = Math.max((h.total / max) * 100, 4);
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t bg-primary/60 transition-all hover:bg-primary"
                    style={{ height: `${height}%` }}
                    title={`${h.time}: ${h.total} spettatori`}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
            <span>{history[0]?.time}</span>
            <span>{history[history.length - 1]?.time}</span>
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : sortedMetrics.length > 0 ? (
        <Card>
          <h3 className="mb-4 font-semibold">Video con Spettatori Attivi</h3>
          <div className="space-y-3">
            {sortedMetrics.map((m) => {
              const video = videos.find((v) => v.id === m.video_id);
              const maxViewers = Math.max(...sortedMetrics.map((x) => x.concurrent_viewers), 1);
              return (
                <div key={m.video_id} className="flex items-center gap-4">
                  <div className="w-48 truncate text-sm font-medium">
                    {video?.name || m.video_id.slice(0, 12)}
                  </div>
                  <div className="flex-1">
                    <div className="h-6 w-full rounded-full bg-secondary">
                      <div
                        className="flex h-6 items-center rounded-full bg-primary/20 px-3 text-xs font-semibold text-primary transition-all"
                        style={{
                          width: `${Math.max((m.concurrent_viewers / maxViewers) * 100, 8)}%`,
                        }}
                      >
                        {m.concurrent_viewers}
                      </div>
                    </div>
                  </div>
                  <Badge variant="success">
                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-success" />
                    Live
                  </Badge>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={<Radio className="h-8 w-8" />}
          title="Nessuno spettatore attivo"
          description="In questo momento non ci sono spettatori che guardano i tuoi video. I dati si aggiornano ogni ~60 secondi."
        />
      )}
    </div>
  );
}
