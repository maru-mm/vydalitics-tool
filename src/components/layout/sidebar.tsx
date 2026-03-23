"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  Microscope,
} from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    items: [
      { href: "/vsl-analysis", label: "Analisi VSL", icon: Microscope },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, toggleSidebar } = useAppStore();

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 flex h-screen flex-col bg-sidebar-bg text-sidebar-text transition-all duration-300",
        sidebarOpen ? "w-64" : "w-[72px]"
      )}
    >
      <div className="flex h-16 items-center gap-3 border-b border-white/10 px-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Activity className="h-5 w-5 text-white" />
        </div>
        {sidebarOpen && (
          <span className="animate-fade-in text-lg font-bold tracking-tight text-white">
            Vydalitics AI
          </span>
        )}
      </div>

      <nav className="mt-4 flex flex-1 flex-col gap-1 px-3">
        {navSections.map((section, sIdx) => (
          <div key={sIdx}>
            {section.title && sidebarOpen && (
              <div className="mb-1 mt-4 px-3 text-[10px] font-semibold uppercase tracking-wider text-sidebar-text/50">
                {section.title}
              </div>
            )}
            {section.title && !sidebarOpen && <div className="my-2 mx-3 h-px bg-white/10" />}
            {!section.title && sIdx > 0 && <div className="my-2 mx-3 h-px bg-white/10" />}
            {section.items.map((item) => {
              const isActive =
                item.href === "/ai"
                  ? pathname === "/ai"
                  : pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                    isActive
                      ? "bg-sidebar-active/20 text-white"
                      : "text-sidebar-text hover:bg-white/5 hover:text-white"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5 shrink-0 transition-colors",
                      isActive ? "text-primary" : "text-sidebar-text group-hover:text-white"
                    )}
                  />
                  {sidebarOpen && (
                    <span className="animate-slide-in">{item.label}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <button
        onClick={toggleSidebar}
        className="m-3 flex items-center justify-center rounded-lg p-2 text-sidebar-text transition-colors hover:bg-white/10 hover:text-white"
      >
        {sidebarOpen ? (
          <ChevronLeft className="h-5 w-5" />
        ) : (
          <ChevronRight className="h-5 w-5" />
        )}
      </button>
    </aside>
  );
}
