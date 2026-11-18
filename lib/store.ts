import fs from "node:fs";
import path from "node:path";
import { bankStats } from "./topics";

export const DATA_DIR = path.join(process.cwd(), "data");
export const OUTPUT_DIR = path.join(DATA_DIR, "output");
const SETTINGS_FILE = path.join(DATA_DIR, "settings.json");
const HISTORY_FILE = path.join(DATA_DIR, "history.json");

export type Platform = "instagram" | "facebook" | "youtube" | "linkedin";
export const PLATFORMS: Platform[] = ["instagram", "facebook", "youtube", "linkedin"];

export interface MetaPage {
  id: string;
  name: string;
  accessToken: string;
  igUserId?: string;
  igUsername?: string;
}

export interface Settings {
  groqApiKey: string;
  groqModel: string;
  niche: string;
  topicQueue: string[];
  categories: string[]; // empty = all
  usedTopics: string[]; // every topic ever made, never repeated
  lastCategory: string;
  customTopics: Record<string, string[]>; // your own topics per category
  handle: string;
  hashtags: string;
  blockedHashtags: string; // never used in captions
  socialHandles: Partial<Record<Platform, string>>; // optional overrides for caption @mentions
  ttsProvider: "gemini" | "edge";
  musicMode: "auto" | "off";
  musicVolume: number;
  aiLabel: boolean;
  geminiApiKey: string;
  geminiModel: string;
  geminiVoice: string;
  geminiStyle: string;
  voice: string;
  voiceRate: string;
  autoPublish: boolean;
  enabled: Record<Platform, boolean>;
  meta: {
    appId: string;
    appSecret: string;
    graphVersion: string;
    userToken: string;
    pages: MetaPage[];
    selectedPageId: string;
    igMaxSeconds: number; // learned Instagram API length cap for this account (0 = unknown / none)
  };
  linkedin: {
    clientId: string;
    clientSecret: string;
    apiVersion: string;
    accessToken: string;
    authorUrn: string;
    name: string;
    expiresAt: number;
    orgScope: boolean; // token can post as the Company Page
  };
  youtube: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    accessToken: string;
    expiresAt: number;
    channelTitle: string;
    handle: string; // e.g. @codestria (from the channel's customUrl)
    privacy: "public" | "unlisted" | "private";
  };
  schedule: {
    enabled: boolean;
    days: number[]; // 0 = Sunday ... 6 = Saturday
    times: string[]; // "HH:MM"
    timezone: string;
  };
}

export type RunStatus = "generating" | "rendering" | "ready" | "publishing" | "published" | "publish_failed" | "failed";

export interface PublishResult {
  ok: boolean;
  id?: string;
  error?: string;
  at: string;
}

export interface HistoryEntry {
  id: string;
  created: string;
  status: RunStatus;
  topic: string;
  trigger: "manual" | "schedule";
  caption?: string;
  captions?: Partial<Record<Platform, string>>;
  youtubeTitle?: string;
  igVideo?: string; // shorter Instagram version (re-rendered), when the account has a length cap
  video?: string;
  error?: string;
  progress?: string;
  category?: string;
  script?: { hook: string; scenes: { heading: string; narration: string; subtitle?: string; visual?: { type: string }; points?: string[] }[] };
  results: Partial<Record<Platform, PublishResult>>;
}

