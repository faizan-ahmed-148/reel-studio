import fs from "node:fs";
import path from "node:path";
import { buildCaption, generateScript, inventTopics } from "./script";
import { ALL_CATEGORIES, normTopic, pickBankTopic } from "./topics";
import { buildVideo } from "./video";
import { generateCaptions } from "./caption";
import { IgRejected, isConnected, PUBLISHERS } from "./publishers";
import { buildInstagramVersion } from "./igversion";
import { IG_SAFE_SECONDS, videoDuration } from "./igcut";
import {
  getEntry, loadHistory, loadSettings, OUTPUT_DIR, PLATFORMS, updateSettings, upsertHistory,
  type HistoryEntry, type Platform,
} from "./store";

export const AI_NOTE = "🤖 AI-generated: is video ka script, voice aur visuals AI ki madad se banaye gaye hain.";

// one job at a time, shared across Next.js module instances
const g = globalThis as unknown as { __reelBusy?: boolean };
export const isBusy = () => !!g.__reelBusy;

function stamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

export async function publishEntry(entry: HistoryEntry, platforms?: Platform[]): Promise<HistoryEntry> {
  const s = loadSettings();
  // never re-post where it already went out successfully
  const targets = (platforms ?? PLATFORMS.filter((p) => s.enabled[p] && isConnected(p, s))).filter((p) => !entry.results[p]?.ok);
  if (!entry.video || !fs.existsSync(entry.video)) throw new Error("Video file nahi mili.");
  if (targets.length === 0 && Object.values(entry.results).some((r) => r?.ok)) return entry; // already everywhere
  if (targets.length === 0) {
    entry.status = "ready";
    entry.error = "Koi platform connected/enabled nahi — video sirf banayi gayi, upload nahi hui.";
    upsertHistory(entry);
    return entry;
  }
  entry.status = "publishing";
  upsertHistory(entry);
  for (const p of targets) {
    entry.progress = `${p} par upload ho rahi hai…`;
    upsertHistory(entry);
    try {
      let caption = entry.captions?.[p] || entry.caption || "";
      // LinkedIn has no AI switch in its API -> written disclosure instead
      if (s.aiLabel && p === "linkedin" && !caption.includes(AI_NOTE)) caption = `${caption}\n\n${AI_NOTE}`;
      let id: string;
      if (p === "instagram") id = await publishInstagram(entry, caption);
      else id = await PUBLISHERS[p](entry.video, caption, s, p === "youtube" ? entry.youtubeTitle || entry.topic : entry.topic);
      entry.results[p] = { ok: true, id, at: new Date().toISOString() };
    } catch (e) {
      entry.results[p] = { ok: false, error: (e instanceof Error ? e.message : String(e)).slice(0, 800), at: new Date().toISOString() };
    }
    upsertHistory(entry);
  }
  entry.progress = undefined;
  entry.status = Object.values(entry.results).some((r) => r?.ok) ? "published" : "publish_failed";
  upsertHistory(entry);
  return entry;
}

/**
 * Instagram: full video first. If this account refuses long Reels, render a proper shorter
 * Instagram version (own script/voice/subtitles), remember the account's limit, and post that.
 */
async function publishInstagram(entry: HistoryEntry, caption: string): Promise<string> {
  const s = loadSettings();
  if (entry.igVideo && fs.existsSync(entry.igVideo)) return PUBLISHERS.instagram(entry.igVideo, caption, s);
  const dur = await videoDuration(entry.video!);
  const cap = s.meta.igMaxSeconds;
  if (!cap || dur <= cap + 0.5) {
    try {
      return await PUBLISHERS.instagram(entry.video!, caption, s);
    } catch (e) {
      if (!(e instanceof IgRejected) || dur <= IG_SAFE_SECONDS) throw e;
      console.warn(`[reel-studio] Instagram refused a ${dur.toFixed(0)}s reel — making a ${IG_SAFE_SECONDS}s Instagram version`);
      updateSettings((x) => { x.meta.igMaxSeconds = IG_SAFE_SECONDS; });
    }
  }
  entry.igVideo = await buildInstagramVersion(entry.video!, loadSettings(), (m) => {
    entry.progress = m;
    upsertHistory(entry);
  });
  upsertHistory(entry);
  return PUBLISHERS.instagram(entry.igVideo, caption, loadSettings());
}

