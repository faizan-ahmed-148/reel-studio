"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RUNNING, useApp } from "../components/AppContext";
import { Loading, PageHead } from "../components/Shell";
import { StatusPill } from "../components/Videos";

interface Topic { title: string; used: boolean }
interface Cat { name: string; topics: Topic[] }

export default function Create() {
  const { d, history, busy, runNow } = useApp();
  const [topic, setTopic] = useState("");
  const [upload, setUpload] = useState(true);
  const [ideas, setIdeas] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/topics").then((r) => r.json()).then((r: { categories: Cat[] }) => {
      const fresh = r.categories.flatMap((c) => c.topics.filter((t) => !t.used).map((t) => t.title));
      setIdeas(fresh.sort(() => Math.random() - 0.5).slice(0, 8));
    });
  }, []);

  if (!d) return <Loading />;
  const running = history.find((h) => RUNNING.includes(h.status));
  const stepIdx = running ? ({ generating: 0, rendering: 1, publishing: 3 } as Record<string, number>)[running.status] ?? 0 : -1;
  const steps = ["Script + diagrams", "Voice + animation", "Caption + hashtags", "Upload"];
  const captionStep = running?.progress?.toLowerCase().includes("caption");

  return (
    <>
      <PageHead title="Create reel" sub="~60 second ki professional reel: architecture diagrams, AI voice, music, subtitles." />
      <section className="card create">
        <label>Topic</label>
        <div className="create-row">
          <input value={topic} onChange={(e) => setTopic(e.target.value)} name="reel-topic-x" autoComplete="off" data-1p-ignore="true"
            placeholder="Khali chhorein to agla naya topic khud chuna jayega" />
        </div>
        {ideas.length > 0 && (
          <div className="chips" style={{ marginTop: 12 }}>
            <span className="small">Ideas:</span>
            {ideas.map((t) => <button key={t} className="chip" onClick={() => setTopic(t)}>{t}</button>)}
          </div>
        )}
        <label className="check" style={{ marginTop: 16 }}>
          <span className="switch"><input type="checkbox" checked={upload} onChange={(e) => setUpload(e.target.checked)} /><span /></span>
          Banne ke baad connected accounts par upload karo {d.aiLabel && <span className="pill">AI label ON</span>}
        </label>
        <div className="row" style={{ marginTop: 16 }}>
          <button className="big" disabled={busy || !d.hasGroqKey} onClick={async () => { if (await runNow(topic, upload)) setTopic(""); }}>
            {busy ? <span className="spin sm" /> : "⚡"} {upload ? "Banao + Upload" : "Sirf banao (preview)"}
          </button>
          {!d.hasGroqKey && <Link href="/settings" className="link">Pehle Groq key add karein →</Link>}
        </div>
      </section>

      {running && (
        <section className="card">
          <div className="card-head">
            <h2>{running.topic || "Topic chuna ja raha hai…"}</h2>
            <StatusPill status={running.status} />
          </div>
          <div className="steps">
            {steps.map((label, i) => {
              const cur = i === 2 && captionStep ? 2 : stepIdx;
              const state = i < cur ? "done" : i === cur ? "now" : "";
              return (
                <div key={label} className={`step ${state}`}>
                  <b>{state === "done" ? "✔ Done" : state === "now" ? "Chal raha hai" : "Baqi"}</b>
                  {label}
                  {state === "now" && running.progress && <div className="small">{running.progress}</div>}
                </div>
              );
            })}
          </div>
        </section>
      )}
      {!running && history[0] && (
        <p className="hint">Pichli video: <b>{history[0].topic}</b> — <Link className="link" href="/videos">Videos mein dekhein →</Link></p>
      )}
    </>
  );
}
