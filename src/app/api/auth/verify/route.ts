import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { password } = await req.json();
  const appPassword = process.env.APP_PASSWORD;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!appPassword) {
    return NextResponse.json({ ok: true, role: "user" });
  }

  if (adminPassword && password === adminPassword) {
    return NextResponse.json({ ok: true, role: "admin" });
  }

  if (password === appPassword) {
    return NextResponse.json({ ok: true, role: "user" });
  }

  return NextResponse.json({ ok: false, error: "Password errata" }, { status: 401 });
}
