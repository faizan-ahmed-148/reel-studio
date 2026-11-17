import Groq from "groq-sdk";
import type { Settings } from "./store";
import { narrationScript } from "./voices";

export const NODE_KINDS = [
  "user", "client", "server", "service", "api", "database", "cache", "queue", "loadbalancer",
  "cdn", "storage", "external", "ai", "gateway", "worker", "dns",
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export interface DiagramNode { id: string; label: string; kind: NodeKind; row: number }
export interface DiagramEdge { from: string; to: string; label?: string }

export type Visual =
  | { type: "title" }
  | { type: "bullets"; points: string[] }
  | { type: "diagram"; nodes: DiagramNode[]; edges: DiagramEdge[] }
  | { type: "chart"; title: string; unit: string; bars: { label: string; value: number }[] }
  | { type: "compare"; left: { title: string; items: string[] }; right: { title: string; items: string[] } }
  | { type: "code"; lang: string; lines: string[] }
  | { type: "stat"; value: string; label: string };

export interface Scene {
  heading: string;
  narration: string; // spoken (Urdu or Devanagari script, depending on the voice)
  subtitle: string; // Roman Urdu, shown as captions
  visual: Visual;
  /** legacy field (older history entries) */
  points?: string[];
}

export interface ReelScript {
  topic: string;
  category?: string;
  hook: string;
  scenes: Scene[];
  caption: string;
  hashtags: string[];
}

const TRANSLIT_RULES = {
  urdu: `Write it in URDU SCRIPT (اردو). Keep English tech terms (API, server, database, WebSocket, code) in English letters, e.g. "API ایک waiter کی طرح ہے".`,
  devanagari: `Write it in DEVANAGARI script, but keep the everyday PAKISTANI URDU vocabulary exactly as in the Roman text
(e.g. "दोस्तो", "आसान", "मिसाल", "ज़रूरी", "मसला", "तरीक़ा", "फ़र्क़" — use nukta ज़ फ़ क़ ख़ ग़). NEVER replace words with Sanskrit Hindi
("उदाहरण", "आवश्यक", "समस्या", "प्रणाली" are wrong). Keep English tech terms (API, server, database, WebSocket, code) in English letters,
e.g. "API एक waiter की तरह है".`,
};

function systemPrompt() {
  return `You are a senior software architect who makes viral, faceless, visual explainer Reels for Pakistani developers.
Every reel explains ONE software concept with ARCHITECTURE DIAGRAMS, charts and comparisons — like a system-design whiteboard.

Language rules:
- ALL text (hook, heading, narration, labels, items, caption) = ROMAN URDU (Urdu in English letters,
  e.g. "Yeh server load ko barabar baant deta hai"). Tech terms stay English. Never use Urdu or Hindi script.
- Narration = the voice-over. Energetic, conversational, natural spoken Urdu like a Pakistani YouTuber talking to a friend
  ("dosto", "socho", "ab dekho", "simple si baat hai"). Short sentences. No emojis, no hashtags, no markdown.
- Headings are content, never labels like "Summary", "CTA", "Chart", "Stat", "Diagram".
- Narration never mentions the slide itself ("chart dikhata hai", "stat", "diagram mein") — just explain naturally.
Return ONLY valid JSON.`;
}

function userPrompt(topic: string, category: string, niche: string) {
  return `Channel niche: ${niche}
Category: ${category}
Topic: ${topic}

Create a 60-SECOND reel as JSON (total narration MUST be 135-155 words — that is exactly ~1 minute of speech):
{
  "topic": "short English title of the topic",
  "hook": "scroll-stopping Roman Urdu hook, max 8 words (a question or bold claim)",
  "scenes": [
    {
      "heading": "Roman Urdu heading, max 6 words",
      "narration": "Roman Urdu voice-over for this scene, 2 sentences, 16-20 words",
      "visual": <ONE visual object, see below>
    }
  ],
  "caption": "Roman Urdu Instagram caption, 2-3 lines, ending with a question to drive comments",
  "hashtags": ["#tag", "... 6-8 tags"]
}

Visual objects (pick the best one per scene):
- {"type":"title"}  -> only for scene 1 (the hook)
- {"type":"diagram","nodes":[{"id":"u","label":"Users","kind":"user","row":0},{"id":"lb","label":"Load Balancer","kind":"loadbalancer","row":1},{"id":"s1","label":"Server 1","kind":"server","row":2},{"id":"s2","label":"Server 2","kind":"server","row":2},{"id":"db","label":"Database","kind":"database","row":3}],
   "edges":[{"from":"u","to":"lb","label":"requests"},{"from":"lb","to":"s1"},{"from":"lb","to":"s2"},{"from":"s1","to":"db"},{"from":"s2","to":"db"}]}
   kinds: ${NODE_KINDS.join(", ")}. row 0 = top. 3-8 nodes, max 3 nodes per row, max 5 rows, labels max 2 words. Data flows top -> bottom.
- {"type":"chart","title":"Roman Urdu chart title","unit":"ms","bars":[{"label":"Disk","value":10},{"label":"RAM","value":0.1}]}  (2-5 bars, realistic numbers)
- {"type":"compare","left":{"title":"SQL","items":["Fixed schema","Joins"]},"right":{"title":"NoSQL","items":["Flexible schema","Easy scale"]}}  (2-4 items each, max 4 words)
- {"type":"code","lang":"js","lines":["const x = 1;"]}  (max 8 short lines, max 32 chars each)
- {"type":"stat","value":"10x","label":"Roman Urdu label, max 6 words"}
- {"type":"bullets","points":["Roman Urdu point, max 8 words"]}  (2-3 points, use rarely)

Structure: exactly 8 scenes (about 7-8 seconds each).
1. title scene with the hook (problem / curiosity).
2-3. architecture "diagram" scenes that show HOW it works (main part — at least 2 diagram scenes, different diagrams).
Also include at least one "chart" or "compare" scene, and optionally "code" or "stat".
Last scene: quick summary (bullets or stat) + CTA — on screen "Follow karo aisi aur videos ke liye", and the narration ends with a follow request.
Use a simple real-life desi analogy somewhere (dhaba, rickshaw, bank ki line, etc.).`;
}

const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const DEVA = /[ऀ-ॿ]/;
export const PREFERRED_MODELS = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"];

export async function listGroqModels(apiKey: string): Promise<string[]> {
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${apiKey}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || `Groq ${res.status}`);
  return (data.data as { id: string }[])
    .map((m) => m.id)
    .filter((id) => !/whisper|guard|orpheus|tts|playai|allam/i.test(id))
    .sort((a, b) => {
      const ia = PREFERRED_MODELS.indexOf(a), ib = PREFERRED_MODELS.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
    });
}

