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
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { AreaChartCard } from "@/components/charts/analytics-charts";
import {
  Video,
  Play,
  Eye,
  Clock,
  TrendingUp,
  Code,
  Settings,
  ExternalLink,
  Copy,
  Check,
  FolderOpen,
  X,
  ChevronDown,
  ChevronUp,
  Pencil,
  Trash2,
  Tag,
  FolderInput,
  Loader2,
  Download,
  FileText,
  BarChart3,
} from "lucide-react";
import Link from "next/link";
import type {
  VidalyticsVideo,
  VideoStats,
  TimelineStats,
  Folder,
} from "@/lib/vidalytics-api";

interface VideoWithStats extends VidalyticsVideo {
  stats?: VideoStats;
}

export default function VideosPage() {
  const { apiToken, selectedFolderId, setSelectedFolderId, dateRange } = useAppStore();
  const { apiFetch } = useApi();
  const [videos, setVideos] = useState<VideoWithStats[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(false);

  // Embed state
  const [embedVideoId, setEmbedVideoId] = useState<string | null>(null);
  const [embedCode, setEmbedCode] = useState<string | null>(null);
  const [embedAutoplay, setEmbedAutoplay] = useState(false);
  const [embedMuted, setEmbedMuted] = useState(false);
  const [embedResponsive, setEmbedResponsive] = useState(true);
  const [copied, setCopied] = useState(false);
  const [loadingEmbed, setLoadingEmbed] = useState(false);

  // Timeline state
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);
  const [videoTimeline, setVideoTimeline] = useState<TimelineStats[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Edit state
  const [editingVideoId, setEditingVideoId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFolderId, setEditFolderId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Tag state
  const [tagVideoId, setTagVideoId] = useState<string | null>(null);
  const [newTag, setNewTag] = useState("");
  const [savingTag, setSavingTag] = useState(false);

  // Delete state
  const [deleteVideoId, setDeleteVideoId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Script state
  const [scriptVideoId, setScriptVideoId] = useState<string | null>(null);
  const [scriptText, setScriptText] = useState<string | null>(null);
  const [scriptLoading, setScriptLoading] = useState(false);
  const [scriptError, setScriptError] = useState<string | null>(null);
  const [scriptCopied, setScriptCopied] = useState(false);

  useEffect(() => {
    apiFetch<Folder[]>("/folders").then(setFolders).catch(() => {});
  }, [apiToken, apiFetch]);

  useEffect(() => {
    setLoading(true);
    const params: Record<string, string> = {};
    if (selectedFolderId) params.folder_id = selectedFolderId;

    apiFetch<VidalyticsVideo[]>("/videos", { params })
      .then((vids) => {
        setVideos(vids);
        setLoading(false);

        if (vids.length > 0) {
          const ids = vids.slice(0, 15).map((v) => v.id);
          apiFetch<VideoStats[]>("/bulk-stats", {
            method: "POST",
            body: JSON.stringify({ video_ids: ids }),
          })
            .then((bulkStats) => {
              const merged = vids.map((v) => ({
                ...v,
                stats: bulkStats.find((s) => s.video_id === v.id),
              }));
              setVideos(merged);
            })
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [apiToken, apiFetch, selectedFolderId]);

  // Embed code with options
  const handleGetEmbed = async (videoId: string) => {
    setEmbedVideoId(videoId);
    setLoadingEmbed(true);
    const params: Record<string, string> = {};
    if (embedAutoplay) params.autoplay = "true";
    if (embedMuted) params.muted = "true";
    if (embedResponsive) params.responsive = "true";
    try {
      const data = await apiFetch<{ html: string }>(`/videos/${videoId}/embed`, { params });
      setEmbedCode(data.html);
    } catch {
      setEmbedCode("Errore nel recupero del codice embed");
    } finally {
      setLoadingEmbed(false);
    }
  };

  const refreshEmbed = () => {
    if (embedVideoId) handleGetEmbed(embedVideoId);
  };

  const handleCopy = () => {
    if (embedCode) {
      navigator.clipboard.writeText(embedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExpand = async (videoId: string) => {
    if (expandedVideo === videoId) {
      setExpandedVideo(null);
      return;
    }
    setExpandedVideo(videoId);
    setTimelineLoading(true);
    const dates = getDateRangeDates(dateRange);
    try {
      const data = await apiFetch<TimelineStats[]>(`/videos/${videoId}/timeline`, {
        params: { ...dates, interval: "daily" },
      });
      setVideoTimeline(data);
    } catch {
      setVideoTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  };

  // Rename / Move folder
  const handleStartEdit = (video: VideoWithStats) => {
    setEditingVideoId(video.id);
    setEditName(video.name);
    setEditFolderId(video.folder_id || "");
  };

  const handleSaveEdit = async () => {
    if (!editingVideoId) return;
    setSavingEdit(true);
    try {
      const updates: Record<string, string | undefined> = {};
      const current = videos.find((v) => v.id === editingVideoId);
      if (current && editName !== current.name) updates.name = editName;
      if (current && editFolderId !== (current.folder_id || ""))
        updates.folder_id = editFolderId || undefined;

      if (Object.keys(updates).length > 0) {
        const updated = await apiFetch<VidalyticsVideo>(`/videos/${editingVideoId}`, {
          method: "PATCH",
          body: JSON.stringify(updates),
        });
        setVideos((prev) =>
          prev.map((v) => (v.id === editingVideoId ? { ...v, ...updated } : v))
        );
      }
    } catch {
      // handled
    } finally {
      setSavingEdit(false);
      setEditingVideoId(null);
    }
  };

  // Tags
  const handleAddTag = async () => {
    if (!tagVideoId || !newTag.trim()) return;
    setSavingTag(true);
    try {
      const updated = await apiFetch<VidalyticsVideo>(`/videos/${tagVideoId}/tags`, {
        method: "POST",
        body: JSON.stringify({ tag: newTag.trim() }),
      });
      setVideos((prev) =>
        prev.map((v) => (v.id === tagVideoId ? { ...v, tags: updated.tags } : v))
      );
      setNewTag("");
    } catch {
      // handled
    } finally {
      setSavingTag(false);
    }
  };

  const handleRemoveTag = async (videoId: string, tag: string) => {
    try {
      const updated = await apiFetch<VidalyticsVideo>(`/videos/${videoId}/tags`, {
        method: "DELETE",
        body: JSON.stringify({ tag }),
      });
      setVideos((prev) =>
        prev.map((v) => (v.id === videoId ? { ...v, tags: updated.tags } : v))
      );
    } catch {
      // handled
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteVideoId) return;
    setDeleting(true);
    try {
      await apiFetch(`/videos/${deleteVideoId}`, { method: "DELETE" });
      setVideos((prev) => prev.filter((v) => v.id !== deleteVideoId));
    } catch {
      // handled
    } finally {
      setDeleting(false);
      setDeleteVideoId(null);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (videos.length === 0) return;
    const headers = ["Nome", "ID", "Stato", "Play", "Impressioni", "Tempo Medio", "Conv. Rate", "CTA Clicks", "Tags", "Creato"];
    const rows = videos.map((v) => [
      v.name,
      v.id,
      v.status || "active",
      String(v.stats?.plays || 0),
      String(v.stats?.impressions || 0),
      String(v.stats?.avg_watch_time || 0),
      String(v.stats?.conversion_rate || 0),
      String(v.stats?.cta_clicks || 0),
      (v.tags || []).join("; "),
      v.created_at,
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `videos-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Script download
  const handleGetScript = async (videoId: string) => {
    setScriptVideoId(videoId);
    setScriptText(null);
    setScriptError(null);
    setScriptLoading(true);
    try {
      const data = await apiFetch<{ text: string; language?: string; source: string }>(
        `/videos/${videoId}/script`
      );
      setScriptText(data.text);
    } catch (err) {
      setScriptError(
        err instanceof Error ? err.message : "Errore nel recupero dello script"
      );
    } finally {
      setScriptLoading(false);
    }
  };

  const handleDownloadScript = () => {
    if (!scriptText || !scriptVideoId) return;
    const video = videos.find((v) => v.id === scriptVideoId);
    const filename = `${(video?.name || "vsl-script").replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
    const blob = new Blob([scriptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = () => {
    if (!scriptText) return;
    navigator.clipboard.writeText(scriptText);
    setScriptCopied(true);
    setTimeout(() => setScriptCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Video</h1>
          <p className="text-muted-foreground">Gestisci e analizza i tuoi video</p>
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-20 animate-pulse-soft rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Video</h1>
          <p className="text-muted-foreground">
            {videos.length} video
            {selectedFolderId
              ? ` nella cartella "${folders.find((f) => f.id === selectedFolderId)?.name || ""}"`
              : " nel tuo account"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleExportCSV} disabled={videos.length === 0}>
          <Download className="h-4 w-4" />
          Esporta CSV
        </Button>
      </div>

      {folders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              !selectedFolderId
                ? "bg-primary text-white"
                : "border border-border text-muted-foreground hover:bg-secondary"
            }`}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Tutti
          </button>
          {folders.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedFolderId(f.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                selectedFolderId === f.id
                  ? "bg-primary text-white"
                  : "border border-border text-muted-foreground hover:bg-secondary"
              }`}
            >
              <FolderOpen className="h-3.5 w-3.5" />
              {f.name}
              <Badge variant="default">{f.video_count}</Badge>
            </button>
          ))}
        </div>
      )}

      {videos.length === 0 ? (
        <EmptyState
          icon={<Video className="h-8 w-8" />}
          title="Nessun video"
          description="Non ci sono video nel tuo account Vidalytics."
        />
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div key={video.id}>
              <Card className="animate-fade-in p-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-24 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-accent/20">
                    {video.thumbnail_url ? (
                      <img
                        src={video.thumbnail_url}
                        alt={video.name}
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <Video className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Link href={`/videos/${video.id}`} className="truncate font-semibold hover:text-primary transition-colors">
                        {video.name}
                      </Link>
                      <Badge variant={video.status === "active" ? "success" : "default"}>
                        {video.status || "active"}
                      </Badge>
                      {video.tags?.map((tag) => (
                        <Badge key={tag} variant="info">
                          {tag}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveTag(video.id, tag);
                            }}
                            className="ml-1 hover:text-danger"
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Creato: {new Date(video.created_at).toLocaleDateString("it-IT")}
                      {video.duration && ` · ${formatDuration(video.duration)}`}
                    </p>
                  </div>
                  {video.stats && (
                    <div className="hidden items-center gap-6 lg:flex">
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Play className="h-3.5 w-3.5" /> Play
                        </div>
                        <p className="font-semibold">{formatNumber(video.stats.plays)}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Eye className="h-3.5 w-3.5" /> Impression
                        </div>
                        <p className="font-semibold">{formatNumber(video.stats.impressions)}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Clock className="h-3.5 w-3.5" /> Watch
                        </div>
                        <p className="font-semibold">{formatDuration(video.stats.avg_watch_time)}</p>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <TrendingUp className="h-3.5 w-3.5" /> Conv.
                        </div>
                        <p className="font-semibold">{formatPercent(video.stats.conversion_rate)}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex shrink-0 items-center gap-1">
                    <Link href={`/videos/${video.id}`}>
                      <Button variant="ghost" size="sm" title="Breakdown">
                        <BarChart3 className="h-4 w-4 text-primary" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleExpand(video.id)} title="Timeline">
                      {expandedVideo === video.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleStartEdit(video)} title="Modifica">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTagVideoId(tagVideoId === video.id ? null : video.id)}
                      title="Tags"
                    >
                      <Tag className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleGetScript(video.id)} title="Script VSL">
                      <FileText className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleGetEmbed(video.id)} title="Embed">
                      <Code className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteVideoId(video.id)} title="Elimina">
                      <Trash2 className="h-4 w-4 text-danger" />
                    </Button>
                    <a href={`https://app.vidalytics.com/videos/${video.id}`} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" title="Apri in Vidalytics">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>

                {/* Inline tag editor */}
                {tagVideoId === video.id && (
                  <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 animate-fade-in">
                    <Tag className="h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                      placeholder="Aggiungi tag..."
                      className="h-8 flex-1 rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary"
                    />
                    <Button size="sm" onClick={handleAddTag} disabled={!newTag.trim() || savingTag}>
                      {savingTag ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    </Button>
                  </div>
                )}
              </Card>

              {/* Timeline expansion */}
              {expandedVideo === video.id && (
                <div className="mt-2 animate-fade-in">
                  {timelineLoading ? (
                    <div className="h-48 animate-pulse-soft rounded-xl border border-border bg-card" />
                  ) : videoTimeline.length > 0 ? (
                    <AreaChartCard
                      title={`Timeline - ${video.name}`}
                      data={videoTimeline.map((t) => ({
                        name: formatDateShort(t.date),
                        plays: t.plays,
                        conversions: t.conversions,
                      }))}
                      dataKey="plays"
                      secondaryKey="conversions"
                    />
                  ) : (
                    <Card className="py-6 text-center text-sm text-muted-foreground">
                      Nessun dato timeline disponibile per questo video.
                    </Card>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Edit Modal */}
      {editingVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Modifica Video</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditingVideoId(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-4">
              <Input
                label="Nome"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Cartella</label>
                <select
                  value={editFolderId}
                  onChange={(e) => setEditFolderId(e.target.value)}
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">Nessuna cartella</option>
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="ghost" onClick={() => setEditingVideoId(null)}>
                  Annulla
                </Button>
                <Button onClick={handleSaveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Salva
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-sm">
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger/10">
                <Trash2 className="h-6 w-6 text-danger" />
              </div>
              <h3 className="mt-4 font-semibold">Elimina Video</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Sei sicuro di voler eliminare &quot;{videos.find((v) => v.id === deleteVideoId)?.name}&quot;?
                Questa azione non può essere annullata.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Button variant="ghost" onClick={() => setDeleteVideoId(null)}>
                  Annulla
                </Button>
                <Button variant="danger" onClick={handleDelete} disabled={deleting}>
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Elimina
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Embed Modal with Options */}
      {embedVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Codice Embed</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEmbedVideoId(null);
                  setEmbedCode(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="mb-4 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={embedAutoplay}
                  onChange={(e) => { setEmbedAutoplay(e.target.checked); }}
                  className="rounded border-border"
                />
                Autoplay
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={embedMuted}
                  onChange={(e) => { setEmbedMuted(e.target.checked); }}
                  className="rounded border-border"
                />
                Muted
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={embedResponsive}
                  onChange={(e) => { setEmbedResponsive(e.target.checked); }}
                  className="rounded border-border"
                />
                Responsive
              </label>
              <Button variant="secondary" size="sm" onClick={refreshEmbed} disabled={loadingEmbed}>
                {loadingEmbed ? <Loader2 className="h-3 w-3 animate-spin" /> : "Aggiorna"}
              </Button>
            </div>

            {loadingEmbed ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : embedCode ? (
              <div className="max-h-64 overflow-auto rounded-lg bg-sidebar-bg p-4">
                <pre className="text-sm text-sidebar-text">
                  <code>{embedCode}</code>
                </pre>
              </div>
            ) : null}

            <div className="mt-4 flex justify-end">
              <Button size="sm" onClick={handleCopy} disabled={!embedCode}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4" /> Copiato!
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" /> Copia
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Script VSL Modal */}
      {scriptVideoId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <Card className="w-full max-w-2xl">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">Script VSL</h3>
                <p className="text-sm text-muted-foreground">
                  {videos.find((v) => v.id === scriptVideoId)?.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setScriptVideoId(null);
                  setScriptText(null);
                  setScriptError(null);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {scriptLoading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Recupero script in corso...</p>
              </div>
            ) : scriptError ? (
              <div className="rounded-lg border border-danger/20 bg-danger/5 p-6 text-center">
                <FileText className="mx-auto h-8 w-8 text-danger/60 mb-3" />
                <p className="text-sm text-danger font-medium mb-1">Script non disponibile</p>
                <p className="text-xs text-muted-foreground">{scriptError}</p>
              </div>
            ) : scriptText ? (
              <div className="max-h-96 overflow-auto rounded-lg bg-sidebar-bg p-4">
                <pre className="whitespace-pre-wrap text-sm leading-relaxed text-sidebar-text font-sans">
                  {scriptText}
                </pre>
              </div>
            ) : null}

            {scriptText && (
              <div className="mt-4 flex justify-end gap-2">
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
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
