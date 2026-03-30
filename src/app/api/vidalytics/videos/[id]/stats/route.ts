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
    const stats = await client.getVideoStats(id, {
      dateFrom: url.searchParams.get("dateFrom") || undefined,
      dateTo: url.searchParams.get("dateTo") || undefined,
      country: url.searchParams.get("country") || undefined,
      device: url.searchParams.get("device") || undefined,
      browser: url.searchParams.get("browser") || undefined,
      os: url.searchParams.get("os") || undefined,
      referrer: url.searchParams.get("referrer") || undefined,
      url_param: url.searchParams.get("url_param") || undefined,
      url_param_value: url.searchParams.get("url_param_value") || undefined,
    });
    return NextResponse.json(stats);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
