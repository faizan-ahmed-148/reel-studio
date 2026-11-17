/**
 * Voice-over engines.
 *  - gemini: Google Gemini TTS (free tier, very natural, style controlled by a prompt)
 *  - edge:   Microsoft Edge neural voices (free, unlimited, no key, more robotic)
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Settings } from "./store";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const GEMINI = "https://generativelanguage.googleapis.com/v1beta";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface VoiceSpec {
  provider: "gemini" | "edge";
  voice: string; // gemini voice name or edge voice id
  rate: string; // edge only, e.g. "+5%"
  style: string; // gemini only
  geminiKey: string;
  geminiModel: string;
}

export function voiceSpec(s: Settings): VoiceSpec {
  const provider = s.ttsProvider === "gemini" && s.geminiApiKey ? "gemini" : "edge";
  // without a Gemini key we use Edge; the narration is Devanagari then, so pick a voice that reads it
  const edgeVoice = provider === "edge" && s.ttsProvider === "gemini" && s.voice.startsWith("ur-") ? "hi-IN-MadhurNeural" : s.voice;
  return {
    provider,
    voice: provider === "gemini" ? s.geminiVoice : edgeVoice,
    rate: s.voiceRate,
    style: s.geminiStyle,
    geminiKey: s.geminiApiKey,
    geminiModel: s.geminiModel,
  };
}

// ---------------------------------------------------------------- edge
async function edgeTts(text: string, voice: string, rate: string, dir: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const t = new MsEdgeTTS();
    try {
      await t.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
      const { audioFilePath } = await t.toFile(dir, text, { rate });
      if (fs.statSync(audioFilePath).size < 1000) throw new Error("TTS returned empty audio");
      return audioFilePath;
    } catch (e) {
      lastErr = e;
      await sleep(1500);
    } finally {
      t.close();
    }
  }
  throw new Error(`Edge voice-over failed (${voice}): ${lastErr instanceof Error ? lastErr.message : lastErr}`);
}

// ---------------------------------------------------------------- gemini
export class QuotaError extends Error {}

/** Finds the first base64 audio payload anywhere in a JSON response. */
function findAudio(obj: unknown): { data: string; mime?: string } | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const mime = (o.mime_type ?? o.mimeType) as string | undefined;
  if (typeof o.data === "string" && o.data.length > 100 && (o.type === "audio" || mime?.startsWith("audio"))) return { data: o.data, mime };
  for (const v of Object.values(o)) {
    const found = findAudio(v);
    if (found) return found;
  }
  return null;
}

