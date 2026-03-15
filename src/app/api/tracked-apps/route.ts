import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import type { TrackedApp } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), ".data");
const APPS_FILE = path.join(DATA_DIR, "tracked-apps.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

async function readApps(): Promise<TrackedApp[]> {
  try {
    const data = await fs.readFile(APPS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeApps(apps: TrackedApp[]) {
  await ensureDataDir();
  await fs.writeFile(APPS_FILE, JSON.stringify(apps, null, 2));
}

// GET: load all tracked apps
export async function GET() {
  const apps = await readApps();
  return NextResponse.json({ apps });
}

// POST: save all tracked apps
export async function POST(req: NextRequest) {
  const { apps } = (await req.json()) as { apps: TrackedApp[] };

  if (!Array.isArray(apps)) {
    return NextResponse.json({ error: "apps array required" }, { status: 400 });
  }

  await writeApps(apps);
  return NextResponse.json({ ok: true });
}
