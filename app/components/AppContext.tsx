"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { HistoryEntry, Platform, PublicSettings } from "@/lib/store";

export const PLATFORMS: Platform[] = ["instagram", "facebook", "youtube", "linkedin"];
export const PLATFORM_NAME: Record<Platform, string> = { instagram: "Instagram", facebook: "Facebook", youtube: "YouTube", linkedin: "LinkedIn" };
export const RUNNING = ["generating", "rendering", "publishing"];

export type Draft = PublicSettings & {
  newGroqKey: string;
  newGeminiKey: string;
  newMetaSecret: string;
  newLiSecret: string;
  newYtSecret: string;
};

interface Ctx {
  d: Draft | null;
  set: (patch: Partial<Draft>) => void;
  save: (override?: Partial<Draft>, extra?: Record<string, unknown>) => Promise<boolean>;
  saving: boolean;
  history: HistoryEntry[];
  busy: boolean;
  nextRuns: string[];
  reloadHistory: () => Promise<void>;
  reloadSettings: () => Promise<void>;
  notify: (type: "ok" | "err", text: string) => void;
  toast: { type: "ok" | "err"; text: string } | null;
  clearToast: () => void;
  runNow: (topic: string, publish: boolean) => Promise<boolean>;
  publish: (id: string, platform?: Platform) => Promise<void>;
  remove: (id: string) => Promise<void>;
  disconnect: (platform: "meta" | "linkedin" | "youtube") => Promise<void>;
}

const AppCtx = createContext<Ctx | null>(null);
export const useApp = () => {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
};

export function fmtDate(d: string | number) {
  return new Date(d).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [d, setD] = useState<Draft | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [nextRuns, setNextRuns] = useState<string[]>([]);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const notify = useCallback((type: "ok" | "err", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 6000);
  }, []);

  const reloadSettings = useCallback(async () => {
    const s: PublicSettings = await (await fetch("/api/settings")).json();
    setD({ ...s, newGroqKey: "", newGeminiKey: "", newMetaSecret: "", newLiSecret: "", newYtSecret: "" });
  }, []);

  const reloadHistory = useCallback(async () => {
    const r = await (await fetch("/api/history")).json();
    setHistory(r.history);
    setBusy(r.busy);
    setNextRuns(r.nextRuns);
  }, []);

  useEffect(() => {
    void reloadSettings();
    void reloadHistory();
    const q = new URLSearchParams(window.location.search);
    if (q.get("error")) notify("err", q.get("error")!);
    const c = q.get("connected");
    if (c) notify("ok", `${c === "meta" ? "Facebook + Instagram" : c === "youtube" ? "YouTube" : "LinkedIn"} connect ho gaya ✔`);
    if (q.get("error") || c) window.history.replaceState(null, "", window.location.pathname);
  }, [reloadSettings, reloadHistory, notify]);

  const running = history.some((h) => RUNNING.includes(h.status));
  useEffect(() => {
    const t = setInterval(reloadHistory, busy || running ? 2000 : 15000);
    return () => clearInterval(t);
  }, [busy, running, reloadHistory]);

  const set = useCallback((patch: Partial<Draft>) => setD((cur) => (cur ? { ...cur, ...patch } : cur)), []);

  const save = useCallback(async (override: Partial<Draft> = {}, extra: Record<string, unknown> = {}) => {
    if (!d) return false;
    const x = { ...d, ...override };
    setSaving(true);
    const res = await fetch("/api/settings", {
      method: "POST",
      body: JSON.stringify({
        groqApiKey: x.newGroqKey, groqModel: x.groqModel, niche: x.niche, handle: x.handle, hashtags: x.hashtags, blockedHashtags: x.blockedHashtags, socialHandles: x.socialHandles,
        voice: x.voice, voiceRate: x.voiceRate, ttsProvider: x.ttsProvider, geminiApiKey: x.newGeminiKey,
        geminiVoice: x.geminiVoice, geminiStyle: x.geminiStyle, categories: x.categories, autoPublish: x.autoPublish,
        enabled: x.enabled, topicQueue: x.topicQueue, aiLabel: x.aiLabel, musicMode: x.musicMode, musicVolume: x.musicVolume,
        meta: { appId: x.meta.appId, appSecret: x.newMetaSecret, graphVersion: x.meta.graphVersion, selectedPageId: x.meta.selectedPageId },
        linkedin: { clientId: x.linkedin.clientId, clientSecret: x.newLiSecret, apiVersion: x.linkedin.apiVersion },
        youtube: { clientId: x.youtube.clientId, clientSecret: x.newYtSecret, privacy: x.youtube.privacy },
        schedule: x.schedule,
        ...extra,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      notify("err", (await res.json().catch(() => ({}))).error || "Save nahi hua");
      return false;
    }
    await reloadSettings();
    await reloadHistory();
    notify("ok", "Save ho gaya ✔");
    return true;
  }, [d, notify, reloadSettings, reloadHistory]);

  const runNow = useCallback(async (topic: string, publish: boolean) => {
    const res = await fetch("/api/run", { method: "POST", body: JSON.stringify({ topic, publish }) });
    const r = await res.json();
    if (!res.ok) { notify("err", r.error); return false; }
    notify("ok", "Video banna shuru — 2-3 minute lagenge");
    setTimeout(reloadHistory, 600);
    return true;
  }, [notify, reloadHistory]);

  const publish = useCallback(async (id: string, platform?: Platform) => {
    notify("ok", `${platform ? PLATFORM_NAME[platform] : "Platforms"} par upload ho rahi hai…`);
    const req = fetch(`/api/publish/${id}`, { method: "POST", body: JSON.stringify(platform ? { platforms: [platform] } : {}) });
    setTimeout(reloadHistory, 800);
    const res = await req;
    const r = await res.json();
    if (!res.ok) notify("err", r.error);
    else notify(r.status === "published" ? "ok" : "err", r.status === "published" ? "Upload ho gayi ✔" : r.error || "Upload fail — card par error dekhein");
    await reloadHistory();
  }, [notify, reloadHistory]);

  const remove = useCallback(async (id: string) => {
    if (!confirm("Yeh video delete karni hai?")) return;
    await fetch(`/api/history/${id}`, { method: "DELETE" });
    await reloadHistory();
  }, [reloadHistory]);

  const disconnect = useCallback(async (platform: "meta" | "linkedin" | "youtube") => {
    if (!confirm("Disconnect karna hai?")) return;
    await fetch("/api/auth/disconnect", { method: "POST", body: JSON.stringify({ platform }) });
    await reloadSettings();
  }, [reloadSettings]);

  return (
    <AppCtx.Provider value={{
      d, set, save, saving, history, busy, nextRuns, reloadHistory, reloadSettings, notify, toast,
      clearToast: () => setToast(null), runNow, publish, remove, disconnect,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

/** Read-only field shown when a key comes from .env.local */
export function EnvLocked({ name }: { name: string }) {
  return <input disabled value={`🔒 .env.local se (${name})`} className="env-locked" />;
}
