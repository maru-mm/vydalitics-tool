import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const { videoName, drops, fullTranscript, stats } = body;

  if (!drops || drops.length === 0) {
    return NextResponse.json({ drops: [] });
  }

  const dropsContext = drops
    .map(
      (
        d: {
          timestampLabel: string;
          dropPct: number;
          retentionBefore: number;
          retentionAfter: number;
          transcriptContext: string;
          geminiAnalysis: string;
        },
        i: number
      ) =>
        `Drop #${i + 1} (${d.timestampLabel}): -${d.dropPct.toFixed(1)}% retention (${d.retentionBefore.toFixed(1)}% → ${d.retentionAfter.toFixed(1)}%)
Transcript: "${d.transcriptContext}"
Gemini analysis: ${d.geminiAnalysis || "N/A"}`
    )
    .join("\n\n");

  const prompt = `You are a world-class expert in Video Sales Letters (VSL) and copywriting. Analyze this VSL "${videoName}" and its critical drop-off points.

## Video metrics
- Plays: ${stats?.plays || "N/A"}, Unique: ${stats?.unique_plays || "N/A"}
- Avg. % watched: ${stats?.avg_percent_watched ? (stats.avg_percent_watched * 100).toFixed(1) + "%" : "N/A"}
- Conversions: ${stats?.conversions || 0} (Rate: ${stats?.conversion_rate ? (stats.conversion_rate * 100).toFixed(1) + "%" : "N/A"})

## Full transcript
${fullTranscript || "Not available"}

## Drop-off points
${dropsContext}

---

IMPORTANT: Reply ONLY with valid JSON, no markdown, no backticks, no extra text.
The format MUST be exactly:

[
  {
    "dropIndex": 0,
    "generalAnalysis": "General analysis of what happens at this point in the VSL and why it is problematic (2–3 sentences in English)",
    "suggestions": "3 concrete, specific suggestions to improve this point, separated by semicolons (in English)"
  }
]

Generate one object for EVERY drop (${drops.length} total). Be specific, not generic. Base each suggestion on the actual VSL transcript.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Claude API error: ${errText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const raw = data.content?.[0]?.text || "[]";

    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ drops: [] });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ drops: parsed });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
