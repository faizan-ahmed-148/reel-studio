"use client";

import { useEffect, useState } from "react";
import { GEMINI_VOICES, VOICES } from "@/lib/voices";
import { EnvLocked, useApp } from "../components/AppContext";
import { Loading, PageHead } from "../components/Shell";

const SECRET = { type: "text", className: "secret", autoComplete: "off", spellCheck: false, "data-1p-ignore": "true", "data-lpignore": "true" } as const;

export default function SettingsPage() {
  const { d, set, save, saving, notify } = useApp();
  const [models, setModels] = useState<string[]>([]);
  const [modelErr, setModelErr] = useState("");
  const [playing, setPlaying] = useState<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState(false);

  async function loadModels() {
    const r = await (await fetch("/api/groq/models")).json();
    setModels(r.ok ? r.models : []);
    setModelErr(r.ok ? "" : r.error);
    return r;
  }
  useEffect(() => { if (d?.hasGroqKey) void loadModels(); }, [d?.hasGroqKey]);

  if (!d) return <Loading />;

  async function preview() {
    if (playing) { playing.pause(); setPlaying(null); return; }
    if (!(await save())) return; // preview uses the saved key/style
    const voice = d!.ttsProvider === "gemini" ? d!.geminiVoice : d!.voice;
    setPreviewing(true);
    const res = await fetch(`/api/voice-preview?provider=${d!.ttsProvider}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(d!.voiceRate)}`);
    setPreviewing(false);
    if (!res.ok) return notify("err", `Voice preview: ${await res.text()}`);
    const a = new Audio(URL.createObjectURL(await res.blob()));
    a.onended = () => setPlaying(null);
    void a.play();
    setPlaying(a);
  }

  return (
    <>
      <PageHead title="Settings" sub="AI script, voice, music aur brand." actions={<button disabled={saving} onClick={() => save()}>Save all</button>} />

      <div className="grid-2">
        <section className="card">
          <h2>✍️ AI script (Groq)</h2>
          <label>Groq API key {d.hasGroqKey && <span className="pill ok">saved</span>}</label>
          {d.envFields.includes("groqApiKey") ? <EnvLocked name="GROQ_API_KEY" /> : (
<input {...SECRET} name="groq-key-x" value={d.newGroqKey} onChange={(e) => set({ newGroqKey: e.target.value })}
            placeholder={d.hasGroqKey ? "•••••• saved (badalne ke liye nayi likhein)" : "gsk_… (free: console.groq.com/keys)"} />
)}
          <label>Model</label>
          <div className="with-btn">
            {models.length ? (
              <select value={d.groqModel} onChange={(e) => set({ groqModel: e.target.value })}>
                {!models.includes(d.groqModel) && <option value={d.groqModel}>{d.groqModel} (not available)</option>}
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            ) : <input value={d.groqModel} onChange={(e) => set({ groqModel: e.target.value })} />}
            <button className="ghost sm" onClick={async () => { const r = await loadModels(); notify(r.ok ? "ok" : "err", r.ok ? "Key theek hai ✔" : r.error); }}>Test</button>
          </div>
          {modelErr && <p className="small bad-text">{modelErr}</p>}
          <label>Channel ka niche (AI ko context)</label>
          <textarea value={d.niche} onChange={(e) => set({ niche: e.target.value })} />
        </section>

        <section className="card">
          <h2>🎙️ Voice</h2>
          <div className="seg full-seg">
            <button className={d.ttsProvider === "gemini" ? "on" : ""} onClick={() => set({ ttsProvider: "gemini" })}>✨ Gemini (insaan jaisi)</button>
            <button className={d.ttsProvider === "edge" ? "on" : ""} onClick={() => set({ ttsProvider: "edge" })}>Microsoft Edge</button>
          </div>
          {d.ttsProvider === "gemini" ? (
            <>
              <label>Gemini API key {d.hasGeminiKey && <span className="pill ok">saved</span>}</label>
              {d.envFields.includes("geminiApiKey") ? <EnvLocked name="GEMINI_API_KEY" /> : (
<input {...SECRET} name="gemini-key-x" value={d.newGeminiKey} onChange={(e) => set({ newGeminiKey: e.target.value })}
                placeholder={d.hasGeminiKey ? "•••••• saved" : "free: aistudio.google.com/apikey"} />
)}
              <label>Voice</label>
              <div className="with-btn">
                <select value={d.geminiVoice} onChange={(e) => set({ geminiVoice: e.target.value })}>
                  {GEMINI_VOICES.map(([v, n]) => <option key={v} value={v}>{v} — {n}</option>)}
                </select>
                <button className="ghost sm" onClick={preview}>{previewing ? <span className="spin sm" /> : playing ? "■ Stop" : "▶ Suno"}</button>
              </div>
              <label>Bolne ka andaz</label>
              <textarea value={d.geminiStyle} onChange={(e) => set({ geminiStyle: e.target.value })} />
              <p className="small">Free tier: ~10 requests/din. Ek reel = 1 request, har “Suno” = 1 request. Quota khatam ho to reel Edge voice se banti hai.</p>
            </>
          ) : (
            <>
              <label>Voice</label>
              <div className="with-btn">
                <select value={d.voice} onChange={(e) => set({ voice: e.target.value })}>
                  {VOICES.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
                <button className="ghost sm" onClick={preview}>{previewing ? <span className="spin sm" /> : playing ? "■ Stop" : "▶ Suno"}</button>
              </div>
              <p className="small">{VOICES.find((v) => v.id === d.voice)?.note}</p>
              <label>Speed</label>
              <select value={d.voiceRate} onChange={(e) => set({ voiceRate: e.target.value })}>
                {["-5%", "+0%", "+5%", "+10%", "+15%", "+20%"].map((r) => <option key={r} value={r}>{r === "+0%" ? "Normal" : r}</option>)}
              </select>
            </>
          )}
        </section>

        <section className="card">
          <h2>🎵 Music & sound</h2>
          <label className="check">
            <span className="switch"><input type="checkbox" checked={d.musicMode === "auto"} onChange={(e) => set({ musicMode: e.target.checked ? "auto" : "off" })} /><span /></span>
            Background music + transition sounds
          </label>
          <label>Music volume: {Math.round(d.musicVolume * 100)}%</label>
          <input type="range" min={0.05} max={0.5} step={0.01} value={d.musicVolume} onChange={(e) => set({ musicVolume: Number(e.target.value) })} />
          <p className="small">Aapki apni music: koi bhi royalty-free MP3 <code>reel-studio/assets/music/</code> folder mein daal dein — har video mein random lagegi. Warna built-in lo-fi beat lagti hai. Voice ke waqt music khud dheemi ho jati hai.</p>
        </section>

        <section className="card">
          <h2>🏷️ Brand</h2>
          <label>Handle (video par)</label>
          <input value={d.handle} onChange={(e) => set({ handle: e.target.value })} />
          <label>Har post ke fixed hashtags</label>
          <input value={d.hashtags} onChange={(e) => set({ hashtags: e.target.value })} />
          <label>Yeh hashtags kabhi na lagao</label>
          <input value={d.blockedHashtags} onChange={(e) => set({ blockedHashtags: e.target.value })} placeholder="#pakistan #urdu" />
          <p className="small">In ke milte-julte tags bhi hat jate hain (jaise #pakistanidevelopers, #techinurdu).</p>
          <label className="check">
            <span className="switch"><input type="checkbox" checked={d.aiLabel} onChange={(e) => set({ aiLabel: e.target.checked })} /><span /></span>
            Har post par AI label / disclosure
          </label>
        </section>
      </div>
      <button className="full" disabled={saving} onClick={() => save()}>Save all</button>
    </>
  );
}
