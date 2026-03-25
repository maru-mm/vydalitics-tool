import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

function isAdminRequest(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  return req.headers.get("x-admin-password") === adminPassword;
}

async function readAllowedFolders(): Promise<string[]> {
  const sb = getSupabase();
  if (!sb) return [];

  const { data, error } = await sb
    .from("app_config")
    .select("value")
    .eq("key", "allowed_folder_ids")
    .single();

  if (error || !data) return [];
  return Array.isArray(data.value) ? data.value : [];
}

async function writeAllowedFolders(ids: string[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Supabase not configured");

  const { error } = await sb
    .from("app_config")
    .upsert({ key: "allowed_folder_ids", value: ids }, { onConflict: "key" });

  if (error) throw new Error(`Supabase write error: ${error.message}`);
}

export async function GET() {
  try {
    const allowedFolderIds = await readAllowedFolders();
    return NextResponse.json({ allowedFolderIds });
  } catch {
    return NextResponse.json({ allowedFolderIds: [] });
  }
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { allowedFolderIds } = body;

    if (!Array.isArray(allowedFolderIds)) {
      return NextResponse.json(
        { error: "allowedFolderIds must be an array" },
        { status: 400 }
      );
    }

    await writeAllowedFolders(allowedFolderIds);
    return NextResponse.json({ ok: true, allowedFolderIds });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error saving";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
