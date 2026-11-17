"use client";

import { useState } from "react";
import { useApp } from "../components/AppContext";
import { Loading, PageHead } from "../components/Shell";
import { VideoGrid } from "../components/Videos";

const FILTERS = [
  ["all", "Sab"], ["published", "Published"], ["ready", "Ready"], ["failed", "Failed"],
] as const;

export default function Videos() {
  const { d, history } = useApp();
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  if (!d) return <Loading />;
  const items = history.filter((h) =>
    f === "all" ? true : f === "failed" ? h.status === "failed" || h.status === "publish_failed" : h.status === f);
  return (
    <>
      <PageHead title="Videos" sub={`${history.length} videos · ${history.filter((h) => h.status === "published").length} published`}
        actions={<div className="seg">{FILTERS.map(([k, l]) => <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}</button>)}</div>} />
      <section className="card"><VideoGrid items={items} /></section>
    </>
  );
}
