"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../components/AppContext";
import { Loading, PageHead } from "../components/Shell";

interface Topic { title: string; custom: boolean; used: boolean; queued: boolean }
interface Cat { name: string; builtIn: boolean; enabled: boolean; topics: Topic[] }

export default function Topics() {
  const { d, save, runNow, busy, notify } = useApp();
  const [cats, setCats] = useState<Cat[]>([]);
  const [queue, setQueue] = useState<string[]>([]);
  const [active, setActive] = useState<string>("__all");
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"all" | "new" | "used">("all");
  const [newTopic, setNewTopic] = useState("");
  const [newCat, setNewCat] = useState("");

  const load = useCallback(async () => {
    const r = await (await fetch("/api/topics")).json();
    setCats(r.categories);
    setQueue(r.queue);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const list = cats.filter((c) => active === "__all" || c.name === active)
      .flatMap((c) => c.topics.map((t) => ({ ...t, category: c.name })));
    return list.filter((t) =>
      (show === "all" || (show === "new" ? !t.used : t.used)) && (!q || t.title.toLowerCase().includes(q.toLowerCase())));
  }, [cats, active, q, show]);

  if (!d) return <Loading />;
  const totals = cats.reduce((a, c) => ({ all: a.all + c.topics.length, used: a.used + c.topics.filter((t) => t.used).length }), { all: 0, used: 0 });

  async function setQueueList(list: string[]) {
    if (await save({ topicQueue: list })) await load();
  }
  async function toggleCategory(name: string) {
    const enabledNow = d!.categories.length === 0 ? cats.map((c) => c.name) : d!.categories;
    const next = enabledNow.includes(name) ? enabledNow.filter((c) => c !== name) : [...enabledNow, name];
    if (next.length === 0) return notify("err", "Kam az kam ek category ON rakhein.");
    if (await save({ categories: next.length === cats.length ? [] : next })) await load();
  }
  async function addTopic() {
    const cat = (newCat || (active !== "__all" ? active : "")).trim();
    const lines = newTopic.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!cat || !lines.length) return notify("err", "Category aur topic dono likhein.");
    const custom = { ...d!.customTopics, [cat]: [...new Set([...(d!.customTopics[cat] ?? []), ...lines])] };
    if (await save({}, { customTopics: custom })) { setNewTopic(""); setNewCat(""); setActive(cat); await load(); }
  }
  async function removeCustom(cat: string, title: string) {
    const custom = { ...d!.customTopics, [cat]: (d!.customTopics[cat] ?? []).filter((t) => t !== title) };
    if (await save({}, { customTopics: custom })) await load();
  }

  return (
    <>
      <PageHead title="Topics" sub={`${cats.length} categories · ${totals.all} topics · ${totals.all - totals.used} naye baqi · har topic sirf ek dafa banega`} />

      <div className="topics-layout">
        <aside className="card cat-list">
          <button className={`cat ${active === "__all" ? "on" : ""}`} onClick={() => setActive("__all")}>
            <span>Sab categories</span><small>{totals.all - totals.used}/{totals.all}</small>
          </button>
          {cats.map((c) => {
            const left = c.topics.filter((t) => !t.used).length;
            return (
              <div key={c.name} className={`cat ${active === c.name ? "on" : ""}`}>
                <button className="cat-name" onClick={() => setActive(c.name)}>
                  <span>{c.name}</span><small>{left}/{c.topics.length}</small>
                </button>
                <label className="switch sm" title="Auto schedule is category se topic uthaye?">
                  <input type="checkbox" checked={c.enabled} onChange={() => toggleCategory(c.name)} /><span />
                </label>
              </div>
            );
          })}
          <p className="small" style={{ padding: "8px 10px 0" }}>Toggle ON = auto schedule is category se bhi topic uthayega.</p>
        </aside>

        <div>
          <section className="card">
            <div className="toolbar">
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Topic search karein…" />
              <div className="seg">
                {(["all", "new", "used"] as const).map((k) => (
                  <button key={k} className={show === k ? "on" : ""} onClick={() => setShow(k)}>{k === "all" ? "Sab" : k === "new" ? "Naye" : "Ban chuke"}</button>
                ))}
              </div>
            </div>
            <table className="table">
              <thead><tr><th>Topic</th>{active === "__all" && <th>Category</th>}<th>Status</th><th /></tr></thead>
              <tbody>
                {rows.slice(0, 400).map((t) => (
                  <tr key={t.category + t.title} className={t.used ? "muted" : ""}>
                    <td>{t.title} {t.custom && <span className="pill">aapka</span>}</td>
                    {active === "__all" && <td className="small">{t.category}</td>}
                    <td>{t.used ? <span className="pill">Ban chuka</span> : t.queued ? <span className="pill warn">Queue mein</span> : <span className="pill ok">Naya</span>}</td>
                    <td className="row-actions">
                      {!t.used && <button className="sm" disabled={busy} onClick={() => runNow(t.title, true)}>Abhi banao</button>}
                      {!t.used && !t.queued && <button className="sm ghost" onClick={() => setQueueList([...queue, t.title])}>+ Queue</button>}
                      {t.custom && <button className="sm danger" onClick={() => removeCustom(t.category, t.title)}>🗑</button>}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="empty">Koi topic nahi mila.</td></tr>}
              </tbody>
            </table>
          </section>

          <div className="grid-2">
            <section className="card">
              <h2>Apna topic add karein</h2>
              <p className="hint">Har line pe ek topic. Nayi category ka naam likh dein to woh bhi ban jayegi.</p>
              <label>Category</label>
              <input list="cat-names" value={newCat} onChange={(e) => setNewCat(e.target.value)}
                placeholder={active !== "__all" ? active : "e.g. System Design ya nayi category"} />
              <datalist id="cat-names">{cats.map((c) => <option key={c.name} value={c.name} />)}</datalist>
              <label>Topic(s)</label>
              <textarea value={newTopic} onChange={(e) => setNewTopic(e.target.value)} placeholder={"Kafka kaise kaam karta hai\nRedis vs Memcached"} />
              <button className="full" onClick={addTopic}>Add karo</button>
            </section>

            <section className="card">
              <h2>Queue ({queue.length})</h2>
              <p className="hint">Schedule pehle yeh topics uthayega, order se.</p>
              {queue.length === 0 ? <p className="small">Queue khali hai — tab auto naya topic chuna jata hai.</p> : (
                <ol className="queue">
                  {queue.map((t, i) => (
                    <li key={t}>
                      <span>{t}</span>
                      <span className="row-actions">
                        {i > 0 && <button className="sm ghost" onClick={() => { const n = [...queue]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; void setQueueList(n); }}>↑</button>}
                        <button className="sm danger" onClick={() => setQueueList(queue.filter((x) => x !== t))}>✕</button>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