export const looksLikeSecret = (t?: string) => !!t && /^(gsk_|sk-|EAA)[A-Za-z0-9_-]{15,}/.test(t.trim());

async function chooseTopic(manual?: string): Promise<{ topic: string; category: string }> {
  const s = loadSettings();
  const fallbackCat = s.categories[0] || "Software";
  if (manual) return { topic: manual, category: fallbackCat };
  if (s.topicQueue.length) {
    const topic = s.topicQueue[0];
    updateSettings((x) => { x.topicQueue = x.topicQueue.slice(1); });
    return { topic, category: fallbackCat };
  }
  const used = [...s.usedTopics, ...loadHistory().map((e) => e.topic)].filter(Boolean);
  const picked = pickBankTopic(s.categories, used, s.lastCategory, s.customTopics);
  if (picked) return picked;
  // bank exhausted -> let Groq invent new ones, still never repeating
  const cats = s.categories.length ? s.categories : ALL_CATEGORIES;
  const cat = cats[(cats.indexOf(s.lastCategory) + 1) % cats.length];
  const usedSet = new Set(used.map(normTopic));
  const fresh = (await inventTopics(s, cat, used)).filter((t) => !usedSet.has(normTopic(t)));
  if (!fresh.length) throw new Error("Naya topic nahi mila — Topic queue mein kuch topics add karein.");
  return { topic: fresh[0], category: cat };
}

export async function runOnce(opts: { topic?: string; publish?: boolean; trigger?: "manual" | "schedule" } = {}) {
  if (g.__reelBusy) return null;
  g.__reelBusy = true;
  const entry: HistoryEntry = {
    id: stamp(), created: new Date().toISOString(), status: "generating",
    topic: opts.topic?.trim() ?? "", trigger: opts.trigger ?? "manual", results: {}, progress: "Naya topic chuna ja raha hai…",
  };
  upsertHistory(entry);
  try {
    const settings = loadSettings();
    const { topic, category } = await chooseTopic(opts.topic?.trim());
    entry.topic = topic;
    entry.category = category;
    entry.progress = "Groq script + diagrams likh raha hai…";
    upsertHistory(entry);
    const script = await generateScript(settings, topic, category);
    entry.topic = script.topic || topic;
    entry.script = { hook: script.hook, scenes: script.scenes };
    const workdir = path.join(OUTPUT_DIR, entry.id);
    fs.mkdirSync(workdir, { recursive: true });
    fs.writeFileSync(path.join(workdir, "script.json"), JSON.stringify(script, null, 2));
    entry.status = "rendering";
    upsertHistory(entry);
    entry.video = await buildVideo(script, settings, workdir, (msg) => {
      entry.progress = msg;
      upsertHistory(entry);
    });
    entry.progress = "Best caption + hashtags likh rahe hain…";
    upsertHistory(entry);
    const cap = await generateCaptions(script, settings);
    entry.captions = cap.captions;
    entry.youtubeTitle = cap.youtubeTitle;
    entry.caption = cap.captions.instagram || buildCaption(script, settings);
    entry.progress = undefined;
    // account with an Instagram length cap -> render the Instagram version right away
    const s2 = loadSettings();
    if (s2.meta.igMaxSeconds && s2.enabled.instagram && isConnected("instagram", s2) && (await videoDuration(entry.video)) > s2.meta.igMaxSeconds + 0.5) {
      try {
        entry.igVideo = await buildInstagramVersion(entry.video, s2, (m) => { entry.progress = m; upsertHistory(entry); });
      } catch (e) {
        console.warn("[reel-studio] Instagram version failed (will retry on upload):", e instanceof Error ? e.message : e);
      }
      entry.progress = undefined;
    }
    entry.status = "ready";
    upsertHistory(entry);
    // remember the topic forever so it is never made again
    updateSettings((x) => {
      const set = new Set(x.usedTopics.map(normTopic));
      for (const t of [topic, script.topic]) if (t && !set.has(normTopic(t))) x.usedTopics.push(t);
      x.lastCategory = category;
    });
    if (opts.publish ?? settings.autoPublish) await publishEntry(entry);
  } catch (e) {
    entry.status = "failed";
    entry.progress = undefined;
    entry.error = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    console.error("[reel-studio] run failed:", e);
    upsertHistory(entry);
  } finally {
    g.__reelBusy = false;
  }
  return getEntry(entry.id) ?? entry;
}
