import { NextRequest } from "next/server";

const BACKEND_URL = process.env.AI_BACKEND_URL || "http://localhost:8100";

export async function POST(req: NextRequest) {
  const body = await req.json();

  const vidalyticsToken =
    body.vidalytics_token || req.headers.get("x-api-token") || "";

  const backendRes = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: body.message,
      conversation_history: body.conversation_history || [],
      vidalytics_token: vidalyticsToken,
    }),
  });

  if (!backendRes.ok) {
    const errBody = await backendRes.text();
    return new Response(
      JSON.stringify({ error: errBody || `Backend error: ${backendRes.status}` }),
      { status: backendRes.status, headers: { "Content-Type": "application/json" } }
    );
  }

  return new Response(backendRes.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
