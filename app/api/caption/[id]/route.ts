import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getEntry, loadSettings, PLATFORMS, upsertHistory } from "@/lib/store";
import { generateCaptions } from "@/lib/caption";
import type { ReelScript } from "@/lib/script";

export const dynamic = "force-dynamic";

/** POST = regenerate captions with Groq. PUT {captions} = save manual edits. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getEntry(id);
  const file = entry?.video ? path.join(path.dirname(entry.video), "script.json") : "";
  if (!entry || !file || !fs.existsSync(file)) return NextResponse.json({ error: "Script nahi mili" }, { status: 404 });
  const script = JSON.parse(fs.readFileSync(file, "utf8")) as ReelScript;
  const cap = await generateCaptions(script, loadSettings());
  entry.captions = cap.captions;
  entry.youtubeTitle = cap.youtubeTitle;
  entry.caption = cap.captions.instagram;
  upsertHistory(entry);
  return NextResponse.json(entry);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json();
  entry.captions = { ...entry.captions };
  for (const p of PLATFORMS) if (typeof body.captions?.[p] === "string") entry.captions[p] = body.captions[p].slice(0, 3000);
  if (typeof body.youtubeTitle === "string" && body.youtubeTitle.trim()) entry.youtubeTitle = body.youtubeTitle.trim().slice(0, 100);
  entry.caption = entry.captions.instagram ?? entry.caption;
  upsertHistory(entry);
  return NextResponse.json(entry);
}
