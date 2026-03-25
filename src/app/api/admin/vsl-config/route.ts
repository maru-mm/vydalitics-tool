import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const CONFIG_PATH = path.join(process.cwd(), "data", "vsl-config.json");
const BLOB_KEY = "vsl-config.json";

interface VslConfig {
  hiddenVideoIds: string[];
}

function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function readConfigFromBlob(): Promise<VslConfig> {
  const { list } = await import("@vercel/blob");
  const { blobs } = await list({ prefix: BLOB_KEY, limit: 1 });
  if (blobs.length > 0) {
    const response = await fetch(blobs[0].url);
    return await response.json();
  }
  return { hiddenVideoIds: [] };
}

async function writeConfigToBlob(config: VslConfig): Promise<void> {
  const { put } = await import("@vercel/blob");
  await put(BLOB_KEY, JSON.stringify(config), {
    access: "public",
    addRandomSuffix: false,
  });
}

async function readConfigFromFile(): Promise<VslConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { hiddenVideoIds: [] };
  }
}

async function writeConfigToFile(config: VslConfig): Promise<void> {
  await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

async function readConfig(): Promise<VslConfig> {
  try {
    if (useBlob()) return await readConfigFromBlob();
    return await readConfigFromFile();
  } catch {
    return { hiddenVideoIds: [] };
  }
}

async function writeConfig(config: VslConfig): Promise<void> {
  if (useBlob()) return await writeConfigToBlob(config);
  return await writeConfigToFile(config);
}

function isAdminRequest(req: NextRequest): boolean {
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) return false;
  const authHeader = req.headers.get("x-admin-password");
  return authHeader === adminPassword;
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  if (!isAdminRequest(req)) {
    return NextResponse.json({ error: "Non autorizzato" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { hiddenVideoIds } = body;

    if (!Array.isArray(hiddenVideoIds)) {
      return NextResponse.json(
        { error: "hiddenVideoIds deve essere un array" },
        { status: 400 }
      );
    }

    const config: VslConfig = { hiddenVideoIds };
    await writeConfig(config);
    return NextResponse.json({ ok: true, config });
  } catch {
    return NextResponse.json({ error: "Errore nel salvataggio" }, { status: 500 });
  }
}