export const DEFAULT_SETTINGS: Settings = {
  groqApiKey: "",
  groqModel: "openai/gpt-oss-120b",
  niche: "Software engineering — system design, backend, cloud, AI aur programming concepts, architecture diagrams ke saath",
  topicQueue: [],
  categories: [],
  usedTopics: [],
  lastCategory: "",
  customTopics: {},
  handle: "@yourhandle",
  hashtags: "#tech #ai #learnwithme",
  blockedHashtags: "#pakistan #urdu",
  socialHandles: {},
  ttsProvider: "gemini",
  musicMode: "auto",
  musicVolume: 0.22,
  aiLabel: true,
  geminiApiKey: "",
  geminiModel: "gemini-3.8-flash-tts",
  geminiVoice: "Puck",
  geminiStyle:
    "Ek energetic, friendly Pakistani tech YouTuber jo apne dost ko samjha raha hai. Natural, casual Urdu/Hindustani lehja, " +
    "tez raftaar, expressive aur confident — bilkul insaan jaisa, robotic nahi. Sawal par curiosity, aham baat par zor.",
  voice: "hi-IN-MadhurNeural",
  voiceRate: "+5%",
  autoPublish: true,
  enabled: { instagram: true, facebook: true, youtube: true, linkedin: true },
  meta: { appId: "", appSecret: "", graphVersion: "v23.0", userToken: "", pages: [], selectedPageId: "", igMaxSeconds: 0 },
  linkedin: { clientId: "", clientSecret: "", apiVersion: "202609", accessToken: "", authorUrn: "", name: "", expiresAt: 0, orgScope: false },
  youtube: { clientId: "", clientSecret: "", refreshToken: "", accessToken: "", expiresAt: 0, channelTitle: "", handle: "", privacy: "public" },
  schedule: { enabled: false, days: [1, 2, 3, 4, 5], times: ["19:00"], timezone: "Asia/Karachi" },
};

