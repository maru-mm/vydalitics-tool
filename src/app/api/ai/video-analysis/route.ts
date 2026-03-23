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

  const prompt = `Sei un esperto analista di Video Sales Letters (VSL) e video marketing. Analizza in modo approfondito le performance di questo video e fornisci insights azionabili.

## Video: "${videoName}"

## Metriche Principali
- Play: ${stats.plays} (Unici: ${stats.unique_plays})
- Impressioni: ${stats.impressions}
- Play Rate: ${(stats.play_rate * 100).toFixed(1)}%
- Unmute Rate: ${stats.unmute_rate ? (stats.unmute_rate * 100).toFixed(1) + "%" : "N/D"}
- Tempo Medio di Visione: ${Math.floor(stats.avg_watch_time / 60)}m ${Math.floor(stats.avg_watch_time % 60)}s
- % Media Guardata: ${(stats.avg_percent_watched * 100).toFixed(1)}%
- Conversioni: ${stats.conversions} (Rate: ${(stats.conversion_rate * 100).toFixed(1)}%)
- CTA Clicks: ${stats.cta_clicks} (Rate: ${(stats.cta_click_rate * 100).toFixed(1)}%)

## Curva di Drop-Off (Retention per Secondo)
${dropOffSummary}

## Dati Segmentati
${segmentSummary}

---

Fornisci la tua analisi strutturata in queste sezioni:

### 1. Performance Generale
Valuta le metriche principali rispetto ai benchmark del settore VSL.

### 2. Analisi Hook (Primi 30 Secondi)
Analizza play rate, unmute rate e retention iniziale. Il hook funziona?

### 3. Analisi Retention Frame-by-Frame
Identifica i punti critici di drop-off nella curva di retention. Dove si perdono gli spettatori e perché?

### 4. Punti di Forza
Cosa funziona bene in questo video.

### 5. Aree di Miglioramento
Problemi specifici con suggerimenti concreti.

### 6. Piano d'Azione (Top 3 Priorità)
Le 3 azioni più importanti per migliorare le performance, ordinate per impatto.

Rispondi in italiano.`;

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
      data.content?.[0]?.text || "Analisi non disponibile.";

    return NextResponse.json({ analysis: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function buildDropOffSummary(
  dropOff: { watches: Record<string, number> } | null
): string {
  if (!dropOff?.watches) return "Dati drop-off non disponibili.";

  const entries = Object.entries(dropOff.watches)
    .map(([sec, count]) => ({ sec: parseInt(sec), count }))
    .sort((a, b) => a.sec - b.sec);

  if (entries.length === 0) return "Nessun dato drop-off.";

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
      `- Fine (${mins}m${secs > 0 ? secs + "s" : ""}): ${pct}% retention (${last.count} viewers)`
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
      `\nMaggior drop: tra ${biggestDrop.from}s e ${biggestDrop.to}s (-${biggestDrop.dropPct.toFixed(1)}% degli spettatori)`
    );
  }

  return keyPoints.join("\n");
}

function buildSegmentSummary(
  segments: Record<string, Array<{ segment_value: string; plays: number; conversions: number }>> | null
): string {
  if (!segments) return "Nessun dato segmentato disponibile.";

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

  return parts.length > 0 ? parts.join("\n") : "Nessun dato segmentato.";
}
