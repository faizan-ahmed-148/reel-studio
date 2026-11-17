/**
 * Music + sound design: background music (your own files or a generated lo-fi beat),
 * whoosh on scene changes, and voice-ducked final mix.
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { DATA_DIR } from "./store";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";

async function ff(args: string[]) {
  try {
    await run(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`ffmpeg (audio) failed: ${(err.stderr || err.message).slice(-1200)}`);
  }
}

// ---------------------------------------------------------------- generated assets
const SFX_DIR = path.join(DATA_DIR, "sfx");

/** 90 BPM lo-fi tech beat: kick + offbeat hats + soft Am-F-C-G pad (64s, loops cleanly). */
async function defaultMusic(): Promise<string> {
  const out = path.join(SFX_DIR, "default-beat-v1.wav");
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(SFX_DIR, { recursive: true });
  const B = "0.666667"; // one beat
  const kt = `mod(t,${B})`;
  const ht = `mod(t+0.333333,${B})`;
  const drums =
    `0.85*sin(2*PI*(46*${kt}+90*(1-exp(-30*${kt}))/30))*exp(-9*${kt})` +
    `+0.10*(random(0)*2-1)*exp(-70*${ht})`;
  const c = "mod(floor(t/5.333333),4)";
  const f1 = `if(eq(${c},0),220,if(eq(${c},1),174.61,196))`;
  const f2 = `if(eq(${c},0),261.63,if(eq(${c},1),220,if(eq(${c},2),261.63,246.94)))`;
  const f3 = `if(eq(${c},0),329.63,if(eq(${c},1),261.63,if(eq(${c},2),329.63,293.66)))`;
  const env = "min(1,mod(t,5.333333)*3)*min(1,(5.333333-mod(t,5.333333))*3)";
  const pad = `${env}*(0.18*sin(2*PI*${f1}/2*t)+0.07*(sin(2*PI*${f1}*t)+sin(2*PI*${f2}*t)+0.8*sin(2*PI*${f3}*t)))*(0.85+0.15*sin(2*PI*0.5*t))`;
  await ff([
    "-f", "lavfi", "-i", `aevalsrc='${drums}':s=44100:d=64`,
    "-f", "lavfi", "-i", `aevalsrc='${pad}':s=44100:d=64`,
    "-filter_complex",
    "[0:a]highpass=f=35,volume=0.9[d];[1:a]lowpass=f=1400,aecho=0.8:0.5:280:0.25[p];[d][p]amix=inputs=2,volume=2,pan=stereo|c0=c0|c1=c0[o]",
    "-map", "[o]", "-ar", "44100", out,
  ]);
  return out;
}

/** Short airy whoosh for scene transitions. */
export async function whoosh(): Promise<string> {
  const out = path.join(SFX_DIR, "whoosh-v1.wav");
  if (fs.existsSync(out)) return out;
  fs.mkdirSync(SFX_DIR, { recursive: true });
  await ff([
    "-f", "lavfi", "-i", "anoisesrc=d=0.5:c=pink:a=0.6:r=44100",
    "-af", "highpass=f=500,lowpass=f=7000,afade=t=in:st=0:d=0.22:curve=exp,afade=t=out:st=0.22:d=0.28:curve=exp,pan=stereo|c0=c0|c1=c0",
    out,
  ]);
  return out;
}

/** Your music in assets/music/*.mp3|wav (random pick) or the generated beat. */
export async function pickMusic(mode: string): Promise<string | null> {
  if (mode === "off") return null;
  const dirs = [path.join(process.cwd(), "assets", "music"), path.join(DATA_DIR, "music")];
  const files = dirs.flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).filter((f) => /\.(mp3|wav|m4a|ogg)$/i.test(f)).map((f) => path.join(d, f)) : []));
  const legacy = path.join(process.cwd(), "assets", "music.mp3");
  if (fs.existsSync(legacy)) files.push(legacy);
  if (files.length) return files[Math.floor(Math.random() * files.length)];
  return defaultMusic();
}

/**
 * voice + ducked music + whooshes -> one track of exactly `total` seconds.
 * `cuts` are the scene-change times (seconds).
 */
export async function mixAudio(voice: string, total: number, cuts: number[], musicMode: string, musicVolume: number, out: string) {
  const music = await pickMusic(musicMode);
  const sfx = cuts.length ? await whoosh() : null;
  const inputs: string[] = ["-i", voice];
  const T = total.toFixed(3);
  const parts: string[] = [`[0:a]aresample=44100,apad,atrim=0:${T},asplit=2[v][vsc]`];
  const mixIn = ["[v]"];
  if (music) {
    inputs.push("-stream_loop", "-1", "-i", music);
    parts.push(
      `[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=${musicVolume.toFixed(2)},atrim=0:${T},afade=t=in:d=0.6,afade=t=out:st=${Math.max(0, total - 1.2).toFixed(3)}:d=1.2[mraw]`,
      // duck the music whenever the voice speaks
      `[mraw][vsc]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=400[m]`,
    );
    mixIn.push("[m]");
  } else parts.push("[vsc]anullsink");
  if (sfx) {
    const idx = music ? 2 : 1;
    inputs.push("-i", sfx);
    const k = cuts.length;
    parts.push(`[${idx}:a]volume=0.55,asplit=${k}${cuts.map((_, i) => `[w${i}]`).join("")}`);
    cuts.forEach((c, i) => {
      const ms = Math.max(0, Math.round((c - 0.18) * 1000));
      parts.push(`[w${i}]adelay=${ms}|${ms},apad,atrim=0:${T}[d${i}]`);
    });
    parts.push(`${cuts.map((_, i) => `[d${i}]`).join("")}amix=inputs=${k}:duration=first,volume=${k}[s]`);
    mixIn.push("[s]");
  }
  const n = mixIn.length;
  parts.push(n > 1 ? `${mixIn.join("")}amix=inputs=${n}:duration=first,volume=${n}[out]` : `[v]anull[out]`);
  await ff([...inputs, "-filter_complex", parts.join(";"), "-map", "[out]", "-ar", "44100", "-ac", "2", out]);
}
