import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), ".data");
const KEYWORDS_FILE = path.join(DATA_DIR, "keywords.json");

type SavedKeywords = Record<string, string[]>; // appId -> keyword terms

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // already exists
  }
}

async function readKeywords(): Promise<SavedKeywords> {
  try {
    const data = await fs.readFile(KEYWORDS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function writeKeywords(data: SavedKeywords) {
  await ensureDataDir();
  await fs.writeFile(KEYWORDS_FILE, JSON.stringify(data, null, 2));
}

// GET: load saved keywords for an app
export async function GET(req: NextRequest) {
  const appId = req.nextUrl.searchParams.get("appId") ?? "";
  if (!appId) return NextResponse.json({ keywords: [] });

  const all = await readKeywords();
  return NextResponse.json({ keywords: all[appId] ?? [] });
}

// POST: save keywords for an app
export async function POST(req: NextRequest) {
  const { appId, keywords } = (await req.json()) as {
    appId: string;
    keywords: string[];
  };

  if (!appId) {
    return NextResponse.json({ error: "appId required" }, { status: 400 });
  }

  const all = await readKeywords();
  all[appId] = keywords;
  await writeKeywords(all);

  return NextResponse.json({ ok: true });
}
