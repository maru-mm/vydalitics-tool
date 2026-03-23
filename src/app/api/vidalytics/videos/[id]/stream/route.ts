import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token =
    req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const { id } = await params;

  try {
    const client = new VidalyticsClient(token);
    const mediaInfo = await client.extractMediaInfo(id);

    if (!mediaInfo.hlsUrl) {
      return NextResponse.json(
        { error: "Stream URL not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      hlsUrl: mediaInfo.hlsUrl,
      posterUrl: null,
      duration: null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
