"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import {
  formatNumber,
  formatPercent,
  formatDuration,
  getDateRangeDates,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Users,
  Settings,
  Globe,
  Monitor,
  Compass,
  Laptop,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Download,
  Filter,
} from "lucide-react";
import Link from "next/link";
import type {
  VidalyticsVideo,
  ViewerSession,
} from "@/lib/vidalytics-api";
import type { DateRange } from "@/lib/store";

export default function SessionsPage() {
  const { apiToken, dateRange, setDateRange } = useAppStore();
  const { apiFetch } = useApi();
  const [videos, setVideos] = useState<VidalyticsVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ViewerSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const perPage = 25;

  const [filterCountry, setFilterCountry] = useState("");
  const [filterDevice, setFilterDevice] = useState("");
  const [filterBrowser, setFilterBrowser] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    apiFetch<VidalyticsVideo[]>("/videos")
      .then((vids) => {
        setVideos(vids);
        if (vids.length > 0 && !selectedVideoId) {
          setSelectedVideoId(vids[0].id);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  useEffect(() => {
    if (!selectedVideoId) return;
    setLoading(true);
    setPage(1);
    const dates = getDateRangeDates(dateRange);

    const params: Record<string, string> = {
      ...dates,
      page: "1",
      per_page: String(perPage),
    };
    if (filterCountry) params.country = filterCountry;
    if (filterDevice) params.device = filterDevice;
    if (filterBrowser) params.browser = filterBrowser;

    apiFetch<ViewerSession[]>(`/videos/${selectedVideoId}/sessions`, { params })
      .then((data) => {
        setSessions(data);
        setHasMore(data.length === perPage);
      })
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVideoId, dateRange, apiToken, filterCountry, filterDevice, filterBrowser]);

  const loadPage = async (newPage: number) => {
    if (!selectedVideoId) return;
    setLoading(true);
    const dates = getDateRangeDates(dateRange);
    const params: Record<string, string> = {
      ...dates,
      page: String(newPage),
      per_page: String(perPage),
    };
    if (filterCountry) params.country = filterCountry;
    if (filterDevice) params.device = filterDevice;
    if (filterBrowser) params.browser = filterBrowser;

    try {
      const data = await apiFetch<ViewerSession[]>(
        `/videos/${selectedVideoId}/sessions`,
        { params }
      );
      setSessions(data);
      setPage(newPage);
      setHasMore(data.length === perPage);
    } catch {
      // handled
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (sessions.length === 0) return;
    const headers = [
      "Session ID",
      "Viewer ID",
      "Start",
      "End",
      "Watch Time (s)",
      "% Watched",
      "Country",
      "Device",
      "Browser",
      "OS",
      "Referrer",
      "Converted",
      "CTA Click",
      "Play Gate",
    ];
    const rows = sessions.map((s) => [
      s.session_id,
      s.viewer_id || "",
      s.started_at,
      s.ended_at || "",
      String(s.watch_time),
      String(s.percent_watched),
      s.country || "",
      s.device || "",
      s.browser || "",
      s.os || "",
      s.referrer || "",
      s.converted ? "Yes" : "No",
      s.cta_clicked ? "Yes" : "No",
      s.play_gate_submitted ? "Yes" : "No",
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sessions-${selectedVideoId}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const ranges: { label: string; value: DateRange }[] = [
    { label: "7D", value: "7d" },
    { label: "14D", value: "14d" },
    { label: "30D", value: "30d" },
  ];

  const deviceIcon = (device?: string) => {
    switch (device?.toLowerCase()) {
      case "mobile":
      case "phone":
        return <Monitor className="h-3.5 w-3.5" />;
      case "desktop":
        return <Laptop className="h-3.5 w-3.5" />;
      default:
        return <Monitor className="h-3.5 w-3.5" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Viewer Sessions</h1>
          <p className="text-muted-foreground">
            Individual session history per video (max 1,000 per call)
          </p>
        </div>
        <div className="flex items-center gap-3">
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
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExportCSV} disabled={sessions.length === 0}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="animate-fade-in">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={filterCountry}
                onChange={(e) => setFilterCountry(e.target.value)}
                placeholder="Country (e.g. US, GB)"
                className="h-8 w-36 rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              />
            </div>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterDevice}
                onChange={(e) => setFilterDevice(e.target.value)}
                className="h-8 rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">All devices</option>
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Compass className="h-4 w-4 text-muted-foreground" />
              <select
                value={filterBrowser}
                onChange={(e) => setFilterBrowser(e.target.value)}
                className="h-8 rounded-lg border border-border bg-white px-2 text-sm outline-none focus:border-primary"
              >
                <option value="">All browsers</option>
                <option value="chrome">Chrome</option>
                <option value="safari">Safari</option>
                <option value="firefox">Firefox</option>
                <option value="edge">Edge</option>
              </select>
            </div>
            {(filterCountry || filterDevice || filterBrowser) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterCountry("");
                  setFilterDevice("");
                  setFilterBrowser("");
                }}
              >
                <X className="h-3 w-3" />
                Reset
              </Button>
            )}
          </div>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-14 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
      ) : sessions.length > 0 ? (
        <>
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Viewer</th>
                  <th className="pb-3 pr-4 font-medium">Start</th>
                  <th className="pb-3 pr-4 font-medium">Duration</th>
                  <th className="pb-3 pr-4 font-medium">% Watched</th>
                  <th className="pb-3 pr-4 font-medium">Country</th>
                  <th className="pb-3 pr-4 font-medium">Device</th>
                  <th className="pb-3 pr-4 font-medium">Browser</th>
                  <th className="pb-3 pr-4 font-medium">Conv.</th>
                  <th className="pb-3 font-medium">CTA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <tr key={s.session_id} className="transition-colors hover:bg-secondary/50">
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-muted-foreground">
                        {s.viewer_id?.slice(0, 10) || s.session_id.slice(0, 10)}...
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {new Date(s.started_at).toLocaleString("en-US", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="py-3 pr-4 font-medium">{formatDuration(s.watch_time)}</td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-secondary">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${Math.min(s.percent_watched * 100, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {formatPercent(s.percent_watched)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {s.country ? (
                        <Badge variant="info">{s.country}</Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        {deviceIcon(s.device)}
                        {s.device || "-"}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{s.browser || "-"}</td>
                    <td className="py-3 pr-4">
                      {s.converted ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                    <td className="py-3">
                      {s.cta_clicked ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/40" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Page {page} &middot; {sessions.length} sessions
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadPage(page - 1)}
                disabled={page <= 1 || loading}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => loadPage(page + 1)}
                disabled={!hasMore || loading}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <EmptyState
          icon={<Users className="h-8 w-8" />}
          title="No sessions found"
          description="There are no viewer sessions for this video in the selected period."
        />
      )}
    </div>
  );
}
