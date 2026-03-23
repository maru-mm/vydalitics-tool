import { NextRequest } from "next/server";
import { VidalyticsClient } from "@/lib/vidalytics-api";

export function getVidalyticsClient(req: NextRequest): VidalyticsClient | null {
  const token =
    req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) return null;
  return new VidalyticsClient(token);
}
