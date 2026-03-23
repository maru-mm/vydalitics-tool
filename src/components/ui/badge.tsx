"use client";

import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variant === "default" && "bg-secondary text-secondary-foreground",
        variant === "success" && "bg-success/10 text-success",
        variant === "warning" && "bg-accent/10 text-accent",
        variant === "danger" && "bg-danger/10 text-danger",
        variant === "info" && "bg-primary/10 text-primary",
        className
      )}
    >
      {children}
    </span>
  );
}
