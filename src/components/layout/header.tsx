"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Bell, Search, Gauge, AlertTriangle } from "lucide-react";

export function Header() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const apiToken = useAppStore((s) => s.apiToken);
  const { apiFetch } = useApi();
  const [accountInfo, setAccountInfo] = useState<{
    plan: string;
    api_requests_used: number;
    api_requests_limit: number;
  } | null>(null);

  useEffect(() => {
    if (!apiToken) return;
    apiFetch<{
      plan: string;
      api_requests_used: number;
      api_requests_limit: number;
      email: string;
    }>("/account")
      .then(setAccountInfo)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken]);

  const usagePercent = accountInfo
    ? Math.round((accountInfo.api_requests_used / accountInfo.api_requests_limit) * 100)
    : 0;
  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/80 px-6 backdrop-blur-sm transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-[72px]"
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Cerca video, analytics..."
            className="h-9 w-64 rounded-lg border border-border bg-secondary pl-10 pr-4 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* API Usage Indicator */}
        {accountInfo && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
              isCritical
                ? "bg-danger/10 text-danger"
                : isWarning
                  ? "bg-accent/10 text-accent"
                  : "bg-secondary text-muted-foreground"
            )}
            title={`API: ${accountInfo.api_requests_used.toLocaleString()} / ${accountInfo.api_requests_limit.toLocaleString()} richieste (${accountInfo.plan})`}
          >
            {isCritical ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <Gauge className="h-3.5 w-3.5" />
            )}
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-12 rounded-full bg-border">
                <div
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    isCritical ? "bg-danger" : isWarning ? "bg-accent" : "bg-primary"
                  )}
                  style={{ width: `${Math.min(usagePercent, 100)}%` }}
                />
              </div>
              <span>{usagePercent}%</span>
            </div>
          </div>
        )}

        <button className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
          <Bell className="h-5 w-5" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-accent" />
      </div>
    </header>
  );
}
