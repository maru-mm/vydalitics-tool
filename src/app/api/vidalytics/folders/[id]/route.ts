import { NextRequest, NextResponse } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const client = new VidalyticsClient(token);
  const { id } = await params;
  try {
    const { name } = await req.json();
    const folder = await client.updateFolder(id, name);
    return NextResponse.json(folder);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }
  const client = new VidalyticsClient(token);
  const { id } = await params;
  try {
    await client.deleteFolder(id);
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
