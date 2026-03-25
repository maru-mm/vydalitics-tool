"use client";

import { Header } from "@/components/layout/header";
import { AuthGate } from "@/components/auth/auth-gate";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <div className="min-h-screen bg-background">
        <Header />
        <main className="min-h-[calc(100vh-64px)] p-6">
          {children}
        </main>
      </div>
    </AuthGate>
  );
}
