import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const client = new VidalyticsClient(token);
  const { id } = await params;
  const url = new URL(req.url);
  try {
    const embed = await client.getEmbedCode(id, {
      autoplay: url.searchParams.get("autoplay") === "true" ? true : undefined,
      muted: url.searchParams.get("muted") === "true" ? true : undefined,
      responsive: url.searchParams.get("responsive") === "true" ? true : undefined,
    });
    return NextResponse.json(embed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