function ensureDirs() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown) {
  ensureDirs();
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

/**
 * Keys that can live in .env.local instead of data/settings.json.
 * When set in the environment they win, are never written to disk and never sent to the browser.
 */
const ENV_KEYS: { env: string; field: string; get: (s: Settings) => string; set: (s: Settings, v: string) => void }[] = [
  { env: "GROQ_API_KEY", field: "groqApiKey", get: (s) => s.groqApiKey, set: (s, v) => { s.groqApiKey = v; } },
  { env: "GEMINI_API_KEY", field: "geminiApiKey", get: (s) => s.geminiApiKey, set: (s, v) => { s.geminiApiKey = v; } },
  { env: "META_APP_ID", field: "meta.appId", get: (s) => s.meta.appId, set: (s, v) => { s.meta.appId = v; } },
  { env: "META_APP_SECRET", field: "meta.appSecret", get: (s) => s.meta.appSecret, set: (s, v) => { s.meta.appSecret = v; } },
  { env: "GOOGLE_CLIENT_ID", field: "youtube.clientId", get: (s) => s.youtube.clientId, set: (s, v) => { s.youtube.clientId = v; } },
  { env: "GOOGLE_CLIENT_SECRET", field: "youtube.clientSecret", get: (s) => s.youtube.clientSecret, set: (s, v) => { s.youtube.clientSecret = v; } },
  { env: "LINKEDIN_CLIENT_ID", field: "linkedin.clientId", get: (s) => s.linkedin.clientId, set: (s, v) => { s.linkedin.clientId = v; } },
  { env: "LINKEDIN_CLIENT_SECRET", field: "linkedin.clientSecret", get: (s) => s.linkedin.clientSecret, set: (s, v) => { s.linkedin.clientSecret = v; } },
];

const fromEnv = (name: string) => (process.env[name] ?? "").trim();

/** Settings fields currently provided by the environment (e.g. ["meta.appId", "groqApiKey"]). */
export function envFields(): string[] {
  return ENV_KEYS.filter((k) => fromEnv(k.env)).map((k) => k.field);
}

export function loadSettings(): Settings {
  const s = readJson<Partial<Settings>>(SETTINGS_FILE, {});
  const out: Settings = {
    ...DEFAULT_SETTINGS,
    ...s,
    enabled: { ...DEFAULT_SETTINGS.enabled, ...s.enabled },
    meta: { ...DEFAULT_SETTINGS.meta, ...s.meta },
    linkedin: { ...DEFAULT_SETTINGS.linkedin, ...s.linkedin },
    youtube: { ...DEFAULT_SETTINGS.youtube, ...s.youtube },
    customTopics: { ...s.customTopics },
    socialHandles: { ...s.socialHandles },
    schedule: { ...DEFAULT_SETTINGS.schedule, ...s.schedule },
  };
  for (const k of ENV_KEYS) if (fromEnv(k.env)) k.set(out, fromEnv(k.env));
  return out;
}

export function saveSettings(s: Settings) {
  // never persist values that come from .env
  const copy: Settings = JSON.parse(JSON.stringify(s));
  for (const k of ENV_KEYS) if (fromEnv(k.env)) k.set(copy, "");
  writeJson(SETTINGS_FILE, copy);
}

export function updateSettings(fn: (s: Settings) => void): Settings {
  const s = loadSettings();
  fn(s);
  saveSettings(s);
  return s;
}

const at = (h?: string) => (h ? `@${h.trim().replace(/^@+/, "")}` : "");

/** The @handle to mention in each platform's caption ("" = no mention). */
export function platformHandles(s: Settings): Record<Platform, string> {
  const page = selectedPage(s);
  const o = s.socialHandles ?? {};
  return {
    instagram: at(o.instagram) || at(page?.igUsername),
    youtube: at(o.youtube) || at(s.youtube.handle),
    facebook: at(o.facebook),
    linkedin: at(o.linkedin),
  };
}

export function selectedPage(s: Settings): MetaPage | undefined {
  return s.meta.pages.find((p) => p.id === s.meta.selectedPageId) ?? s.meta.pages[0];
}

/** Settings as sent to the browser: secrets and tokens are never exposed. */
export function publicSettings(s: Settings) {
  const page = selectedPage(s);
  return {
    ...s,
    envFields: envFields(),
    groqApiKey: "",
    hasGroqKey: !!s.groqApiKey,
    geminiApiKey: "",
    hasGeminiKey: !!s.geminiApiKey,
    meta: {
      appId: envFields().includes("meta.appId") ? "" : s.meta.appId,
      appSecret: "",
      hasAppSecret: !!s.meta.appSecret,
      graphVersion: s.meta.graphVersion,
      pages: s.meta.pages.map((p) => ({ id: p.id, name: p.name, igUserId: p.igUserId, igUsername: p.igUsername })),
      selectedPageId: page?.id ?? "",
    },
    linkedin: {
      clientId: envFields().includes("linkedin.clientId") ? "" : s.linkedin.clientId,
      clientSecret: "",
      hasClientSecret: !!s.linkedin.clientSecret,
      apiVersion: s.linkedin.apiVersion,
      connected: !!s.linkedin.accessToken,
      name: s.linkedin.name,
      expiresAt: s.linkedin.expiresAt,
      postsAs: (process.env.LINKEDIN_ORG_ID ?? "").trim() ? "page" : "profile",
      pageReady: !!(process.env.LINKEDIN_ORG_ID ?? "").trim() && s.linkedin.orgScope,
    },
    youtube: {
      clientId: envFields().includes("youtube.clientId") ? "" : s.youtube.clientId,
      clientSecret: "",
      hasClientSecret: !!s.youtube.clientSecret,
      connected: !!s.youtube.refreshToken,
      channelTitle: s.youtube.channelTitle,
      privacy: s.youtube.privacy,
    },
    detectedHandles: platformHandles({ ...s, socialHandles: {} }),
    usedTopics: s.usedTopics.slice(-50).reverse(),
    usedCount: s.usedTopics.length,
    bank: bankStats(s.categories, s.usedTopics, s.customTopics),
    connections: {
      facebook: page ? page.name : null,
      instagram: page?.igUserId ? `@${page.igUsername ?? page.igUserId}` : null,
      linkedin: s.linkedin.accessToken ? s.linkedin.name || "connected" : null,
      youtube: s.youtube.refreshToken ? s.youtube.channelTitle || "connected" : null,
    } as Record<Platform, string | null>,
  };
}
export type PublicSettings = ReturnType<typeof publicSettings>;

export function loadHistory(): HistoryEntry[] {
  return readJson<HistoryEntry[]>(HISTORY_FILE, []);
}

export function getEntry(id: string): HistoryEntry | undefined {
  return loadHistory().find((e) => e.id === id);
}

export function upsertHistory(entry: HistoryEntry) {
  const h = loadHistory();
  const i = h.findIndex((e) => e.id === entry.id);
  if (i >= 0) h[i] = entry;
  else h.unshift(entry);
  writeJson(HISTORY_FILE, h.slice(0, 300));
}

export function deleteHistory(id: string) {
  const h = loadHistory();
  const e = h.find((x) => x.id === id);
  if (e?.video) fs.rmSync(path.dirname(e.video), { recursive: true, force: true });
  writeJson(HISTORY_FILE, h.filter((x) => x.id !== id));
}
