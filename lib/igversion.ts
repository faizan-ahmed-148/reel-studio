/**
 * Instagram-length version of a reel: a properly re-written & re-rendered shorter reel
 * (own voice-over, subtitles and visuals), not a cut of the long one.
 */
import fs from "node:fs";
import path from "node:path";
import { shortenScript, type ReelScript } from "./script";
import { buildVideo } from "./video";
import { IG_SAFE_SECONDS, instagramCut, videoDuration } from "./igcut";
import type { Settings } from "./store";

export async function buildInstagramVersion(
  video: string, settings: Settings, onProgress: (msg: string) => void = () => {},
): Promise<string> {
  const workdir = path.dirname(video);
  const out = path.join(workdir, "reel_ig.mp4");
  if (fs.existsSync(out)) return out;
  const cap = settings.meta.igMaxSeconds || IG_SAFE_SECONDS;
  const script = JSON.parse(fs.readFileSync(path.join(workdir, "script.json"), "utf8")) as ReelScript;
  // spoken words per second (Gemini speaks faster than Edge voices)
  const wps = settings.ttsProvider === "gemini" && settings.geminiApiKey ? 2.7 : 2.3;
  let budget = Math.floor((cap - 3) * wps);
  let last = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    onProgress(`Instagram ka ${cap}s version likh rahe hain…`);
    const short = await shortenScript(settings, script, budget);
    const dir = path.join(workdir, "ig");
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "script.json"), JSON.stringify(short, null, 2));
    last = await buildVideo(short, settings, dir, (m) => onProgress(`Instagram version: ${m}`));
    const dur = await videoDuration(last);
    if (dur <= cap + 0.5) {
      fs.renameSync(last, out);
      return out;
    }
    budget = Math.floor(budget * (cap / dur) * 0.95); // still too long -> fewer words
  }
  // last resort: trim the short version (rarely needed)
  const trimmed = await instagramCut(last, cap);
  fs.renameSync(trimmed, out);
  return out;
}
