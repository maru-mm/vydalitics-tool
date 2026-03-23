import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "GOOGLE_GEMINI_API_KEY not configured" },
      { status: 500 }
    );
  }

  const body = await req.json();
  const {
    videoName,
    timestamp,
    timestampLabel,
    dropPct,
    retentionBefore,
    retentionAfter,
    transcriptContext,
    frameBase64,
  } = body;

  const parts: Array<
    { text: string } | { inline_data: { mime_type: string; data: string } }
  > = [];

  if (frameBase64) {
    const base64Data = frameBase64.replace(/^data:image\/\w+;base64,/, "");
    parts.push({
      inline_data: {
        mime_type: "image/jpeg",
        data: base64Data,
      },
    });
  }

  const prompt = frameBase64
    ? `Sei un analista visivo esperto di Video Sales Letters (VSL). Ti viene mostrato il frame esatto al timestamp ${timestampLabel} (secondo ${timestamp}) del video "${videoName}", dove c'è un drop del ${dropPct?.toFixed(1)}% degli spettatori (retention: ${retentionBefore?.toFixed(1)}% → ${retentionAfter?.toFixed(1)}%).

${transcriptContext ? `In questo momento il narratore sta dicendo: "${transcriptContext}"` : ""}

ANALIZZA IL FRAME E DESCRIVI IN DETTAGLIO COSA SI VEDE. Rispondi SOLO con quello che è visivamente presente nell'immagine:

### Elementi Visivi Presenti
Elenca e descrivi OGNI elemento visibile nel frame:
- **Persone**: Chi appare? Come sono vestiti? Espressione facciale? Postura? Linguaggio del corpo?
- **Testo sullo schermo**: Riporta ESATTAMENTE ogni parola/testo/titolo/headline visibile nel frame
- **Grafiche/Slide**: Ci sono slide, grafici, diagrammi, immagini sovrapposte? Descrivili nel dettaglio
- **Sfondo/Ambientazione**: Dove è girata la scena? (studio, casa, ufficio, schermo di registrazione, ecc.)
- **Colori dominanti**: Quali colori prevalgono nel frame?
- **Layout**: Come è composto il frame? (facecam + slide, solo slide, solo persona, schermo condiviso, ecc.)

### Qualità Produzione
- Illuminazione (professionale, naturale, scarsa)
- Risoluzione/nitidezza percepita
- Presenza di elementi grafici brandizzati (logo, lower third, ecc.)

### Possibile Impatto Visivo sul Drop
Basandoti SOLO su ciò che vedi, quale elemento visivo potrebbe causare l'abbandono degli spettatori in questo punto? (es. slide troppo piena di testo, assenza di varietà visiva, frame statico, scarsa qualità, ecc.)

Sii estremamente specifico e oggettivo. Descrivi SOLO quello che vedi realmente nel frame. Non inventare. Rispondi in italiano.`
    : `Sei un analista di Video Sales Letters (VSL). Al timestamp ${timestampLabel} (secondo ${timestamp}) del video "${videoName}" c'è un drop del ${dropPct?.toFixed(1)}% degli spettatori.

${transcriptContext ? `Il narratore sta dicendo: "${transcriptContext}"` : "Trascrizione non disponibile."}

NOTA: Il frame del video non è disponibile per questo timestamp. Fornisci un'analisi basata SOLO sulla trascrizione e sul contesto temporale.

### Analisi del Contenuto
- In che fase della VSL siamo probabilmente? (hook, problema, agitazione, soluzione, prova sociale, offerta, CTA, ecc.)
- Cosa sta comunicando il narratore in questo punto?

### Possibili Cause del Drop
Basandoti sul testo e sulla posizione temporale nel video, perché gli spettatori potrebbero abbandonare qui?

Sii breve e pratico. Rispondi in italiano.`;

  parts.push({ text: prompt });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Gemini API error: ${errText}` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Analisi non disponibile.";

    return NextResponse.json({ analysis: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
