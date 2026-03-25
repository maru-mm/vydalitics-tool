"use client";

import { useState } from "react";
import { useAppStore } from "@/lib/store";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const setAuthenticated = useAppStore((s) => s.setAuthenticated);
  const setAdmin = useAppStore((s) => s.setAdmin);
  const setAdminSessionPassword = useAppStore((s) => s.setAdminSessionPassword);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <>{children}</>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();

      if (data.ok) {
        setAuthenticated(true);
        if (data.role === "admin") {
          setAdmin(true);
          setAdminSessionPassword(password);
        }
      } else {
        setError(data.error || "Wrong password");
        setPassword("");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-card rounded-2xl shadow-lg border border-border p-8 animate-fade-in">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-primary/10 mb-4">
              <svg
                className="w-7 h-7 text-primary"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-foreground">Vydalitics AI</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Enter password to access
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoFocus
                className="w-full px-4 py-3 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
              />
            </div>

            {error && (
              <p className="text-sm text-danger text-center animate-fade-in">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-3 px-4 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {loading ? "Verifying..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