async function geminiRequest(url: string, key: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  if (!res.ok) {
    const msg = json?.error?.message || text.slice(0, 400);
    if (res.status === 429 || /quota|rate limit|RESOURCE_EXHAUSTED/i.test(msg)) throw new QuotaError(`Gemini TTS quota khatam: ${msg}`);
    const err = new Error(`Gemini TTS ${res.status}: ${msg}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return json;
}

async function geminiTts(text: string, v: VoiceSpec, dir: string): Promise<string> {
  const style = v.style.trim();
  let audio: { data: string; mime?: string } | null = null;
  try {
    // current API (Interactions)
    const json = await geminiRequest(`${GEMINI}/interactions`, v.geminiKey, {
      model: v.geminiModel,
      input: [{
        type: "user_input",
        content: [{ type: "text", text, ...(style ? { annotations: [{ type: "speech_metadata", style }] } : {}) }],
      }],
      response_format: { type: "audio" },
      generation_config: { speech_config: [{ voice: v.voice }] },
    });
    audio = findAudio(json);
  } catch (e) {
    if (e instanceof QuotaError) throw e;
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 403 || /API key not valid|API_KEY_INVALID|PERMISSION_DENIED/i.test((e as Error).message)) throw e;
    // older API shape (generateContent) as fallback
    const json = await geminiRequest(`${GEMINI}/models/gemini-2.5-flash-preview-tts:generateContent`, v.geminiKey, {
      contents: [{ parts: [{ text: style ? `${style}:\n${text}` : text }] }],
      generationConfig: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: v.voice } } },
      },
    }).catch((e2) => { throw e2 instanceof QuotaError ? e2 : new Error(`${(e as Error).message} | ${(e2 as Error).message}`); });
    const part = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData?.data);
    if (part) audio = { data: part.inlineData.data, mime: part.inlineData.mimeType };
  }
  if (!audio) throw new Error("Gemini TTS ne audio wapas nahi diya");
  const buf = Buffer.from(audio.data, "base64");
  const out = path.join(dir, "audio.wav");
  if (buf.subarray(0, 4).toString("ascii") === "RIFF") {
    fs.writeFileSync(out, buf);
  } else {
    // headerless 16-bit PCM
    const rate = Number(/rate=(\d+)/.exec(audio.mime ?? "")?.[1] ?? 24000);
    const raw = path.join(dir, "audio.pcm");
    fs.writeFileSync(raw, buf);
    await run(FFMPEG, ["-y", "-loglevel", "error", "-f", "s16le", "-ar", String(rate), "-ac", "1", "-i", raw, out]);
    fs.rmSync(raw);
  }
  return out;
}

async function geminiWithRetry(text: string, v: VoiceSpec, dir: string): Promise<string> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await geminiTts(text, v, dir);
    } catch (e) {
      lastErr = e;
      const status = (e as { status?: number }).status;
      if (status === 400 || status === 401 || status === 403 || status === 404) break;
      if (e instanceof QuotaError && /per day|daily|RPD/i.test(e.message)) break; // daily quota: waiting won't help
      await sleep(e instanceof QuotaError ? 20_000 : 2_000); // per-minute limits reset quickly
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------- entry
export async function synthesize(text: string, v: VoiceSpec, dir: string): Promise<string> {
  fs.mkdirSync(dir, { recursive: true });
  return v.provider === "gemini" ? geminiWithRetry(text, v, dir) : edgeTts(text, v.voice, v.rate, dir);
}

/** Edge voice that can read the same narration script, used when Gemini is unavailable. */
export function edgeFallback(s: Settings): VoiceSpec {
  const devanagariVoice = s.voice.startsWith("ur-") ? "hi-IN-MadhurNeural" : s.voice;
  return { provider: "edge", voice: devanagariVoice, rate: s.voiceRate, style: "", geminiKey: "", geminiModel: "" };
}

// ---------------------------------------------------------------- whole reel in ONE Gemini request
const GEMINI_TTS_MODELS = ["gemini-3.8-flash-tts", "gemini-3.8-flash-lite-tts"];

async function silences(file: string): Promise<{ start: number; end: number }[]> {
  const { stderr } = await run(FFMPEG, ["-hide_banner", "-i", file, "-af", "silencedetect=noise=-38dB:d=0.15", "-f", "null", "-"], { maxBuffer: 20 * 1024 * 1024 });
  const out: { start: number; end: number }[] = [];
  let start: number | null = null;
  for (const line of stderr.split("\n")) {
    const s = /silence_start: ([\d.]+)/.exec(line);
    const e = /silence_end: ([\d.]+)/.exec(line);
    if (s) start = parseFloat(s[1]);
    if (e && start !== null) { out.push({ start, end: parseFloat(e[1]) }); start = null; }
  }
  return out;
}

async function audioDuration(file: string): Promise<number> {
  const { stdout } = await run(process.env.FFPROBE_PATH || "ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return parseFloat(stdout.trim());
}

/**
 * Speaks all scenes in one request (free tier = ~10 requests/day), then cuts the audio
 * at the pauses closest to where each scene should end (by word share).
 */
export async function geminiReel(texts: string[], v: VoiceSpec, workdir: string): Promise<string[]> {
  const dir = path.join(workdir, "gemini");
  fs.mkdirSync(dir, { recursive: true });
  const style = `${v.style.trim()} Har paragraph ke baad ek second ka saaf pause lo.`.trim();
  const text = texts.join("\n\n");
  let full = "";
  let lastErr: unknown;
  const models = [v.geminiModel, ...GEMINI_TTS_MODELS.filter((m) => m !== v.geminiModel)];
  for (const model of models) {
    try {
      full = await geminiWithRetry(text, { ...v, geminiModel: model, style }, dir);
      break;
    } catch (e) {
      lastErr = e;
      if (!(e instanceof QuotaError)) throw e; // only switch model when this one's quota is used up
    }
  }
  if (!full) throw lastErr;

  const total = await audioDuration(full);
  const words = texts.map((t) => t.split(/\s+/).filter(Boolean).length);
  const sum = words.reduce((a, b) => a + b, 0);
  const gaps = (await silences(full)).filter((g) => g.start > 0.3 && g.end < total - 0.1);
  const cuts: number[] = [];
  let acc = 0, prev = 0;
  for (let i = 0; i < texts.length - 1; i++) {
    acc += words[i];
    const expected = (acc / sum) * total;
    // prefer long pauses near the expected boundary, keep cuts in order
    let best: { t: number; score: number } | null = null;
    for (const g of gaps) {
      const mid = (g.start + g.end) / 2;
      if (mid <= prev + 0.8) continue;
      const score = Math.abs(mid - expected) - 2.5 * (g.end - g.start);
      if (!best || score < best.score) best = { t: mid, score };
    }
    const t = best && Math.abs(best.t - expected) < total * 0.12 ? best.t : expected;
    cuts.push(t);
    prev = t;
  }
  const bounds = [0, ...cuts, total];
  const files: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const out = path.join(dir, `seg${i}.wav`);
    await run(FFMPEG, ["-y", "-loglevel", "error", "-i", full, "-ss", bounds[i].toFixed(3), "-to", bounds[i + 1].toFixed(3),
      // trim leading/trailing silence of each piece so scene timing follows the speech
      "-af", "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse",
      out]);
    files.push(out);
  }
  return files;
}
