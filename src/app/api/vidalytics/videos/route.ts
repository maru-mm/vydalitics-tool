import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

let videosCache: { data: unknown; ts: number } | null = null;
const CACHE_TTL = 60_000; // 1 minute

function getClient(req: NextRequest) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) return null;
  return new VidalyticsClient(token);
}

export async function GET(req: NextRequest) {
  const client = getClient(req);
  if (!client) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const url = new URL(req.url);
  const folderId = url.searchParams.get("folder_id") || undefined;

  try {
    if (!folderId && videosCache && Date.now() - videosCache.ts < CACHE_TTL) {
      return NextResponse.json(videosCache.data);
    }

    const videos = await client.getVideos({
      folder_id: folderId,
      tag: url.searchParams.get("tag") || undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      per_page: url.searchParams.get("per_page") ? Number(url.searchParams.get("per_page")) : undefined,
    });

    if (!folderId) {
      videosCache = { data: videos, ts: Date.now() };
    }

    return NextResponse.json(videos);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
