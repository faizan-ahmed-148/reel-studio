import { NextResponse } from "next/server";
import { deleteHistory, getEntry } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getEntry(id);
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (["generating", "rendering", "publishing"].includes(e.status)) return NextResponse.json({ error: "Abhi chal rahi hai" }, { status: 409 });
  deleteHistory(id);
  return NextResponse.json({ ok: true });
}
