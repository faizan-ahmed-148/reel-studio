import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DATA_DIR, loadSettings } from "@/lib/store";
import { GEMINI_VOICES, SAMPLE, VOICES, voiceScript } from "@/lib/voices";
import { synthesize, type VoiceSpec } from "@/lib/tts";

export const dynamic = "force-dynamic";

/** GET /api/voice-preview?provider=gemini|edge&voice=...&rate=%2B5%25 -> audio sample (cached per settings). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const s = loadSettings();
  const provider = q.get("provider") === "gemini" ? "gemini" : "edge";
  const voice = q.get("voice") ?? "";
  const rate = /^[+-]\d{1,3}%$/.test(q.get("rate") ?? "") ? q.get("rate")! : "+0%";
  if (provider === "gemini" && !GEMINI_VOICES.some(([v]) => v === voice)) return new Response("Unknown voice", { status: 400 });
  if (provider === "edge" && !VOICES.some((v) => v.id === voice)) return new Response("Unknown voice", { status: 400 });
  if (provider === "gemini" && !s.geminiApiKey) return new Response("Pehle Gemini API key save karein.", { status: 400 });

  const spec: VoiceSpec = { provider, voice, rate, style: s.geminiStyle, geminiKey: s.geminiApiKey, geminiModel: s.geminiModel };
  const text = SAMPLE[provider === "gemini" ? "devanagari" : voiceScript(voice)];
  const hash = crypto.createHash("sha1").update(JSON.stringify([provider, voice, rate, provider === "gemini" ? s.geminiStyle + s.geminiModel : ""])).digest("hex").slice(0, 12);
  const dir = path.join(DATA_DIR, "voice-samples", `${voice}_${hash}`);
  const cached = ["audio.wav", "audio.mp3"].map((f) => path.join(dir, f)).find((f) => fs.existsSync(f));
  let file = cached ?? "";
  if (!file) {
    try {
      file = await synthesize(text, spec, dir);
    } catch (e) {
      return new Response(e instanceof Error ? e.message : String(e), { status: 502 });
    }
  }
  return new Response(fs.readFileSync(file), {
    headers: { "Content-Type": file.endsWith(".wav") ? "audio/wav" : "audio/mpeg", "Cache-Control": "no-store" },
  });
}
