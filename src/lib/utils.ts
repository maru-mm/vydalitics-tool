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

export function getDateRangeDates(
  range: string,
  customStart?: string | null,
  customEnd?: string | null
): { start_date: string; end_date: string; start: string; end: string; dateFrom: string; dateTo: string } {
  const today = new Date().toISOString().split("T")[0];
  let s: string;
  let e: string = today;

  switch (range) {
    case "today":
      s = today;
      break;
    case "yesterday": {
      const y = daysAgo(1);
      s = y;
      e = y;
      break;
    }
    case "7d":
      s = daysAgo(7);
      break;
    case "14d":
      s = daysAgo(14);
      break;
    case "30d":
      s = daysAgo(30);
      break;
    case "90d":
      s = daysAgo(90);
      break;
    case "custom":
      s = customStart || daysAgo(7);
      e = customEnd || today;
      break;
    default:
      s = daysAgo(7);
  }

  return { start_date: s, end_date: e, start: s, end: e, dateFrom: s, dateTo: e };
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

export function computeAvgWatchTime(
  avgWatchTime: number,
  avgPercentWatched: number,
  videoDurationSeconds: number | undefined | null
): number {
  if (avgWatchTime > 0) return avgWatchTime;
  if (avgPercentWatched > 0 && videoDurationSeconds && videoDurationSeconds > 0) {
    const pct = avgPercentWatched > 1 ? avgPercentWatched / 100 : avgPercentWatched;
    return pct * videoDurationSeconds;
  }
  return 0;
}

export function estimateDurationFromDropOff(
  watches: Record<string, number> | undefined | null
): number {
  if (!watches) return 0;
  const keys = Object.keys(watches).map(Number).filter((n) => !isNaN(n));
  return keys.length > 0 ? Math.max(...keys) : 0;
}
