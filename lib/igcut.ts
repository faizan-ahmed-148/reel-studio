/** Shorter Instagram version for accounts whose API Reels are capped (~40s). */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

export const IG_SAFE_SECONDS = 38;
const OUTRO = 3; // keep the last seconds (follow card / CTA)

export async function videoDuration(file: string): Promise<number> {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]);
  return parseFloat(stdout.trim());
}

/** First part of the reel + its last OUTRO seconds, total <= maxSec. Cached next to the video. */
export async function instagramCut(video: string, maxSec: number): Promise<string> {
  const out = path.join(path.dirname(video), `reel_ig${maxSec}.mp4`);
  if (fs.existsSync(out)) return out;
  const total = await videoDuration(video);
  if (total <= maxSec) return video;
  const head = (maxSec - OUTRO).toFixed(3);
  const tailStart = (total - OUTRO).toFixed(3);
  const fade = (maxSec - OUTRO - 0.25).toFixed(3);
  const filter = [
    `[0:v]trim=0:${head},setpts=PTS-STARTPTS,fade=t=out:st=${fade}:d=0.25[v1]`,
    `[0:a]atrim=0:${head},asetpts=PTS-STARTPTS,afade=t=out:st=${fade}:d=0.25[a1]`,
    `[0:v]trim=start=${tailStart},setpts=PTS-STARTPTS,fade=t=in:st=0:d=0.2[v2]`,
    `[0:a]atrim=start=${tailStart},asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.2[a2]`,
    `[v1][a1][v2][a2]concat=n=2:v=1:a=1[v][a]`,
  ].join(";");
  try {
    await run(FFMPEG, [
      "-y", "-hide_banner", "-loglevel", "error", "-i", video, "-filter_complex", filter, "-map", "[v]", "-map", "[a]",
      "-c:v", "libx264", "-preset", "veryfast", "-profile:v", "high", "-level", "4.1", "-pix_fmt", "yuv420p",
      "-r", "30", "-g", "60", "-keyint_min", "60", "-sc_threshold", "0", "-crf", "21", "-maxrate", "6M", "-bufsize", "12M",
      "-c:a", "aac", "-b:a", "128k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", out,
    ], { maxBuffer: 20 * 1024 * 1024 });
  } catch (e) {
    const err = e as { stderr?: string; message: string };
    throw new Error(`Instagram cut failed: ${(err.stderr || err.message).slice(-800)}`);
  }
  return out;
}
