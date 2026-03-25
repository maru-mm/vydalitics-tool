import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.AI_BACKEND_URL || "http://localhost:8100";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const res = await fetch(`${BACKEND_URL}/knowledge/${id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: res.status }
      );
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "AI Backend unreachable" },
      { status: 502 }
    );
  }
}
