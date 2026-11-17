import { NextResponse } from "next/server";
import { loadSettings } from "@/lib/store";
import { listGroqModels } from "@/lib/script";

export const dynamic = "force-dynamic";

/** Lists chat models for the saved key (also works as a "test key" check). */
export async function GET() {
  const s = loadSettings();
  if (!s.groqApiKey) return NextResponse.json({ ok: false, error: "Groq key save nahi hui." });
  try {
    return NextResponse.json({ ok: true, models: await listGroqModels(s.groqApiKey) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
  }
}
