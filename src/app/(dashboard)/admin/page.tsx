"use client";

import { useEffect, useState, useMemo } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import {
  Shield,
  Search,
  Loader2,
  Save,
  CheckCircle2,
  AlertTriangle,
  Lock,
  FolderOpen,
  Folder,
  FolderCheck,
  Video,
} from "lucide-react";
import type { Folder as FolderType } from "@/lib/vidalytics-api";

function AdminLogin({ onSuccess }: { onSuccess: (password: string) => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.ok && data.role === "admin") {
        onSuccess(password);
      } else if (data.ok) {
        setError("This password does not have admin access.");
        setPassword("");
      } else {
        setError(data.error || "Incorrect password");
        setPassword("");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-24">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Admin panel
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Enter the admin password to configure visible folders
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Admin password"
              autoFocus
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-danger/5 border border-danger/20 px-3 py-2 text-sm text-danger">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 px-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Verifying...
              </span>
            ) : (
              "Sign in as admin"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const isAdmin = useAppStore((s) => s.isAdmin);
  const setAdmin = useAppStore((s) => s.setAdmin);
  const adminSessionPassword = useAppStore((s) => s.adminSessionPassword);
  const setAdminSessionPassword = useAppStore((s) => s.setAdminSessionPassword);
  const { apiFetch, isConfigured } = useApi();

  const [folders, setFolders] = useState<FolderType[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(true);
  const [allowedIds, setAllowedIds] = useState<Set<string>>(new Set());
  const [originalAllowedIds, setOriginalAllowedIds] = useState<Set<string>>(new Set());
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [passwordInput, setPasswordInput] = useState("");
  const [needsPassword, setNeedsPassword] = useState(false);

  useEffect(() => {
    if (!isConfigured || !isAdmin) return;
    setFoldersLoading(true);
    apiFetch<FolderType[]>("/folders")
      .then(setFolders)
      .catch(() => {})
      .finally(() => setFoldersLoading(false));
  }, [apiFetch, isConfigured, isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    setConfigLoading(true);
    fetch("/api/admin/vsl-config")
      .then((r) => r.json())
      .then((data) => {
        if (data.allowedFolderIds) {
          const ids = new Set<string>(data.allowedFolderIds);
          setAllowedIds(ids);
          setOriginalAllowedIds(ids);
        }
      })
      .catch(() => {})
      .finally(() => setConfigLoading(false));
  }, [isAdmin]);

  const filteredFolders = useMemo(() => {
    if (!searchQuery) return folders;
    const q = searchQuery.toLowerCase();
    return folders.filter((f) => f.name?.toLowerCase().includes(q));
  }, [folders, searchQuery]);

  const hasChanges = useMemo(() => {
    if (allowedIds.size !== originalAllowedIds.size) return true;
    for (const id of allowedIds) {
      if (!originalAllowedIds.has(id)) return true;
    }
    return false;
  }, [allowedIds, originalAllowedIds]);

  const toggleFolder = (id: string) => {
    setSaved(false);
    setAllowedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSaved(false);
    setAllowedIds(new Set(folders.map((f) => f.id)));
  };

  const deselectAll = () => {
    setSaved(false);
    setAllowedIds(new Set());
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
        body: JSON.stringify({ allowedFolderIds: Array.from(allowedIds) }),
      });

      if (res.status === 403) {
        setAdminSessionPassword(null);
        setNeedsPassword(true);
        setError("Invalid admin password. Please enter it again.");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error saving");
      }

      setOriginalAllowedIds(new Set(allowedIds));
      setNeedsPassword(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      if (!error) setError(e instanceof Error ? e.message : "Error saving");
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

  const handleAdminLogin = (password: string) => {
    setAdmin(true);
    setAdminSessionPassword(password);
  };

  if (!isAdmin) {
    return <AdminLogin onSuccess={handleAdminLogin} />;
  }

  const loading = foldersLoading || configLoading;
  const allowedCount = allowedIds.size;
  const totalCount = folders.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">
              Folder configuration
            </h1>
          </div>
          <p className="text-sm text-muted-foreground ml-[52px]">
            Select which Vidalytics folders are visible in the app
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
          {saving ? "Saving..." : saved ? "Saved!" : "Save configuration"}
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
          <span className="text-sm text-foreground font-medium">Admin Password:</span>
          <input
            type="password"
            value={passwordInput}
            onChange={(e) => setPasswordInput(e.target.value)}
            placeholder="Enter admin password"
            autoFocus
            className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <button
            type="submit"
            disabled={!passwordInput || saving}
            className="rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary-hover disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Confirm and save"}
          </button>
        </form>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <div className="text-xs text-muted-foreground mt-1">Total folders</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <FolderCheck className="h-4 w-4 text-green-500" />
            <span className="text-2xl font-bold text-green-600">{allowedCount}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Visible in app</div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-2">
            <Folder className="h-4 w-4 text-muted-foreground" />
            <span className="text-2xl font-bold text-muted-foreground">{totalCount - allowedCount}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Hidden</div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search folders by name..."
            className="w-full rounded-xl border border-border bg-card py-3 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
          />
        </div>
        <button
          onClick={selectAll}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
        >
          Select all
        </button>
        <button
          onClick={deselectAll}
          className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors"
        >
          Deselect all
        </button>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading folders...</p>
        </div>
      ) : filteredFolders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border py-16">
          <FolderOpen className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? "No results found" : "No folders available"}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
          {filteredFolders.map((f) => {
            const isAllowed = allowedIds.has(f.id);
            return (
              <div
                key={f.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-4 transition-colors cursor-pointer",
                  isAllowed ? "bg-card" : "bg-secondary/30 opacity-60"
                )}
                onClick={() => toggleFolder(f.id)}
              >
                <div className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                  isAllowed ? "bg-primary/10" : "bg-secondary"
                )}>
                  {isAllowed ? (
                    <FolderCheck className="h-5 w-5 text-primary" />
                  ) : (
                    <Folder className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-medium truncate",
                    isAllowed ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {f.name || "Unnamed folder"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <Video className="h-3 w-3" />
                      {f.videoCount ?? f.video_count ?? 0} videos
                    </span>
                    <span>ID: {f.id}</span>
                  </p>
                </div>

                <div
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-all",
                    isAllowed
                      ? "bg-green-500/10 text-green-600"
                      : "bg-secondary text-muted-foreground"
                  )}
                >
                  {isAllowed ? (
                    <>
                      <FolderCheck className="h-3.5 w-3.5" />
                      Visible
                    </>
                  ) : (
                    <>
                      <Folder className="h-3.5 w-3.5" />
                      Hidden
                    </>
                  )}
                </div>
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
            Save changes ({Math.abs(allowedIds.size - originalAllowedIds.size)} changed)
          </button>
        </div>
      )}
    </div>
  );
}
