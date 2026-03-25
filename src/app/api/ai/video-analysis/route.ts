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
  const { videoName, stats, dropOff, segments } = body;

  const dropOffSummary = buildDropOffSummary(dropOff);
  const segmentSummary = buildSegmentSummary(segments);

  const prompt = `You are an expert analyst of Video Sales Letters (VSL) and video marketing. Analyze this video's performance in depth and provide actionable insights.

## Video: "${videoName}"

## Main metrics
- Plays: ${stats.plays} (Unique: ${stats.unique_plays})
- Impressions: ${stats.impressions}
- Play rate: ${(stats.play_rate * 100).toFixed(1)}%
- Unmute rate: ${stats.unmute_rate ? (stats.unmute_rate * 100).toFixed(1) + "%" : "N/A"}
- Average watch time: ${Math.floor(stats.avg_watch_time / 60)}m ${Math.floor(stats.avg_watch_time % 60)}s
- Avg. % watched: ${(stats.avg_percent_watched * 100).toFixed(1)}%
- Conversions: ${stats.conversions} (Rate: ${(stats.conversion_rate * 100).toFixed(1)}%)
- CTA clicks: ${stats.cta_clicks} (Rate: ${(stats.cta_click_rate * 100).toFixed(1)}%)

## Drop-off curve (retention per second)
${dropOffSummary}

## Segmented data
${segmentSummary}

---

Provide your analysis in these sections:

### 1. Overall performance
Assess the main metrics against VSL industry benchmarks.

### 2. Hook analysis (first 30 seconds)
Analyze play rate, unmute rate, and early retention. Does the hook work?

### 3. Frame-by-frame retention analysis
Identify critical drop-off points on the retention curve. Where are viewers lost and why?

### 4. Strengths
What works well in this video.

### 5. Areas for improvement
Specific issues with concrete suggestions.

### 6. Action plan (top 3 priorities)
The 3 most important actions to improve performance, ordered by impact.

Respond in English.`;

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
    const text =
      data.content?.[0]?.text || "Analysis not available.";

    return NextResponse.json({ analysis: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildDropOffSummary(
  dropOff: { watches: Record<string, number> } | null
): string {
  if (!dropOff?.watches) return "Drop-off data not available.";

  const entries = Object.entries(dropOff.watches)
    .map(([sec, count]) => ({ sec: parseInt(sec), count }))
    .sort((a, b) => a.sec - b.sec);

  if (entries.length === 0) return "No drop-off data.";

  const maxViewers = entries[0]?.count || 1;
  const keyPoints: string[] = [];

  const checkpoints = [0, 5, 10, 15, 30, 60, 120, 180, 300, 600, 900, 1200, 1800];
  for (const cp of checkpoints) {
    const entry = entries.find((e) => e.sec === cp);
    if (entry) {
      const pct = ((entry.count / maxViewers) * 100).toFixed(1);
      const mins = Math.floor(cp / 60);
      const secs = cp % 60;
      const label = cp < 60 ? `${cp}s` : `${mins}m${secs > 0 ? secs + "s" : ""}`;
      keyPoints.push(`- ${label}: ${pct}% retention (${entry.count} viewers)`);
    }
  }

  const last = entries[entries.length - 1];
  if (last && !checkpoints.includes(last.sec)) {
    const pct = ((last.count / maxViewers) * 100).toFixed(1);
    const mins = Math.floor(last.sec / 60);
    const secs = last.sec % 60;
    keyPoints.push(
      `- End (${mins}m${secs > 0 ? secs + "s" : ""}): ${pct}% retention (${last.count} viewers)`
    );
  }

  // Find biggest drops
  let biggestDrop = { from: 0, to: 0, dropPct: 0 };
  for (let i = 1; i < entries.length; i++) {
    const prev = entries[i - 1];
    const curr = entries[i];
    const dropPct = ((prev.count - curr.count) / maxViewers) * 100;
    if (dropPct > biggestDrop.dropPct) {
      biggestDrop = { from: prev.sec, to: curr.sec, dropPct };
    }
  }

  if (biggestDrop.dropPct > 0) {
    keyPoints.push(
      `\nLargest drop: between ${biggestDrop.from}s and ${biggestDrop.to}s (-${biggestDrop.dropPct.toFixed(1)}% of viewers)`
    );
  }

  return keyPoints.join("\n");
}

function buildSegmentSummary(
  segments: Record<string, Array<{ segment_value: string; plays: number; conversions: number }>> | null
): string {
  if (!segments) return "No segmented data available.";

  const parts: string[] = [];
  for (const [type, data] of Object.entries(segments)) {
    if (!data || data.length === 0) continue;
    const sorted = [...data].sort((a, b) => b.plays - a.plays).slice(0, 5);
    parts.push(
      `**${type.charAt(0).toUpperCase() + type.slice(1)}:** ${sorted
        .map(
          (s) => `${s.segment_value} (${s.plays} plays, ${s.conversions} conv.)`
        )
        .join(", ")}`
    );
  }

  return parts.length > 0 ? parts.join("\n") : "No segmented data.";
}
