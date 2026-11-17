import fs from "node:fs";
import path from "node:path";
import { getEntry } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const e = getEntry(id);
  const file = e?.video ? path.join(path.dirname(e.video), "thumb.jpg") : "";
  if (!file || !fs.existsSync(file)) return new Response("Not found", { status: 404 });
  return new Response(fs.readFileSync(file), { headers: { "Content-Type": "image/jpeg" } });
}
