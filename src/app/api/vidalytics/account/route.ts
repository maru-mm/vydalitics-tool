import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

let accountCache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 300_000; // 5 minutes

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }

  if (accountCache && Date.now() - accountCache.ts < CACHE_TTL) {
    return NextResponse.json(accountCache.data);
  }

  const client = new VidalyticsClient(token);
  try {
    const info = await client.getAccountInfo();
    accountCache = { data: info, ts: Date.now() };
    return NextResponse.json(info);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
