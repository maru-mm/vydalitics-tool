import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    vidalyticsConfigured: !!process.env.VIDALYTICS_API_TOKEN,
  });
}
