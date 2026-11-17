import fs from "node:fs";
import { Readable } from "node:stream";
import { getEntry } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = getEntry(id);
  if (!entry?.video || !fs.existsSync(entry.video)) return new Response("Not found", { status: 404 });
  const size = fs.statSync(entry.video).size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") ?? "");
  const stream = (start: number, end: number) =>
    Readable.toWeb(fs.createReadStream(entry.video!, { start, end })) as unknown as ReadableStream;
  const download = new URL(req.url).searchParams.has("download");
  const base: Record<string, string> = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    ...(download ? { "Content-Disposition": `attachment; filename="reel-${id}.mp4"` } : {}),
  };
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    return new Response(stream(start, end), {
      status: 206,
      headers: { ...base, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1) },
    });
  }
  return new Response(stream(0, size - 1), { headers: { ...base, "Content-Length": String(size) } });
}
