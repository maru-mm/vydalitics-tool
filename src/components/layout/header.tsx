"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { useApi } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Gauge, AlertTriangle, LogOut, Activity, Shield } from "lucide-react";

const navItems = [
  { href: "/vsl-analysis", label: "MW VSL Complete" },
  { href: "/upsell-analysis", label: "MW Upsell 1 Digital" },
];

export function Header() {
  const pathname = usePathname();
  const apiToken = useAppStore((s) => s.apiToken);
  const serverTokenAvailable = useAppStore((s) => s.serverTokenAvailable);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const { apiFetch } = useApi();
  const [accountInfo, setAccountInfo] = useState<{
    plan: string;
    api_requests_used: number;
    api_requests_limit: number;
  } | null>(null);

  useEffect(() => {
    if (!apiToken && !serverTokenAvailable) return;
    apiFetch<{
      plan: string;
      api_requests_used: number;
      api_requests_limit: number;
      email: string;
    }>("/account")
      .then(setAccountInfo)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiToken, serverTokenAvailable]);

  const usagePercent = accountInfo
    ? Math.round((accountInfo.api_requests_used / accountInfo.api_requests_limit) * 100)
    : 0;
  const isWarning = usagePercent >= 80;
  const isCritical = usagePercent >= 95;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
            <Activity className="h-5 w-5 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight">
            Vydalitics AI
          </span>
        </div>

        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
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
            title={`API: ${accountInfo.api_requests_used.toLocaleString()} / ${accountInfo.api_requests_limit.toLocaleString()} requests (${accountInfo.plan})`}
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

        <Link
          href="/admin"
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
            pathname === "/admin"
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          )}
          title="Admin Panel"
        >
          <Shield className="h-4 w-4" />
          Admin
        </Link>

        <button
          onClick={() => setAuthenticated(false)}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          title="Sign Out"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </header>
  );
}
