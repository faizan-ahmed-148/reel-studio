import { NextResponse } from "next/server";
import { loadSettings, publicSettings, saveSettings, type Settings } from "@/lib/store";
import { reloadScheduler } from "@/lib/scheduler";
import { ALL_CATEGORIES } from "@/lib/topics";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(publicSettings(loadSettings()));
}

/** Partial update. Empty secret fields mean "keep the existing value". */
export async function POST(req: Request) {
  const body = await req.json();
  const s: Settings = loadSettings();
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : undefined);

  for (const k of ["groqModel", "niche", "handle", "hashtags", "voice", "voiceRate", "blockedHashtags"] as const) {
    const v = str(body[k]);
    if (v !== undefined) s[k] = v;
  }
  const groqKey = str(body.groqApiKey);
  if (groqKey) {
    if (!/^gsk_[A-Za-z0-9]{20,}$/.test(groqKey))
      return NextResponse.json({ error: "Yeh Groq API key nahi lagti — key 'gsk_' se shuru hoti hai (console.groq.com/keys)." }, { status: 400 });
    s.groqApiKey = groqKey;
  }
  if (Array.isArray(body.topicQueue)) s.topicQueue = body.topicQueue.map(String).map((t: string) => t.trim()).filter(Boolean);
  if (body.ttsProvider === "gemini" || body.ttsProvider === "edge") s.ttsProvider = body.ttsProvider;
  for (const k of ["geminiVoice", "geminiStyle", "geminiModel"] as const) {
    const v = str(body[k]);
    if (v) s[k] = v;
  }
  const gemKey = str(body.geminiApiKey);
  if (gemKey) {
    if (!/^[A-Za-z0-9._-]{20,}$/.test(gemKey))
      return NextResponse.json({ error: "Gemini key mein space ya ajeeb characters hain — aistudio.google.com/apikey se key dobara copy karein." }, { status: 400 });
    // verify with Google instead of guessing the key format
    const check = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": gemKey } })
      .then(async (r) => ({ ok: r.ok, msg: r.ok ? "" : ((await r.json().catch(() => ({}))) as any)?.error?.message ?? `HTTP ${r.status}` }))
      .catch((e) => ({ ok: false, msg: String(e) }));
    if (!check.ok) return NextResponse.json({ error: `Gemini key kaam nahi kar rahi: ${check.msg}` }, { status: 400 });
    s.geminiApiKey = gemKey;
  }

  if (typeof body.autoPublish === "boolean") s.autoPublish = body.autoPublish;
  if (body.enabled) s.enabled = { ...s.enabled, ...body.enabled };

  if (body.meta) {
    const appId = str(body.meta.appId);
    if (appId !== undefined) {
      if (appId && !/^\d{5,20}$/.test(appId))
        return NextResponse.json({ error: "Meta App ID sirf numbers hoti hai (developers.facebook.com → App settings → Basic)." }, { status: 400 });
      s.meta.appId = appId;
    }
    const sec = str(body.meta.appSecret);
    if (sec) {
      if (!/^[0-9a-f]{32}$/.test(sec))
        return NextResponse.json({ error: "Meta App Secret 32 characters (0-9, a-f) ka hota hai — App settings → Basic → Show se copy karein." }, { status: 400 });
      s.meta.appSecret = sec;
    }
    if (str(body.meta.graphVersion)) s.meta.graphVersion = str(body.meta.graphVersion)!;
    if (str(body.meta.selectedPageId) !== undefined) s.meta.selectedPageId = str(body.meta.selectedPageId)!;
  }
  if (body.linkedin) {
    const liId = str(body.linkedin.clientId);
    if (liId !== undefined) {
      if (liId && !/^[A-Za-z0-9]{8,30}$/.test(liId))
        return NextResponse.json({ error: "LinkedIn Client ID mein sirf letters/numbers hote hain." }, { status: 400 });
      s.linkedin.clientId = liId;
    }
    if (str(body.linkedin.clientSecret)) s.linkedin.clientSecret = str(body.linkedin.clientSecret)!;
    if (str(body.linkedin.apiVersion)) s.linkedin.apiVersion = str(body.linkedin.apiVersion)!;
  }
  if (body.youtube) {
    const ytId = str(body.youtube.clientId);
    if (ytId !== undefined) {
      if (ytId && !/\.apps\.googleusercontent\.com$/.test(ytId))
        return NextResponse.json({ error: "Google Client ID '...apps.googleusercontent.com' par khatam hoti hai." }, { status: 400 });
      s.youtube.clientId = ytId;
    }
    if (str(body.youtube.clientSecret)) s.youtube.clientSecret = str(body.youtube.clientSecret)!;
    if (["public", "unlisted", "private"].includes(body.youtube.privacy)) s.youtube.privacy = body.youtube.privacy;
  }
  if (typeof body.aiLabel === "boolean") s.aiLabel = body.aiLabel;
  if (body.musicMode === "auto" || body.musicMode === "off") s.musicMode = body.musicMode;
  if (typeof body.musicVolume === "number") s.musicVolume = Math.max(0, Math.min(0.6, body.musicVolume));
  if (body.customTopics && typeof body.customTopics === "object") {
    s.customTopics = Object.fromEntries(
      Object.entries(body.customTopics as Record<string, unknown>)
        .map(([k, v]) => [String(k).trim().slice(0, 40), Array.isArray(v) ? v.map((t) => String(t).trim().slice(0, 100)).filter(Boolean) : []])
        .filter(([k, v]) => k && (v as string[]).length),
    );
  }
  if (Array.isArray(body.categories))
    s.categories = body.categories.map(String).filter((c: string) => ALL_CATEGORIES.includes(c) || s.customTopics[c]?.length);
  if (body.schedule) {
    const sc = body.schedule;
    if (typeof sc.enabled === "boolean") s.schedule.enabled = sc.enabled;
    if (Array.isArray(sc.days)) s.schedule.days = sc.days.map(Number).filter((d: number) => d >= 0 && d <= 6);
    if (Array.isArray(sc.times)) s.schedule.times = sc.times.map(String).filter((t: string) => /^\d{1,2}:\d{2}$/.test(t.trim()));
    if (str(sc.timezone)) s.schedule.timezone = str(sc.timezone)!;
  }
  saveSettings(s);
  reloadScheduler();
  return NextResponse.json(publicSettings(s));
}
