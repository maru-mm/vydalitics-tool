export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

export function formatPercent(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

export function getDateRangeDates(range: string): { start_date: string; end_date: string; start: string; end: string } {
  const end = new Date().toISOString().split("T")[0];
  switch (range) {
    case "7d":
      return { start_date: daysAgo(7), end_date: end, start: daysAgo(7), end };
    case "14d":
      return { start_date: daysAgo(14), end_date: end, start: daysAgo(14), end };
    case "30d":
      return { start_date: daysAgo(30), end_date: end, start: daysAgo(30), end };
    default:
      return { start_date: daysAgo(7), end_date: end, start: daysAgo(7), end };
  }
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
}

export function formatDateLong(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
