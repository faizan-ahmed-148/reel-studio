"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PLATFORMS, PLATFORM_NAME, fmtDate, useApp } from "./components/AppContext";
import { Loading, PageHead } from "./components/Shell";
import { VideoGrid } from "./components/Videos";

export default function Dashboard() {
  const { d, history, nextRuns, runNow, busy } = useApp();
  const [topic, setTopic] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => { if (d) setLeft(d.bank.left); }, [d]);
  if (!d) return <Loading />;

  const published = history.filter((h) => h.status === "published").length;
  const connected = PLATFORMS.filter((p) => d.connections[p]).length;
  const steps = [
    { ok: d.hasGroqKey, label: "Groq API key (script)", href: "/settings" },
    { ok: d.hasGeminiKey || d.ttsProvider === "edge", label: "Gemini key (insaan jaisi voice)", href: "/settings" },
    { ok: connected > 0, label: "Kam az kam ek account connect", href: "/accounts" },
    { ok: d.schedule.enabled, label: "Auto-posting schedule ON", href: "/schedule" },
  ];
  const done = steps.filter((s) => s.ok).length;

  return (
    <>
      <PageHead title="Dashboard" sub="Roz ek naya software topic — AI script, voice, animated video, aur auto upload." />

      <div className="stats">
        <div className="stat"><span>Videos</span><b>{history.length}</b><small>{published} published</small></div>
        <div className="stat"><span>Naye topics baqi</span><b>{left ?? "—"}</b><small>{d.usedCount} ban chuke, repeat nahi honge</small></div>
        <div className="stat"><span>Accounts</span><b>{connected}/4</b><small>{PLATFORMS.filter((p) => d.connections[p]).map((p) => PLATFORM_NAME[p]).join(", ") || "koi connect nahi"}</small></div>
        <div className="stat"><span>Agli auto post</span><b className="sm">{d.schedule.enabled && nextRuns[0] ? fmtDate(nextRuns[0]) : "Off"}</b><small>{d.schedule.enabled ? `${d.schedule.times.join(", ")} · ${d.schedule.timezone}` : "Schedule page se ON karein"}</small></div>
      </div>

      <div className="grid-2">
        <section className="card create">
          <h2>Quick create</h2>
          <p className="hint">Topic likhein ya khali chhorein — AI khud naya topic chunega.</p>
          <div className="create-row">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} name="reel-topic-x" autoComplete="off" data-1p-ignore="true"
              placeholder="e.g. Kafka kaise kaam karta hai" />
            <button disabled={busy || !d.hasGroqKey} onClick={async () => { if (await runNow(topic, true)) setTopic(""); }}>
              {busy ? <span className="spin sm" /> : "⚡"} Banao + Upload
            </button>
          </div>
          <div style={{ marginTop: 10 }}><Link href="/create" className="link">Advanced options →</Link></div>
        </section>

        <section className="card">
          <h2>Setup {done}/{steps.length}</h2>
          <p className="hint">Yeh mukammal ho to sab kuch automatic chalega.</p>
          <ul className="checklist">
            {steps.map((s) => (
              <li key={s.label} className={s.ok ? "ok" : ""}>
                <span className="check-dot">{s.ok ? "✔" : ""}</span>
                {s.ok ? s.label : <Link href={s.href}>{s.label}</Link>}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Recent videos</h2>
          <Link href="/videos" className="link">Sab dekhein →</Link>
        </div>
        <VideoGrid items={history.slice(0, 4)} empty="Abhi tak koi video nahi bani — upar se pehli reel banayein." />
      </section>
    </>
  );
}
