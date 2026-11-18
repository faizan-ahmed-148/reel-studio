"use client";

import { useState } from "react";
import type { HistoryEntry, Platform } from "@/lib/store";
import { PLATFORMS, PLATFORM_NAME, RUNNING, fmtDate, useApp } from "./AppContext";

const STATUS: Record<string, [string, string]> = {
  generating: ["Script", "warn"],
  rendering: ["Rendering", "warn"],
  publishing: ["Uploading", "warn"],
  ready: ["Ready", ""],
  published: ["Published", "ok"],
  publish_failed: ["Upload failed", "bad"],
  failed: ["Failed", "bad"],
};

export function StatusPill({ status }: { status: string }) {
  const [label, cls] = STATUS[status] ?? [status, ""];
  return <span className={`pill ${cls}`}>{RUNNING.includes(status) && <span className="spin sm" />}{label}</span>;
}

export function VideoGrid({ items, empty }: { items: HistoryEntry[]; empty?: string }) {
  const [captionFor, setCaptionFor] = useState<HistoryEntry | null>(null);
  const [scriptFor, setScriptFor] = useState<HistoryEntry | null>(null);
  if (!items.length) return <div className="empty">{empty ?? "Abhi tak koi video nahi bani."}</div>;
  return (
    <>
      <div className="vids">
        {items.map((h) => <VideoCard key={h.id} h={h} onCaption={() => setCaptionFor(h)} onScript={() => setScriptFor(h)} />)}
      </div>
      {captionFor && <CaptionModal entry={captionFor} onClose={() => setCaptionFor(null)} />}
      {scriptFor && <ScriptModal entry={scriptFor} onClose={() => setScriptFor(null)} />}
    </>
  );
}

function VideoCard({ h, onCaption, onScript }: { h: HistoryEntry; onCaption: () => void; onScript: () => void }) {
  const { d, publish, remove } = useApp();
  const isRunning = RUNNING.includes(h.status);
  const conn = d?.connections;
  const connected = PLATFORMS.filter((p) => conn?.[p]);
  const failed = Object.entries(h.results).filter(([, r]) => r && !r.ok);
  return (
    <article className="vid">
      <div className="vid-media">
        {h.video && !isRunning ? (
          <video src={`/api/video/${h.id}`} poster={`/api/thumb/${h.id}`} controls preload="none" playsInline />
        ) : isRunning ? (
          <div><span className="spin" /><div style={{ marginTop: 8 }}>{h.progress || STATUS[h.status]?.[0]}</div></div>
        ) : <div>Video nahi bani</div>}
      </div>
      <div className="vid-body">
        <div className="vid-top">
          <div className="vid-title">{h.topic || "Topic chuna ja raha hai…"}</div>
          <StatusPill status={h.status} />
        </div>
        <div className="vid-meta">
          {h.category && <span className="tag">{h.category}</span>} {fmtDate(h.created)} · {h.trigger === "schedule" ? "⏰ auto" : "manual"}
        </div>
        {Object.keys(h.results).length > 0 && (
          <div className="plats">
            {PLATFORMS.filter((p) => h.results[p]).map((p) => (
              <span key={p} className={`pill ${h.results[p]!.ok ? "ok" : "bad"}`}>{h.results[p]!.ok ? "✔" : "✖"} {PLATFORM_NAME[p]}</span>
            ))}
          </div>
        )}
        {h.error && <div className="err-text">{h.error}</div>}
        {failed.map(([p, r]) => <div key={p} className="err-text"><b>{PLATFORM_NAME[p as Platform]}:</b> {r!.error}</div>)}
        {!isRunning && (
          <div className="actions">
            {h.video && connected.length > 0 && h.status !== "published" && <button className="sm" onClick={() => publish(h.id)}>Upload</button>}
            {h.video && h.status === "published" && connected.filter((p) => !h.results[p]?.ok).map((p) => (
              <button key={p} className="sm ghost" onClick={() => publish(h.id, p)}>+ {PLATFORM_NAME[p]}</button>
            ))}
            {h.video && <button className="sm ghost" onClick={onCaption}>Caption</button>}
            {h.script && <button className="sm ghost" onClick={onScript}>Script</button>}
            {h.video && <a className="btn sm ghost" href={`/api/video/${h.id}?download=1`} title="Download">⬇</a>}
            {h.igVideo && <a className="btn sm ghost" href={`/api/video/${h.id}?download=1&ig=1`} title="Instagram version download">⬇ IG</a>}
            <button className="sm danger" onClick={() => remove(h.id)} title="Delete">🗑</button>
          </div>
        )}
      </div>
    </article>
  );
}

