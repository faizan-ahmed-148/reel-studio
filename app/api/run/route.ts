import { NextResponse } from "next/server";
import { isBusy, looksLikeSecret, runOnce } from "@/lib/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (isBusy()) return NextResponse.json({ error: "Ek video pehle se ban rahi hai, thora wait karein." }, { status: 409 });
  if (looksLikeSecret(body.topic))
    return NextResponse.json({ error: "Topic box mein API key paste ho gayi hai. Key ko Settings → Groq API key mein daalein." }, { status: 400 });
  // run in background; the dashboard polls /api/history
  void runOnce({ topic: body.topic, publish: typeof body.publish === "boolean" ? body.publish : undefined, trigger: "manual" });
  return NextResponse.json({ started: true });
}
