/**
 * Platform-specific captions + hashtags, written by Groq after the video is ready.
 * Instagram: hook line + value + CTA + 15-20 mixed hashtags
 * Facebook:  conversational, 3-5 hashtags
 * LinkedIn:  professional storytelling, key takeaways, 3-5 hashtags
 */
import Groq from "groq-sdk";
import { PREFERRED_MODELS, buildCaption, groqJson, type ReelScript } from "./script";
import { platformHandles, type Platform, type Settings } from "./store";

export type Captions = Record<Platform, string>;
export interface CaptionResult { captions: Captions; youtubeTitle: string }

const LIMITS: Record<Platform, { tags: [number, number]; maxChars: number }> = {
  instagram: { tags: [15, 20], maxChars: 2200 },
  facebook: { tags: [3, 5], maxChars: 3000 },
  youtube: { tags: [4, 6], maxChars: 4800 },
  linkedin: { tags: [3, 5], maxChars: 3000 },
};

function summary(script: ReelScript) {
  return script.scenes
    .map((s, i) => `${i + 1}. ${s.heading || script.hook} — ${s.subtitle || ""}`)
    .join("\n");
}

let BLOCKED: string[] = [];
const isBlocked = (tag: string, blocked: string[]) => {
  const t = tag.replace(/^#/, "").toLowerCase();
  // blocks the tag and variations like #pakistanidevelopers, #techinurdu
  return blocked.some((b) => b && t.includes(b));
};

const cleanTag = (t: string) => {
  const core = t.replace(/^#+/, "").replace(/[^\p{L}\p{N}_]/gu, "");
  return core ? `#${core}` : "";
};

function finalize(text: string, tags: string[], fixed: string[], p: Platform, blocked: string[] = BLOCKED): string {
  const [, maxTags] = LIMITS[p].tags;
  const seen = new Set<string>();
  // strip hashtags the model may have put inside the body; we append a clean block
  const body = text.replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const all = [...tags, ...fixed]
    .map(cleanTag)
    .filter((t) => t && !isBlocked(t, blocked) && !seen.has(t.toLowerCase()) && seen.add(t.toLowerCase()));
  // Instagram keeps all fixed tags; FB/LinkedIn keep at most 2 so topic tags still fit
  const fixedClean = fixed.map(cleanTag).filter(Boolean);
  const fixedKeep = new Set((p === "instagram" || p === "youtube" ? fixedClean : fixedClean.slice(0, 2)).map((t) => t.toLowerCase()));
  const allFixed = new Set(fixedClean.map((t) => t.toLowerCase()));
  const aiTags = all.filter((t) => !allFixed.has(t.toLowerCase()));
  const keep = [...aiTags.slice(0, Math.max(0, maxTags - fixedKeep.size)), ...all.filter((t) => fixedKeep.has(t.toLowerCase()))];
  const out = `${body}\n\n${keep.join(" ")}`.trim();
  return out.slice(0, LIMITS[p].maxChars);
}

/** Keep only the platform's own @handle; any other @mention is replaced (or dropped if none). */
function fixMentions(text: string, own: string): string {
  return text
    .replace(/(^|[\s(])@[A-Za-z0-9_.]+/g, (m, pre: string) => {
      const h = m.slice(pre.length);
      if (own && h.toLowerCase() === own.toLowerCase()) return m;
      return own ? `${pre}${own}` : pre;
    })
    .replace(/[ \t]{2,}/g, " ");
}

const ytTitle = (t: string) => {
  const base = t.replace(/#\S+/g, "").replace(/\s+/g, " ").trim().slice(0, 88);
  return `${base} #Shorts`;
};

export async function generateCaptions(script: ReelScript, settings: Settings): Promise<CaptionResult> {
  BLOCKED = settings.blockedHashtags.split(/[\s,]+/).map((t) => t.replace(/^#/, "").toLowerCase()).filter(Boolean);
  const fixed = settings.hashtags.split(/\s+/).filter((t) => t && !isBlocked(t, BLOCKED));
  const fallback = buildCaption(script, settings);
  const fb: CaptionResult = {
    captions: { instagram: fallback, facebook: fallback, youtube: fallback, linkedin: fallback },
    youtubeTitle: ytTitle(script.hook || script.topic),
  };
  if (!settings.groqApiKey) return fb;

  const groq = new Groq({ apiKey: settings.groqApiKey });
  const H = platformHandles(settings);
  const cta = (p: Platform, ask: string) =>
    H[p] ? `${ask} (mention exactly ${H[p]}, no other @handle)` : "Do NOT mention any @handle or account name";
  const prompt = `You are a top social-media growth strategist for a Pakistani software-education creator.
Write the BEST possible captions for this short video reel.

Topic: ${script.topic}
Category: ${script.category ?? "Software"}
Hook: ${script.hook}
Reel outline:
${summary(script)}

Rules:
- Language: ROMAN URDU (Urdu in English letters), tech terms in English. No Urdu/Hindi script.
- First line = a scroll-stopping hook (curiosity / bold claim / relatable pain), max 12 words. It must make people tap "more".
- Then 2-4 short lines of real value (what they'll learn / the key insight), using line breaks. Emojis allowed but tasteful (max 4 on Instagram, max 2 on LinkedIn).
- End with ONE engagement question that invites comments, plus a save/share CTA ("Save karo baad ke liye", "Apne developer dost ko tag karo").
- Do NOT put hashtags inside the text; give them separately.
- Grammar: English tech nouns take MASCULINE verbs ("cache fast hota hai", "server handle karta hai", "traffic barh jata hai").
- Hashtags: mix of high-volume (#programming, #coding, #softwareengineering), mid-size niche (topic-specific, e.g. #systemdesign #loadbalancer #backenddeveloper) and developer-community tags (#developers #learnprogramming #techeducation). Topic-specific tags first.${settings.blockedHashtags.trim() ? ` NEVER use these hashtags or any variation of them: ${settings.blockedHashtags}.` : ""} No spaces, no made-up gibberish.

Per platform:
- instagram: hook + value bullets + question + CTA: ${cta("instagram", `"Follow ${H.instagram} for daily software reels" style follow line`)}. ${LIMITS.instagram.tags[0]}-${LIMITS.instagram.tags[1]} hashtags.
- facebook: friendly, conversational, a bit shorter, question at the end. ${cta("facebook", "follow line")}. ${LIMITS.facebook.tags[0]}-${LIMITS.facebook.tags[1]} hashtags.
- youtube: a "title" (max 70 chars, Roman Urdu + English keywords people search, curiosity, no hashtags) and a description:
  2-3 lines summary, then "Is video mein:" with 3-4 short bullet points, then a subscribe CTA. ${cta("youtube", "subscribe line")}. ${LIMITS.youtube.tags[0]}-${LIMITS.youtube.tags[1]} hashtags.
- linkedin: professional but in Roman Urdu with some English, start with a strong insight, 3 "Key takeaways" lines (use "→"), end with a thoughtful question for developers. ${cta("linkedin", "follow line")}. ${LIMITS.linkedin.tags[0]}-${LIMITS.linkedin.tags[1]} hashtags.

Return JSON:
{"instagram":{"text":"...","hashtags":["#..."]},"facebook":{"text":"...","hashtags":["#..."]},"youtube":{"title":"...","text":"...","hashtags":["#..."]},"linkedin":{"text":"...","hashtags":["#..."]}}`;

  const models = [settings.groqModel || PREFERRED_MODELS[0], ...PREFERRED_MODELS];
  let lastErr: unknown;
  for (const model of [...new Set(models)].slice(0, 3)) {
    try {
      const data = JSON.parse(await groqJson(groq, model, [{ role: "user", content: prompt }], 0.85));
      const out = {} as Captions;
      for (const p of ["instagram", "facebook", "youtube", "linkedin"] as Platform[]) {
        const text = String(data?.[p]?.text ?? "").trim();
        const tags = Array.isArray(data?.[p]?.hashtags) ? data[p].hashtags.map(String) : [];
        if (!text || /[؀-ۿऀ-ॿ]/.test(text)) throw new Error(`bad ${p} caption`);
        out[p] = finalize(fixMentions(text, H[p]), tags, fixed, p);
      }
      out.youtube = finalize(out.youtube.replace(/\n\n[^\n]*$/, ""), ["#Shorts", ...(data?.youtube?.hashtags ?? [])], fixed, "youtube");
      const title = String(data?.youtube?.title ?? "").trim();
      return { captions: out, youtubeTitle: ytTitle(title && !/[\u0600-\u06FF\u0900-\u097F]/.test(title) ? title : script.hook || script.topic) };
    } catch (e) {
      lastErr = e;
    }
  }
  console.warn("[reel-studio] caption generation failed, using script caption:", lastErr instanceof Error ? lastErr.message : lastErr);
  return fb;
}