function CaptionModal({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const { notify, reloadHistory } = useApp();
  const [tab, setTab] = useState<Platform>("instagram");
  const init = (e: HistoryEntry) => Object.fromEntries(PLATFORMS.map((p) => [p, e.captions?.[p] ?? e.caption ?? ""])) as Record<Platform, string>;
  const [draft, setDraft] = useState(init(entry));
  const [title, setTitle] = useState(entry.youtubeTitle ?? "");
  const [busy, setBusy] = useState(false);

  async function regen() {
    setBusy(true);
    const res = await fetch(`/api/caption/${entry.id}`, { method: "POST" });
    const r = await res.json();
    setBusy(false);
    if (!res.ok) return notify("err", r.error);
    setDraft(init(r));
    setTitle(r.youtubeTitle ?? "");
    void reloadHistory();
  }
  async function saveEdits() {
    const res = await fetch(`/api/caption/${entry.id}`, { method: "PUT", body: JSON.stringify({ captions: draft, youtubeTitle: title }) });
    notify(res.ok ? "ok" : "err", res.ok ? "Caption save ho gaya ✔" : "Save nahi hua");
    void reloadHistory();
  }
  const text = draft[tab] ?? "";
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Caption — {entry.topic}</h2>
          <button className="sm ghost" onClick={onClose}>✕</button>
        </div>
        <p className="hint">Har platform ka apna caption aur hashtags. Edit karke Save karein — upload par yahi jayega.</p>
        <div className="seg">
          {PLATFORMS.map((p) => <button key={p} className={tab === p ? "on" : ""} onClick={() => setTab(p)}>{PLATFORM_NAME[p]}</button>)}
        </div>
        {tab === "youtube" && (
          <>
            <label>YouTube title</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} />
          </>
        )}
        <textarea className="caption-edit" value={text} onChange={(e) => setDraft({ ...draft, [tab]: e.target.value })} />
        <p className="small">{text.length} characters · {(text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length} hashtags</p>
        <div className="actions">
          <button className="sm" onClick={async () => { await navigator.clipboard.writeText(text); notify("ok", "Copy ho gaya ✔"); }}>📋 Copy</button>
          <button className="sm ghost" onClick={saveEdits}>Save edits</button>
          <button className="sm ghost" disabled={busy} onClick={regen}>{busy ? <span className="spin sm" /> : "✨"} Naya caption banao</button>
        </div>
      </div>
    </div>
  );
}

function ScriptModal({ entry, onClose }: { entry: HistoryEntry; onClose: () => void }) {
  const sc = entry.script;
  if (!sc) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{entry.topic}</h2>
          <button className="sm ghost" onClick={onClose}>✕</button>
        </div>
        {sc.hook && <p className="hint">Hook: <b>{sc.hook}</b></p>}
        {sc.scenes.map((s, i) => (
          <div className="scene" key={i}>
            <b>{i + 1}. {s.heading || sc.hook}</b> {s.visual && <span className="pill">{s.visual.type}</span>}
            {s.subtitle && <div style={{ marginTop: 4 }}>{s.subtitle}</div>}
            <div className="small" style={{ marginTop: 4 }}>{s.narration}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