type Msg = { role: "system" | "user" | "assistant"; content: string };

/** Chat call that reliably returns a JSON string (handles reasoning models + json_validate_failed). */
export async function groqJson(groq: Groq, model: string, messages: Msg[], temperature: number): Promise<string> {
  const base: Record<string, unknown> = { model, temperature, messages, max_completion_tokens: 8192 };
  if (/gpt-oss/i.test(model)) base.reasoning_effort = "low"; // keep tokens for the answer, not the thinking
  try {
    const res = await groq.chat.completions.create({ ...base, response_format: { type: "json_object" } } as any);
    const out = (res as any).choices?.[0]?.message?.content;
    if (out && out.trim()) return out;
  } catch (e) {
    if (!/json_validate_failed|Failed to validate JSON|max_completion_tokens|length/i.test(e instanceof Error ? e.message : String(e))) throw e;
  }
  // retry without JSON mode and cut the JSON object out of the text
  const res = await groq.chat.completions.create({
    ...base,
    messages: [...messages, { role: "user", content: "Return ONLY the JSON object, nothing else." }],
  } as any);
  const text: string = (res as any).choices?.[0]?.message?.content ?? "";
  const a = text.indexOf("{"), b = text.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error(`Groq ne JSON nahi diya: ${text.slice(0, 200)}`);
  return text.slice(a, b + 1);
}

const str = (v: unknown, max = 200) => String(v ?? "").trim().slice(0, max);
const strs = (v: unknown, n: number, max = 60) => (Array.isArray(v) ? v.map((x) => str(x, max)).filter(Boolean).slice(0, n) : []);

