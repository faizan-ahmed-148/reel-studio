import fs from "node:fs";
import path from "node:path";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { createCanvas } from "@napi-rs/canvas";
import { edgeFallback, geminiReel, synthesize, voiceSpec, type VoiceSpec } from "./tts";
import type { Settings } from "./store";
import { mixAudio } from "./audio";
import type { ReelScript } from "./script";
import { drawFrame, registerFonts, subtitleChunks, W, H, type SceneTiming } from "./scenes";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";
const FPS = 30;
const GAP = 0.12; // tiny breath between scenes (no dead air)
const TRIM = "silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse";

// ---------------------------------------------------------------- audio
/** Kept for the voice-preview route. */
export async function tts(text: string, voice: string, rate: string, dir: string): Promise<string> {
  return synthesize(text, { provider: "edge", voice, rate, style: "", geminiKey: "", geminiModel: "" }, dir);
}

async function duration(file: string): Promise<number> {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return parseFloat(stdout.trim());
}

async function ff(args: string[]) {
  try {
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg failed: ${(err.stderr || err.message).slice(-1500)}`);
  }
}

// ---------------------------------------------------------------- render
export async function buildVideo(
  script: ReelScript, settings: Settings, workdir: string, onProgress: (msg: string) => void = () => {},
): Promise<string> {
  registerFonts();
  fs.mkdirSync(workdir, { recursive: true });
  const n = script.scenes.length;

  // 1) voice-over per scene (whole reel uses ONE voice; if Gemini fails, redo everything with Edge)
  let spec: VoiceSpec = voiceSpec(settings);
  let mp3s: string[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      mp3s = [];
      if (spec.provider === "gemini") {
        onProgress(`Voice-over (Gemini ${spec.voice}): poori reel ek request mein…`);
        mp3s = await geminiReel(script.scenes.map((s) => s.narration), spec, workdir);
      } else {
        for (let i = 0; i < n; i++) {
          onProgress(`Voice-over (${spec.voice}): scene ${i + 1}/${n}`);
          mp3s.push(await synthesize(script.scenes[i].narration, spec, path.join(workdir, `a${i}`)));
        }
      }
      break;
    } catch (e) {
      if (spec.provider !== "gemini") throw e;
      console.warn("[reel-studio] Gemini TTS failed, falling back to Edge:", e instanceof Error ? e.message : e);
      onProgress("Gemini voice fail — Edge voice se bana rahe hain…");
      spec = edgeFallback(settings);
    }
  }
  const timings: SceneTiming[] = [];
  const wavs: string[] = [];
  const cuts: number[] = [];
  let clock = 0;
  for (let i = 0; i < n; i++) {
    const sc = script.scenes[i];
    // trim silence at both ends so scenes flow straight into each other
    const trimmed = path.join(workdir, `t${i}.wav`);
    await ff(["-i", mp3s[i], "-af", TRIM, "-ar", "44100", "-ac", "2", trimmed]);
    const speech = await duration(trimmed);
    const frames = Math.round(Math.max(speech + GAP, i === 0 ? 2.2 : 1.6) * FPS);
    const dur = frames / FPS;
    const wav = path.join(workdir, `a${i}.wav`);
    await ff(["-i", trimmed, "-af", "apad", "-t", dur.toFixed(4), "-ar", "44100", "-ac", "2", wav]);
    wavs.push(wav);
    timings.push({ dur, speech, chunks: subtitleChunks(sc.subtitle || sc.heading) });
    if (i > 0) cuts.push(clock);
    clock += dur;
  }
  const list = path.join(workdir, "audio.txt");
  fs.writeFileSync(list, wavs.map((w) => `file '${path.basename(w)}'`).join("\n"));
  const voice = path.join(workdir, "voice.wav");
  await ff(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", voice]);
  onProgress("Music + sound effects mix ho rahe hain…");
  const mix = path.join(workdir, "mix.wav");
  await mixAudio(voice, clock, cuts, settings.musicMode, settings.musicVolume, mix);

  // 2) stream raw frames into ffmpeg
  const final = path.join(workdir, "reel.mp4");
  const args = [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${W}x${H}`, "-r", String(FPS), "-i", "pipe:0",
    "-i", mix, "-map", "0:v", "-map", "1:a",
    // AI disclosure in the file metadata
    "-metadata", "comment=AI-generated content (script, voice and visuals made with AI)",
    "-metadata", "description=AI-generated educational video",
    // Reels/Shorts spec: H.264 High 4.1, keyframe every 2s, AAC 128k @ 48kHz
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-maxrate", "6M", "-bufsize", "12M", "-pix_fmt", "yuv420p",
    "-profile:v", "high", "-level", "4.1", "-g", String(FPS * 2), "-keyint_min", String(FPS * 2), "-sc_threshold", "0",
    "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-shortest", "-movflags", "+faststart", final,
  ];
  const proc = spawn(FFMPEG, args, { stdio: ["pipe", "ignore", "pipe"] });
  let stderr = "";
  proc.stderr.on("data", (d) => (stderr += d.toString()));
  const done = new Promise<void>((resolve, reject) => {
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg render failed (${code}): ${stderr.slice(-1500)}`))));
  });
  const write = (buf: Buffer) =>
    new Promise<void>((resolve, reject) => {
      if (proc.stdin.destroyed) return reject(new Error(`ffmpeg closed early: ${stderr.slice(-800)}`));
      proc.stdin.write(buf, (err) => (err ? reject(err) : resolve()));
    });

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  const info = {
    topic: script.topic, category: script.category || "Software", handle: settings.handle,
    sceneIdx: 0, sceneCount: n, hook: script.hook,
  };
  let globalT = 0;
  try {
    for (let i = 0; i < n; i++) {
      onProgress(`Animation render: scene ${i + 1}/${n}`);
      info.sceneIdx = i;
      const frames = Math.round(timings[i].dur * FPS);
      for (let f = 0; f < frames; f++) {
        const t = f / FPS;
        drawFrame(ctx, info, script.scenes[i], timings[i], t, globalT);
        globalT += 1 / FPS;
        await write(canvas.data());
        if (i === 0 && f === Math.round(FPS * 1.8)) fs.writeFileSync(path.join(workdir, "thumb.jpg"), canvas.toBuffer("image/jpeg", 80));
      }
    }
  } finally {
    proc.stdin.end();
  }
  onProgress("Final video encode ho rahi hai…");
  await done;

  for (const f of fs.readdirSync(workdir)) {
    if (!["reel.mp4", "script.json", "thumb.jpg"].includes(f)) fs.rmSync(path.join(workdir, f), { recursive: true, force: true });
  }
  return final;
}
