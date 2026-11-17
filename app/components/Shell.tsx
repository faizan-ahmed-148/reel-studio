"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppProvider, PLATFORMS, PLATFORM_NAME, fmtDate, useApp } from "./AppContext";

const ICONS: Record<string, string> = {
  dashboard: "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  create: "M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z",
  videos: "M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-8 12.5v-9l6 4.5-6 4.5z",
  topics: "M4 6h16v2H4zm0 5h16v2H4zm0 5h10v2H4z",
  schedule: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 11h-5v-2h3V6h2v7z",
  accounts: "M3.9 12a3.1 3.1 0 013.1-3.1h4V7H7a5 5 0 000 10h4v-1.9H7A3.1 3.1 0 013.9 12zM8 13h8v-2H8v2zm9-6h-4v1.9h4a3.1 3.1 0 010 6.2h-4V17h4a5 5 0 000-10z",
  settings: "M19.14 12.94a7.5 7.5 0 000-1.88l2.03-1.58-1.92-3.32-2.39.96a7.3 7.3 0 00-1.63-.94L14.87 3.6h-3.84l-.36 2.58c-.59.24-1.13.56-1.63.94l-2.39-.96-1.92 3.32 2.03 1.58a7.5 7.5 0 000 1.88l-2.03 1.58 1.92 3.32 2.39-.96c.5.38 1.04.7 1.63.94l.36 2.58h3.84l.36-2.58c.59-.24 1.13-.56 1.63-.94l2.39.96 1.92-3.32-2.03-1.58zM12.95 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z",
};

export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d={ICONS[name] ?? ICONS.dashboard} />
    </svg>
  );
}

const NAV = [
  { href: "/", label: "Dashboard", icon: "dashboard" },
  { href: "/create", label: "Create reel", icon: "create" },
  { href: "/videos", label: "Videos", icon: "videos" },
  { href: "/topics", label: "Topics", icon: "topics" },
  { href: "/schedule", label: "Schedule", icon: "schedule" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function Sidebar() {
  const path = usePathname();
  const { d, nextRuns, busy } = useApp();
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="logo">▶</div>
        <div>Reel Studio<small>AI software reels</small></div>
      </div>
      <nav>
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`nav ${path === n.href ? "on" : ""}`}>
            <Icon name={n.icon} /> {n.label}
            {n.href === "/videos" && busy && <span className="spin" style={{ marginLeft: "auto" }} />}
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        <div className="side-label">Connections</div>
        {d && PLATFORMS.map((p) => (
          <div key={p} className="side-row">
            <span className={`dot ${d.connections[p] ? "ok" : ""}`} />{PLATFORM_NAME[p]}
          </div>
        ))}
        {d && (
          <div className="side-next">
            {d.schedule.enabled && nextRuns[0] ? <>Next auto post<b>{fmtDate(nextRuns[0])}</b></> : <>Schedule <b>off</b></>}
          </div>
        )}
      </div>
    </aside>
  );
}

function Toast() {
  const { toast, clearToast } = useApp();
  if (!toast) return null;
  return <div className={`toast ${toast.type}`} onClick={clearToast}>{toast.text}</div>;
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <AppProvider>
      <div className="app">
        <Sidebar />
        <main className="main">{children}</main>
      </div>
      <Toast />
    </AppProvider>
  );
}

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Loading() {
  return <div className="empty"><span className="spin" /> Loading…</div>;
}