function normVisual(v: any, sceneIdx: number): Visual {
  const type = v?.type;
  if (sceneIdx === 0 || type === "title") return { type: "title" };
  if (type === "diagram") {
    const nodes: DiagramNode[] = (Array.isArray(v.nodes) ? v.nodes : []).slice(0, 9).map((n: any, i: number) => ({
      id: str(n?.id || `n${i}`, 30),
      label: str(n?.label, 22),
      kind: (NODE_KINDS as readonly string[]).includes(n?.kind) ? n.kind : "service",
      row: Math.max(0, Math.min(4, Math.round(Number(n?.row) || 0))),
    }));
    const ids = new Set(nodes.map((n) => n.id));
    const edges: DiagramEdge[] = (Array.isArray(v.edges) ? v.edges : [])
      .map((e: any) => ({ from: str(e?.from, 30), to: str(e?.to, 30), label: str(e?.label, 18) || undefined }))
      .filter((e: DiagramEdge) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to)
      .slice(0, 12);
    // compact rows: keep order, remove gaps, max 3 per row
    const rows = [...new Set(nodes.map((n) => n.row))].sort((a, b) => a - b);
    nodes.forEach((n) => (n.row = rows.indexOf(n.row)));
    if (nodes.length >= 2) return { type: "diagram", nodes, edges };
  }
  if (type === "chart") {
    const bars = (Array.isArray(v.bars) ? v.bars : [])
      .map((b: any) => ({ label: str(b?.label, 18), value: Number(b?.value) }))
      .filter((b: { value: number }) => Number.isFinite(b.value) && b.value >= 0)
      .slice(0, 5);
    if (bars.length >= 2) return { type: "chart", title: str(v.title, 50), unit: str(v.unit, 10), bars };
  }
  if (type === "compare" && v.left && v.right) {
    return {
      type: "compare",
      left: { title: str(v.left.title, 18), items: strs(v.left.items, 4, 32) },
      right: { title: str(v.right.title, 18), items: strs(v.right.items, 4, 32) },
    };
  }
  if (type === "code" && Array.isArray(v.lines) && v.lines.length) {
    return { type: "code", lang: str(v.lang, 12) || "js", lines: v.lines.map((l: unknown) => String(l ?? "").slice(0, 38)).slice(0, 9) };
  }
  if (type === "stat" && v.value) return { type: "stat", value: str(v.value, 10), label: str(v.label, 60) };
  const points = strs(v?.points, 3, 70);
  return { type: "bullets", points };
}

function normalize(data: any, topic: string, category: string): ReelScript {
  const scenes: Scene[] = (Array.isArray(data?.scenes) ? data.scenes : [])
    .filter((s: any) => s && typeof s.narration === "string" && s.narration.trim())
    .slice(0, 9)
    .map((s: any, i: number) => ({
      heading: str(s.heading, 60),
      narration: str(s.narration, 600),
      subtitle: str(s.subtitle || s.narration, 600),
      visual: normVisual(s.visual ?? (s.points ? { type: "bullets", points: s.points } : null), i),
    }));
  return {
    topic: str(data?.topic || topic, 80),
    category,
    hook: str(data?.hook, 80),
    scenes,
    caption: str(data?.caption, 1200),
    hashtags: strs(data?.hashtags, 10, 40),
  };
}

function onScreenText(d: ReelScript): string[] {
  const out = [d.hook, d.caption];
  for (const s of d.scenes) {
    out.push(s.heading, s.subtitle);
    const v = s.visual;
    if (v.type === "bullets") out.push(...v.points);
    if (v.type === "diagram") out.push(...v.nodes.map((n) => n.label), ...v.edges.map((e) => e.label ?? ""));
    if (v.type === "chart") out.push(v.title, ...v.bars.map((b) => b.label));
    if (v.type === "compare") out.push(v.left.title, v.right.title, ...v.left.items, ...v.right.items);
    if (v.type === "stat") out.push(v.label);
  }
  return out;
}

function problems(d: ReelScript): string[] {
  const out: string[] = [];
  if ([...onScreenText(d), ...d.scenes.map((s) => s.narration)].some((t) => ARABIC.test(t) || DEVA.test(t)))
    out.push("ALL text including narration MUST be Roman Urdu in English letters only (no Urdu/Hindi script)");
  if (d.scenes.slice(1).some((s) => /\b(summary|cta|chart|stat|diagram)\b/i.test(s.heading.trim())))
    out.push("headings must be real content in Roman Urdu, not labels like Summary/CTA/Chart/Stat");
  if (d.scenes.filter((s) => s.visual.type === "diagram").length < 2) out.push("need at least 2 scenes with a valid architecture diagram (3-8 nodes with edges)");
  if (d.scenes.length < 7) out.push("need exactly 8 scenes");
  const words = d.scenes.reduce((n, s) => n + s.narration.split(/\s+/).filter(Boolean).length, 0);
  if (words < 125) out.push(`total narration is only ${words} words — the reel must be ~60 seconds, so expand narrations to 135-155 words total (add a concrete example, real numbers or a desi analogy; keep same structure)`);
  if (words > 168) out.push(`total narration is ${words} words — too long for 60 seconds, trim to 135-155 words total`);
  return out;
}

