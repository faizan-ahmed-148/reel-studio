import { NextResponse } from "next/server";
import { getEntry, PLATFORMS, type Platform } from "@/lib/store";
import { publishEntry } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 900;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const platforms = Array.isArray(body.platforms)
    ? (body.platforms as string[]).filter((p): p is Platform => (PLATFORMS as string[]).includes(p))
    : undefined;
  try {
    return NextResponse.json(await publishEntry(entry, platforms));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
