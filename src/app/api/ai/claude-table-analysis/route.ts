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
Trascrizione: "${d.transcriptContext}"
Analisi Gemini: ${d.geminiAnalysis || "N/D"}`
    )
    .join("\n\n");

  const prompt = `Sei un esperto world-class di Video Sales Letters (VSL) e copywriting. Analizza questa VSL "${videoName}" e i suoi punti critici di drop-off.

## Metriche Video
- Play: ${stats?.plays || "N/D"}, Unici: ${stats?.unique_plays || "N/D"}
- % Media Guardata: ${stats?.avg_percent_watched ? (stats.avg_percent_watched * 100).toFixed(1) + "%" : "N/D"}
- Conversioni: ${stats?.conversions || 0} (Rate: ${stats?.conversion_rate ? (stats.conversion_rate * 100).toFixed(1) + "%" : "N/D"})

## Trascrizione Completa
${fullTranscript || "Non disponibile"}

## Punti di Drop-Off
${dropsContext}

---

IMPORTANTE: Rispondi ESCLUSIVAMENTE con un JSON valido, senza markdown, senza backtick, senza testo extra.
Il formato DEVE essere esattamente:

[
  {
    "dropIndex": 0,
    "generalAnalysis": "Analisi generale di cosa succede in questo punto della VSL e perché è problematico (2-3 frasi in italiano)",
    "suggestions": "3 suggerimenti concreti e specifici per migliorare questo punto, separati da punto e virgola (in italiano)"
  }
]

Genera un elemento per OGNI drop (${drops.length} totali). Sii specifico, non generico. Basa ogni suggerimento sulla trascrizione reale della VSL.`;

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
