"use client";

import { useState, useRef, useEffect } from "react";
import { useAppStore, type DateRange } from "@/lib/store";
import { cn, getDateRangeDates } from "@/lib/utils";
import { Calendar, ChevronDown } from "lucide-react";

const presets: { label: string; value: DateRange }[] = [
  { label: "Oggi", value: "today" },
  { label: "Ieri", value: "yesterday" },
  { label: "Ultimi 7 giorni", value: "7d" },
  { label: "Ultimi 14 giorni", value: "14d" },
  { label: "Ultimi 30 giorni", value: "30d" },
  { label: "Ultimi 90 giorni", value: "90d" },
];

const shortLabels: Record<DateRange, string> = {
  today: "Oggi",
  yesterday: "Ieri",
  "7d": "7G",
  "14d": "14G",
  "30d": "30G",
  "90d": "90G",
  custom: "Custom",
};

function formatDisplayDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("it-IT", { day: "2-digit", month: "short" });
}

export function DateRangePicker({ compact }: { compact?: boolean } = {}) {
  const {
    dateRange,
    setDateRange,
    customStartDate,
    customEndDate,
    setCustomDates,
  } = useAppStore();

  const [open, setOpen] = useState(false);
  const [tempStart, setTempStart] = useState(customStartDate || "");
  const [tempEnd, setTempEnd] = useState(customEndDate || "");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const dates = getDateRangeDates(dateRange, customStartDate, customEndDate);

  const displayLabel =
    dateRange === "custom" && customStartDate && customEndDate
      ? `${formatDisplayDate(customStartDate)} — ${formatDisplayDate(customEndDate)}`
      : shortLabels[dateRange] || "7G";

  const handlePreset = (value: DateRange) => {
    setDateRange(value);
    if (value !== "custom") setOpen(false);
  };

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      setCustomDates(tempStart, tempEnd);
      setOpen(false);
    }
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg border border-border bg-white font-medium transition-all hover:border-primary/40 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20",
          compact ? "h-8 px-2.5 text-xs" : "h-9 px-3 text-sm"
        )}
      >
        <Calendar className={cn("text-primary", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className="text-foreground">{displayLabel}</span>
        <ChevronDown
          className={cn(
            "text-muted-foreground transition-transform",
            compact ? "h-3 w-3" : "h-3.5 w-3.5",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-72 rounded-xl border border-border bg-white shadow-xl animate-fade-in">
          <div className="p-2">
            <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Periodo
            </p>
            <div className="grid grid-cols-2 gap-1">
              {presets.map((p) => (
                <button
                  key={p.value}
                  onClick={() => handlePreset(p.value)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    dateRange === p.value
                      ? "bg-primary text-white font-medium"
                      : "text-foreground hover:bg-secondary"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-border p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Personalizzato
            </p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-border bg-white px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
              <span className="text-xs text-muted-foreground">—</span>
              <input
                type="date"
                value={tempEnd}
                onChange={(e) => setTempEnd(e.target.value)}
                className="h-8 flex-1 rounded-lg border border-border bg-white px-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={handleApplyCustom}
              disabled={!tempStart || !tempEnd}
              className="mt-2 w-full rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Applica
            </button>
          </div>

          {dateRange !== "7d" && (
            <div className="border-t border-border px-3 py-2">
              <p className="text-[10px] text-muted-foreground">
                {formatDisplayDate(dates.start_date)} — {formatDisplayDate(dates.end_date)}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
