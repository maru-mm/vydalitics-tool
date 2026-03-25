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
    ? `You are an expert visual analyst of Video Sales Letters (VSL). You are shown the exact frame at timestamp ${timestampLabel} (second ${timestamp}) of the video "${videoName}", where there is a ${dropPct?.toFixed(1)}% viewer drop (retention: ${retentionBefore?.toFixed(1)}% → ${retentionAfter?.toFixed(1)}%).

${transcriptContext ? `At this moment the narrator is saying: "${transcriptContext}"` : ""}

ANALYZE THE FRAME AND DESCRIBE IN DETAIL WHAT YOU SEE. Respond ONLY with what is visually present in the image:

### Visual elements present
List and describe EVERY visible element in the frame:
- **People**: Who appears? How are they dressed? Facial expression? Posture? Body language?
- **On-screen text**: Report EXACTLY every word/text/title/headline visible in the frame
- **Graphics/slides**: Are there slides, charts, diagrams, overlaid images? Describe them in detail
- **Background/setting**: Where was the scene shot? (studio, home, office, recording screen, etc.)
- **Dominant colors**: Which colors prevail in the frame?
- **Layout**: How is the frame composed? (facecam + slide, slide only, person only, shared screen, etc.)

### Production quality
- Lighting (professional, natural, poor)
- Perceived resolution/sharpness
- Presence of branded graphic elements (logo, lower third, etc.)

### Possible visual impact on the drop
Based ONLY on what you see, which visual element could cause viewers to drop off at this point? (e.g. slide too text-heavy, lack of visual variety, static frame, poor quality, etc.)

Be extremely specific and objective. Describe ONLY what you actually see in the frame. Do not make things up. Respond in English.`
    : `You are a Video Sales Letters (VSL) analyst. At timestamp ${timestampLabel} (second ${timestamp}) of the video "${videoName}" there is a ${dropPct?.toFixed(1)}% viewer drop.

${transcriptContext ? `The narrator is saying: "${transcriptContext}"` : "Transcript not available."}

NOTE: The video frame is not available for this timestamp. Provide an analysis based ONLY on the transcript and temporal context.

### Content analysis
- What phase of the VSL are we likely in? (hook, problem, agitation, solution, social proof, offer, CTA, etc.)
- What is the narrator communicating at this point?

### Possible causes of the drop
Based on the text and temporal position in the video, why might viewers drop off here?

Be brief and practical. Respond in English.`;

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
      "Analysis not available.";

    return NextResponse.json({ analysis: text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
