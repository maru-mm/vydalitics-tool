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
  const { videoName, fullTranscript, criticalDrops, geminiAnalyses, stats } =
    body;

  const dropsDetail = (criticalDrops || [])
    .map(
      (
        drop: {
          timestampLabel: string;
          dropPct: number;
          retentionBefore: number;
          retentionAfter: number;
          transcriptContext: string;
        },
        i: number
      ) => {
        const gemini = geminiAnalyses?.[i] || "Gemini analysis not available";
        return `
### Drop #${i + 1} — ${drop.timestampLabel}
- Drop: -${drop.dropPct.toFixed(1)}% (from ${drop.retentionBefore.toFixed(1)}% to ${drop.retentionAfter.toFixed(1)}%)
- Transcript: "${drop.transcriptContext}"
- Visual analysis (Gemini): ${gemini}`;
      }
    )
    .join("\n");

  const prompt = `You are a world-class expert in Video Sales Letters (VSL), persuasive copywriting, and conversion optimization. You work as a consultant to the world's top marketers.

## Video: "${videoName}"

## Metrics
- Plays: ${stats?.plays || "N/A"} (Unique: ${stats?.unique_plays || "N/A"})
- Play rate: ${stats?.play_rate ? (stats.play_rate * 100).toFixed(1) + "%" : "N/A"}
- Average watch time: ${stats?.avg_watch_time ? Math.floor(stats.avg_watch_time / 60) + "m " + Math.floor(stats.avg_watch_time % 60) + "s" : "N/A"}
- Avg. % watched: ${stats?.avg_percent_watched ? (stats.avg_percent_watched * 100).toFixed(1) + "%" : "N/A"}
- Conversions: ${stats?.conversions || 0} (Rate: ${stats?.conversion_rate ? (stats.conversion_rate * 100).toFixed(1) + "%" : "N/A"})
- CTA clicks: ${stats?.cta_clicks || 0}

## Full VSL transcript
${fullTranscript || "Transcript not available"}

## Critical drop-off points with analysis
${dropsDetail || "No critical points identified"}

---

Based on ALL the data above, provide a complete strategic analysis in English with these sections:

## 🎯 What you are selling
From the transcript, identify exactly:
- The product/service offered
- The unique mechanism
- The main promise
- The target audience

## 🔍 Drop-off diagnosis
For EVERY critical drop point, provide:
1. **Hypothesis**: Why viewers leave at that specific point (based on the transcript AND Gemini's visual analysis)
2. **Copy problem**: What is wrong with the wording used
3. **Structure problem**: Where the VSL flow breaks

## 💡 How to improve — detailed plan
For EVERY drop, provide:
1. **Suggested rewrite**: Rewrite the problematic section with improved copy (concrete example of 2–3 sentences)
2. **Technique to apply**: The specific copywriting/persuasion technique to use (e.g. Pattern Interrupt, Future Pacing, Social Proof, Curiosity Loop, etc.)
3. **Estimated impact**: How much retention could improve at that point (low/medium/high)

## 🏆 Top 5 priority actions
The 5 most impactful changes ordered by potential ROI, with:
- What to change
- Why
- Expected outcome

## 📊 Overall assessment
- Current VSL score (1–10)
- Potential score after optimizations
- Main bottleneck

Be extremely specific and practical. Do not give generic advice. Every suggestion must be directly applicable to THIS VSL's transcript. Respond in English.`;

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
        max_tokens: 8192,
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
    const text =
      data.content?.[0]?.text || "Analysis not available.";

    return NextResponse.json({ improvements: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
