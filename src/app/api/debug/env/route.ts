import { NextResponse } from "next/server";

export async function GET() {
  const adminPw = process.env.ADMIN_PASSWORD;
  const appPw = process.env.APP_PASSWORD;

  return NextResponse.json({
    adminPassword: {
      isSet: !!adminPw,
      length: adminPw?.length ?? 0,
      firstChar: adminPw?.[0] ?? null,
      lastChar: adminPw?.[adminPw.length - 1] ?? null,
      value: adminPw ?? null,
    },
    appPassword: {
      isSet: !!appPw,
      length: appPw?.length ?? 0,
    },
  });
}
