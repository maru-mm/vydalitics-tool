"use client";

import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  Shield,
  Eye,
  EyeOff,
  Search,
  Loader2,
  Save,
  CheckCircle2,
  Video,
  AlertTriangle,
  Lock,
} from "lucide-react";
import type { VidalyticsVideo } from "@/lib/vidalytics-api";

export default function AdminPage() {
  const isAdmin = useAppStore((s) => s.isAdmin);
  const adminSessionPassword = useAppStore((s) => s.adminSessionPassword);
  const setAdminSessionPassword = useAppStore((s) => s.setAdminSessionPassword);
  const { apiFetch, isConfigured } = useApi();

  const [videos, setVideos] = useState<VidalyticsVideo[]>([]);
  const [videosLoading, setVideosLoading] = useState(true);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [originalHiddenIds, setOriginalHiddenIds] = useState<Set<string>>(new Set());
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    if (!isConfigured) return;
    setVideosLoading(true);
    apiFetch<VidalyticsVideo[]>("/videos")
      .then(setVideos)
      .catch(() => {})
      .finally(() => setVideosLoading(false));
  }, [apiFetch, isConfigured]);

  useEffect(() => {
    setConfigLoading(true);
    fetch("/api/admin/vsl-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.hiddenVideoIds) {
          const ids = new Set<string>(data.hiddenVideoIds);
          setHiddenIds(ids);
          setOriginalHiddenIds(ids);
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, []);

  const filteredVideos = useMemo(() => {
    if (!searchQuery) return videos;
    const q = searchQuery.toLowerCase();
    return videos.filter(
      (v) =>
        v.name?.toLowerCase().includes(q) || v.title?.toLowerCase().includes(q)
    );
  }, [videos, searchQuery]);

  const hasChanges = useMemo(() => {
    if (hiddenIds.size !== originalHiddenIds.size) return true;
    for (const id of hiddenIds) {
      if (!originalHiddenIds.has(id)) return true;
    }
    return false;
  }, [hiddenIds, originalHiddenIds]);

  const toggleVideo = (id: string) => {
    setSaved(false);
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const doSave = async (pw: string) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vsl-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": pw,
        },
        body: JSON.stringify({ hiddenVideoIds: Array.from(hiddenIds) }),
      });

      if (res.status === 403) {
        setAdminSessionPassword(null);
        setNeedsPassword(true);
        setError("Password admin non valida. Reinseriscila.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nel salvataggio");
      }

      setOriginalHiddenIds(new Set(hiddenIds));
      setNeedsPassword(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      if (!error) setError(e instanceof Error ? e.message : "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (adminSessionPassword) {
      await doSave(adminSessionPassword);
    } else {
      setNeedsPassword(true);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput) return;
    setAdminSessionPassword(passwordInput);
    await doSave(passwordInput);
    setPasswordInput("");
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-32">
        <div className="rounded-2xl bg-danger/10 p-6 mb-4">
          <Shield className="h-12 w-12 text-danger" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Accesso non autorizzato
        </h2>
        <p className="text-sm text-muted-foreground">
          Questa pagina è riservata agli amministratori.
        </p>
      </div>
    );
  }

  const loading = videosLoading || configLoading;
  const visibleCount = videos.length - hiddenIds.size;
  const hiddenCount = hiddenIds.size;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Configurazione VSL
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            Scegli quali VSL rendere visibili nel menu &quot;Seleziona Video&quot;
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={cn(
            "flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all",
            saved
              ? "bg-green-500/10 text-green-600"
              : "bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? "Salvataggio..." : saved ? "Salvato!" : "Salva configurazione"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {needsPassword && (
        <form
          onSubmit={handlePasswordSubmit}
          className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3"
        >
          <Lock className="h-4 w-4 text-primary shrink-0" />
          <span className="text-sm text-foreground font-medium">Password Admin:</span>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Inserisci password admin"
            autoFocus
            className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={!passwordInput || saving}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvataggio..." : "Conferma e Salva"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{videos.length}</div>
          <div className="text-xs text-muted-foreground mt-1">VSL totali</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-green-500" />
            <span className="text-2xl font-bold text-green-600">{visibleCount}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Visibili nel tool</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold text-muted-foreground">{hiddenCount}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Nascoste</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Cerca VSL per nome..."
          className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
        />
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Caricamento VSL...</p>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <Video className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "Nessun risultato trovato" : "Nessuna VSL disponibile"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {filteredVideos.map((v) => {
            const isHidden = hiddenIds.has(v.id);
            return (
              <div
                key={v.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 transition-colors",
                  isHidden ? "bg-secondary/30 opacity-60" : "bg-card"
                )}
              >
                <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg bg-secondary overflow-hidden">
                  {v.thumbnail_url ? (
                    <img
                      src={v.thumbnail_url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Video className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isHidden ? "text-muted-foreground line-through" : "text-foreground"
                  )}>
                    {v.name || v.title || "Video senza nome"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    ID: {v.id}
                    {v.duration ? ` · ${Math.floor(v.duration / 60)}:${String(Math.floor(v.duration % 60)).padStart(2, "0")}` : ""}
                  </p>
                </div>

                <button
                  onClick={() => toggleVideo(v.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                    isHidden
                      ? "bg-secondary text-muted-foreground hover:bg-green-500/10 hover:text-green-600"
                      : "bg-green-500/10 text-green-600 hover:bg-danger/10 hover:text-danger"
                  )}
                >
                  {isHidden ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      Nascosta
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      Visibile
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {hasChanges && !saving && (
        <div className="sticky bottom-6 flex justify-center animate-fade-in">
          <button
            onClick={handleSave}
            className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow-lg hover:bg-primary-hover transition-all hover:scale-105"
          >
            <Save className="h-4 w-4" />
            Salva modifiche ({Math.abs(hiddenIds.size - originalHiddenIds.size)} cambiate)
          </button>
        </div>
      )}
    </div>
  );
}
