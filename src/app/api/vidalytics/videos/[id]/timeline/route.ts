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
    const timeline = await client.getVideoTimeline(id, {
      start_date: url.searchParams.get("start_date") || undefined,
      end_date: url.searchParams.get("end_date") || undefined,
      interval: (url.searchParams.get("interval") as "hourly" | "daily") || undefined,
      filters: {
        country: url.searchParams.get("country") || undefined,
        device: url.searchParams.get("device") || undefined,
        browser: url.searchParams.get("browser") || undefined,
        os: url.searchParams.get("os") || undefined,
        referrer: url.searchParams.get("referrer") || undefined,
        url_param: url.searchParams.get("url_param") || undefined,
        url_param_value: url.searchParams.get("url_param_value") || undefined,
      },
    });
    return NextResponse.json(timeline);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
