import { NextRequest, NextResponse } from "next/server";
import {
  VidalyticsClient,
  MediaUrlAvailableError,
} from "@/lib/vidalytics-api";
import { transcribeFromUrl } from "@/lib/whisper";

export const maxDuration = 300; // 5 min for long transcriptions

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token =
    req.headers.get("x-api-token") || process.env.VIDALYTICS_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "API token required" }, { status: 401 });
  }

  const openaiKey =
    req.headers.get("x-openai-key") || process.env.OPENAI_API_KEY;

  const client = new VidalyticsClient(token);
  const { id } = await params;

  // Strategy 1+2: Try built-in captions / embed VTT
  try {
    const script = await client.getVideoScript(id);
    return NextResponse.json(script);
  } catch (e: unknown) {
    // If MediaUrlAvailableError, we have a media URL to transcribe with Whisper
    if (e instanceof MediaUrlAvailableError && openaiKey) {
      try {
        const result = await transcribeFromUrl(e.mediaUrl, openaiKey);
        return NextResponse.json(result);
      } catch (whisperErr: unknown) {
        const msg =
          whisperErr instanceof Error
            ? whisperErr.message
            : "Whisper transcription error";
        return NextResponse.json(
          {
            error: msg,
            mediaUrl: e.mediaUrl,
            hint: "Whisper transcription failed. You can retry or check your OpenAI API key.",
          },
          { status: 500 }
        );
      }
    }

    // If we have a media URL but no OpenAI key, tell the user
    if (e instanceof MediaUrlAvailableError && !openaiKey) {
      return NextResponse.json(
        {
          error:
            "Captions unavailable. Configure the OpenAI API key in Settings to enable automatic Whisper transcription.",
          mediaUrl: e.mediaUrl,
          needsOpenAI: true,
        },
        { status: 422 }
      );
    }

    const msg =
      e instanceof Error
        ? e.message
        : "Error fetching script";
    return NextResponse.json({ error: msg }, { status: 404 });
  }
}
