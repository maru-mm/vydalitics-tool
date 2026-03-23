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
        const gemini = geminiAnalyses?.[i] || "Analisi Gemini non disponibile";
        return `
### Drop #${i + 1} — ${drop.timestampLabel}
- Calo: -${drop.dropPct.toFixed(1)}% (da ${drop.retentionBefore.toFixed(1)}% a ${drop.retentionAfter.toFixed(1)}%)
- Trascrizione: "${drop.transcriptContext}"
- Analisi Visiva (Gemini): ${gemini}`;
      }
    )
    .join("\n");

  const prompt = `Sei un esperto world-class di Video Sales Letters (VSL), copywriting persuasivo e ottimizzazione delle conversioni. Lavori come consulente per i più grandi marketer al mondo.

## Video: "${videoName}"

## Metriche
- Play: ${stats?.plays || "N/D"} (Unici: ${stats?.unique_plays || "N/D"})
- Play Rate: ${stats?.play_rate ? (stats.play_rate * 100).toFixed(1) + "%" : "N/D"}
- Tempo Medio: ${stats?.avg_watch_time ? Math.floor(stats.avg_watch_time / 60) + "m " + Math.floor(stats.avg_watch_time % 60) + "s" : "N/D"}
- % Media Guardata: ${stats?.avg_percent_watched ? (stats.avg_percent_watched * 100).toFixed(1) + "%" : "N/D"}
- Conversioni: ${stats?.conversions || 0} (Rate: ${stats?.conversion_rate ? (stats.conversion_rate * 100).toFixed(1) + "%" : "N/D"})
- CTA Clicks: ${stats?.cta_clicks || 0}

## Trascrizione Completa della VSL
${fullTranscript || "Trascrizione non disponibile"}

## Punti Critici di Drop-Off con Analisi
${dropsDetail || "Nessun punto critico identificato"}

---

Basandoti su TUTTI i dati sopra, fornisci un'analisi strategica completa in italiano con queste sezioni:

## 🎯 Cosa Stai Vendendo
Dalla trascrizione, identifica esattamente:
- Il prodotto/servizio offerto
- Il meccanismo unico (Unique Mechanism)
- La promessa principale
- Il target audience

## 🔍 Diagnosi dei Drop-Off
Per OGNI punto di drop critico, fornisci:
1. **Assunzione**: Perché gli spettatori abbandonano in quel punto specifico (basati sulla trascrizione E sull'analisi visiva di Gemini)
2. **Problema nel Copy**: Cosa non funziona nelle parole usate
3. **Problema nella Struttura**: Dove si rompe il flusso della VSL

## 💡 Come Migliorare — Piano Dettagliato
Per OGNI drop, fornisci:
1. **Riscrittura Suggerita**: Riscrivi la sezione problematica con copy migliorato (esempio concreto di 2-3 frasi)
2. **Tecnica da Applicare**: La tecnica specifica di copywriting/persuasione da usare (es. Pattern Interrupt, Future Pacing, Social Proof, Curiosity Loop, ecc.)
3. **Impatto Stimato**: Quanto potrebbe migliorare la retention in quel punto (basso/medio/alto)

## 🏆 Top 5 Azioni Prioritarie
Le 5 modifiche più impattanti ordinate per ROI potenziale, con:
- Cosa cambiare
- Perché
- Risultato atteso

## 📊 Valutazione Complessiva
- Score della VSL attuale (1-10)
- Score potenziale dopo le ottimizzazioni
- Bottleneck principale

Sii estremamente specifico e pratico. Non dare consigli generici. Ogni suggerimento deve essere direttamente applicabile alla trascrizione di QUESTA VSL. Rispondi in italiano.`;

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
      data.content?.[0]?.text || "Analisi non disponibile.";

    return NextResponse.json({ improvements: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
