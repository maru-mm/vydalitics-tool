import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

const statsCache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 120_000; // 2 minutes (stats refresh every 2h on Vidalytics)

export async function POST(req: NextRequest) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const client = new VidalyticsClient(token);
  try {
    const { video_ids } = await req.json();
    const ids: string[] = (video_ids || []).slice(0, 20);

    const now = Date.now();
    const cached: unknown[] = [];
    const uncachedIds: string[] = [];

    for (const id of ids) {
      const entry = statsCache.get(id);
      if (entry && now - entry.ts < CACHE_TTL) {
        cached.push(entry.data);
      } else {
        uncachedIds.push(id);
      }
    }

    if (uncachedIds.length > 0) {
      const freshStats = await client.getBulkStats(uncachedIds);
      for (const s of freshStats) {
        statsCache.set(s.video_id, { data: s, ts: now });
        cached.push(s);
      }
    }

    return NextResponse.json(cached);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
