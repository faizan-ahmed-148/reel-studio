"use client";

import Link from "next/link";
import { useState } from "react";
import { PLATFORMS, PLATFORM_NAME, fmtDate, useApp } from "../components/AppContext";
import { Loading, PageHead } from "../components/Shell";

const DAYS = ["Itwar", "Peer", "Mangal", "Budh", "Jumerat", "Juma", "Hafta"];

export default function Schedule() {
  const { d, set, save, saving, nextRuns } = useApp();
  const [newTime, setNewTime] = useState("09:00");
  if (!d) return <Loading />;
  const sc = d.schedule;
  const toggleDay = (i: number) => set({ schedule: { ...sc, days: sc.days.includes(i) ? sc.days.filter((x) => x !== i) : [...sc.days, i].sort() } });
  const addTime = () => {
    if (!/^\d{1,2}:\d{2}$/.test(newTime) || sc.times.includes(newTime)) return;
    set({ schedule: { ...sc, times: [...sc.times, newTime].sort() } });
  };
  const targets = PLATFORMS.filter((p) => d.enabled[p] && d.connections[p]);

  return (
    <>
      <PageHead title="Schedule" sub="Har scheduled waqt par: naya topic → script → voice → video → caption → upload. Sab automatic."
        actions={<button disabled={saving} onClick={() => save()}>Save schedule</button>} />

      <div className="grid-2">
        <section className="card">
          <label className="check big-check">
            <span className="switch"><input type="checkbox" checked={sc.enabled} onChange={(e) => set({ schedule: { ...sc, enabled: e.target.checked } })} /><span /></span>
            Automatic posting {sc.enabled ? "ON" : "OFF"}
          </label>

          <label>Kin dinon mein?</label>
          <div className="days">
            {DAYS.map((name, i) => <button key={i} className={sc.days.includes(i) ? "" : "off"} onClick={() => toggleDay(i)}>{name}</button>)}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="sm ghost" onClick={() => set({ schedule: { ...sc, days: [0, 1, 2, 3, 4, 5, 6] } })}>Rozana</button>
            <button className="sm ghost" onClick={() => set({ schedule: { ...sc, days: [1, 2, 3, 4, 5] } })}>Peer–Juma</button>
            <button className="sm ghost" onClick={() => set({ schedule: { ...sc, days: [] } })}>Clear</button>
          </div>

          <label>Kis waqt? (har time par ek nayi video)</label>
          <div className="times">
            {sc.times.map((t) => (
              <span key={t} className="time-pill">{t}
                <button onClick={() => set({ schedule: { ...sc, times: sc.times.filter((x) => x !== t) } })}>×</button>
              </span>
            ))}
            <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
            <button className="sm ghost" onClick={addTime}>+ Add</button>
          </div>

          <label>Timezone</label>
          <input value={sc.timezone} onChange={(e) => set({ schedule: { ...sc, timezone: e.target.value } })} />

          <label className="check">
            <span className="switch"><input type="checkbox" checked={d.autoPublish} onChange={(e) => set({ autoPublish: e.target.checked })} /><span /></span>
            Banne ke baad khud upload karo
          </label>
          <button className="full" disabled={saving} onClick={() => save()}>Save schedule</button>
        </section>

        <section className="card">
          <h2>Agli auto posts</h2>
          {nextRuns.length ? (
            <ul className="next">{nextRuns.map((r) => <li key={r}><span>{fmtDate(r)}</span><span className="pill ok">auto</span></li>)}</ul>
          ) : <p className="small">Schedule off hai ya koi din/time select nahi.</p>}

          <h2 style={{ marginTop: 24 }}>Har post kahan jayegi</h2>
          {targets.length ? (
            <div className="plats">{targets.map((p) => <span key={p} className="pill ok">{PLATFORM_NAME[p]}</span>)}</div>
          ) : <p className="small">Koi account connect nahi — <Link className="link" href="/accounts">Accounts</Link> dekhein.</p>}

          <h2 style={{ marginTop: 24 }}>Topic kaise chuna jata hai</h2>
          <ol className="small explain">
            <li>Pehle <Link className="link" href="/topics">Queue</Link> ke topics (order se).</li>
            <li>Phir enabled categories se agla naya topic — har dafa category badalti hai.</li>
            <li>Bank khatam ho to AI naye topics banata hai. Koi topic kabhi repeat nahi hota.</li>
          </ol>
          <p className="small">⚠ Schedule tab chalta hai jab server chal raha ho (PC on ho ya server par deploy ho).</p>
        </section>
      </div>
    </>
  );
}