export async function generateScript(settings: Settings, topic: string, category: string): Promise<ReelScript> {
  if (!settings.groqApiKey) throw new Error("Groq API key missing — Content tab mein add karein (console.groq.com/keys).");
  const groq = new Groq({ apiKey: settings.groqApiKey });
  let model = settings.groqModel || PREFERRED_MODELS[0];
  const messages: Msg[] = [
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt(topic, category, settings.niche) },
  ];
  let best: { script: ReelScript; issues: number } | null = null;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const raw = await groqJson(groq, model, messages, 0.8);
      const script = normalize(JSON.parse(raw), topic, category);
      if (script.scenes.length < 3) throw new Error(`Groq returned an unusable script: ${raw.slice(0, 300)}`);
      const issues = problems(script);
      if (!best || issues.length < best.issues) best = { script, issues: issues.length };
      if (issues.length === 0) return await toVoiceScript(groq, model, script, settings);
      messages.push({ role: "assistant", content: raw }, { role: "user", content: `Fix these problems and return the full corrected JSON: ${issues.join("; ")}.` });
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/model_not_found|does not exist|decommissioned/i.test(msg)) {
        const available = await listGroqModels(settings.groqApiKey).catch(() => []);
        const next = available.find((m) => m !== model);
        if (!next) throw e;
        console.warn(`[reel-studio] Groq model ${model} unavailable, using ${next}`);
        model = next;
      }
    }
  }
  if (best) return await toVoiceScript(groq, model, best.script, settings);
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

/** Roman Urdu narration -> the script the voice engine reads (Urdu or Devanagari). Subtitles stay Roman. */
async function toVoiceScript(groq: Groq, model: string, script: ReelScript, settings: Settings): Promise<ReelScript> {
  const target = narrationScript(settings);
  const want = target === "urdu" ? ARABIC : DEVA;
  const lines = script.scenes.map((s) => s.narration);
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = await groqJson(groq, model, [{
        role: "user",
        content: `Transliterate each Roman Urdu line below for a text-to-speech voice. ${TRANSLIT_RULES[target]}
Do NOT translate, summarize, add or drop anything — same words, same order, same punctuation.
Return JSON {"lines": [...]} with exactly ${lines.length} strings.

${lines.map((l, i) => `${i + 1}. ${l}`).join("\n")}`,
      }], 0.2);
      const out = (JSON.parse(raw).lines ?? []).map((l: unknown) => String(l ?? "").replace(/^\d+\.\s*/, "").trim());
      if (out.length !== lines.length) throw new Error(`got ${out.length} lines`);
      const bad = out.findIndex((l: string) => !want.test(l) || (target === "urdu" ? DEVA : ARABIC).test(l));
      if (bad >= 0) throw new Error(`line ${bad + 1} not in ${target}`);
      return { ...script, scenes: script.scenes.map((s, i) => ({ ...s, subtitle: s.narration, narration: out[i] })) };
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
  }
  // Gemini can read Roman Urdu directly; Edge voices cannot
  if (settings.ttsProvider === "gemini" && settings.geminiApiKey) {
    console.warn("[reel-studio] transliteration failed, Gemini will read Roman Urdu:", lastErr);
    return { ...script, scenes: script.scenes.map((s) => ({ ...s, subtitle: s.narration })) };
  }
  throw new Error(`Narration ko voice script mein badalna fail hua: ${lastErr}`);
}

/** Ask Groq for brand-new topics in a category that are not in the used list. */
export async function inventTopics(settings: Settings, category: string, used: string[], count = 15): Promise<string[]> {
  const groq = new Groq({ apiKey: settings.groqApiKey });
  const raw = await groqJson(groq, settings.groqModel || PREFERRED_MODELS[0], [{
    role: "user",
    content: `List ${count} specific, interesting software topics in the category "${category}" for short architecture explainer reels.
Each topic max 7 words (English or Roman Urdu). Must be different from ALL of these already-covered topics: ${used.slice(-300).join("; ")}.
Return JSON: {"topics": ["..."]}`,
  }], 1);
  const data = JSON.parse(raw);
  return strs(data.topics, count, 80);
}

export function buildCaption(script: ReelScript, settings: Settings): string {
  const seen = new Set<string>();
  const blocked = (settings.blockedHashtags ?? "").split(/[\s,]+/).map((t) => t.replace(/^#/, "").toLowerCase()).filter(Boolean);
  const tags = [...script.hashtags, ...settings.hashtags.split(/\s+/)]
    .filter((t) => !blocked.some((b) => t.replace(/^#/, "").toLowerCase().includes(b)))
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => (t.startsWith("#") ? t : `#${t}`))
    .filter((t) => (seen.has(t.toLowerCase()) ? false : (seen.add(t.toLowerCase()), true)));
  return `${script.caption.trim()}\n\n${tags.join(" ")}`.trim();
}
