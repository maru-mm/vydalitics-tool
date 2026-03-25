import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.AI_BACKEND_URL || "http://localhost:8100";

export async function GET() {
  try {
    const res = await fetch(`${BACKEND_URL}/knowledge`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "AI Backend unreachable" },
      { status: 502 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "No file" }, { status: 400 });
    }

    const backendForm = new FormData();
    backendForm.append("file", file);

    const res = await fetch(`${BACKEND_URL}/knowledge/upload`, {
      method: "POST",
      body: backendForm,
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: errText || "Upload error" },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "AI Backend unreachable" },
      { status: 502 }
    );
  }
}
