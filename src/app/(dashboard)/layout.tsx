"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthGate } from "@/components/auth/auth-gate";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);

  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <Header />
        <main
          className={cn(
            "min-h-[calc(100vh-64px)] p-6 transition-all duration-300",
            sidebarOpen ? "ml-64" : "ml-[72px]"
          )}
        >
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
