import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

export async function GET(req: NextRequest) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const client = new VidalyticsClient(token);
  try {
    const tags = await client.getTags();
    return NextResponse.json(tags);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
