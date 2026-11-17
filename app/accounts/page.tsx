"use client";

import type { ReactNode } from "react";
import type { Platform } from "@/lib/store";
import { EnvLocked, PLATFORM_NAME, useApp } from "../components/AppContext";
import { Loading, PageHead } from "../components/Shell";

const SECRET = { type: "text", className: "secret", autoComplete: "off", spellCheck: false, "data-1p-ignore": "true", "data-lpignore": "true" } as const;

function AccountCard({ p, children, connect, connectedAs, onDisconnect, label }: {
  p: Platform; children?: ReactNode; connect: string; connectedAs: string | null; onDisconnect: () => void; label: string;
}) {
  const { d, save } = useApp();
  if (!d) return null;
  return (
    <section className="card acct-card">
      <div className="acct-head">
        <div className={`ico ${p}`}>{p === "instagram" ? "IG" : p === "facebook" ? "f" : p === "youtube" ? "▶" : "in"}</div>
        <div className="acct-name">
          <b>{PLATFORM_NAME[p]}</b>
          <span>{connectedAs ? `✔ ${connectedAs}` : "Connected nahi"}</span>
        </div>
        <label className="switch" title="Is platform par upload karo?">
          <input type="checkbox" checked={d.enabled[p]} onChange={(e) => save({ enabled: { ...d.enabled, [p]: e.target.checked } })} /><span />
        </label>
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        {connectedAs ? <button className="danger" onClick={onDisconnect}>Disconnect</button> : <a className={`btn brand-${p}`} href={connect}>{label}</a>}
      </div>
      {children}
    </section>
  );
}

export default function Accounts() {
  const { d, set, save, saving, disconnect } = useApp();
  if (!d) return <Loading />;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const c = d.connections;

  return (
    <>
      <PageHead title="Accounts" sub="Platforms connect karein. Toggle se chunein kis par auto upload ho." />

      <section className="card ai-card">
        <label className="check big-check">
          <span className="switch"><input type="checkbox" checked={d.aiLabel} onChange={(e) => save({ aiLabel: e.target.checked })} /><span /></span>
          AI label lagao (recommended)
        </label>
        <ul className="small explain">
          <li><b>Instagram:</b> Meta ka official “AI info” label (<code>is_ai_generated</code>).</li>
          <li><b>YouTube:</b> official “Altered or synthetic content” label (<code>containsSyntheticMedia</code>).</li>
          <li><b>Facebook:</b> Reels ka official AI switch (<code>is_ai_generated</code>) ON hota hai.</li>
          <li><b>LinkedIn:</b> API mein AI switch nahi hai — caption mein saaf “🤖 AI-generated” note lagta hai.</li>
          <li>Video file ke metadata mein bhi AI disclosure hota hai.</li>
        </ul>
      </section>

      <div className="grid-2">
        <AccountCard p="instagram" connect="/api/auth/meta/start" connectedAs={c.instagram} label="Connect via Facebook" onDisconnect={() => disconnect("meta")}>
          <p className="small">Instagram <b>Business/Creator</b> account jo Facebook Page se linked ho. Facebook connect karne se dono jur jate hain.</p>
        </AccountCard>
        <AccountCard p="facebook" connect="/api/auth/meta/start" connectedAs={c.facebook} label="Connect Facebook" onDisconnect={() => disconnect("meta")}>
          {d.meta.pages.length > 1 && (
            <>
              <label>Facebook Page</label>
              <select value={d.meta.selectedPageId} onChange={(e) => save({ meta: { ...d.meta, selectedPageId: e.target.value } })}>
                {d.meta.pages.map((p) => <option key={p.id} value={p.id}>{p.name}{p.igUsername ? ` (IG @${p.igUsername})` : " (no IG)"}</option>)}
              </select>
            </>
          )}
        </AccountCard>
        <AccountCard p="youtube" connect="/api/auth/youtube/start" connectedAs={c.youtube} label="Connect YouTube" onDisconnect={() => disconnect("youtube")}>
          <label>Privacy</label>
          <select value={d.youtube.privacy} onChange={(e) => save({ youtube: { ...d.youtube, privacy: e.target.value as "public" } })}>
            <option value="public">Public</option><option value="unlisted">Unlisted</option><option value="private">Private</option>
          </select>
          <p className="small">Note: naye Google API projects ki uploads tab tak <b>private</b> rehti hain jab tak Google project ko audit/verify na kare.</p>
        </AccountCard>
        <AccountCard p="linkedin" connect="/api/auth/linkedin/start" connectedAs={c.linkedin} label="Connect LinkedIn" onDisconnect={() => disconnect("linkedin")}>
          <p className="small">
            Post kahan jati hai: <b>{d.linkedin.postsAs === "page" ? "Company Page" : "Personal profile"}</b>
            {d.linkedin.postsAs === "page" && !d.linkedin.pageReady && <> — <span className="bad-text">Page permission abhi nahi mili (Community Management API approve hone ke baad dobara Connect karein)</span></>}
            {d.linkedin.postsAs === "profile" && <> — Company Page ke liye <code>.env.local</code> mein <code>LINKEDIN_ORG_ID</code> daalein</>}
          </p>
          {d.linkedin.expiresAt > 0 && <p className="small">Token expiry: {new Date(d.linkedin.expiresAt).toLocaleDateString()} (phir dobara connect karein)</p>}
        </AccountCard>
      </div>

      <section className="card">
        <h2>Developer app keys (sirf ek dafa)</h2>
        <p className="hint">Har platform ki free developer app banayein aur yeh redirect URI wahan add karein. Behtar: keys <code>reel-studio/.env.local</code> mein rakhein — phir yeh na file mein save hoti hain na browser tak aati hain.</p>
        <div className="grid-3">
          <div>
            <h3>Meta (Facebook + Instagram)</h3>
            <label>App ID</label>
            {d.envFields.includes("meta.appId") ? <EnvLocked name="META_APP_ID" /> : (
<input autoComplete="off" data-1p-ignore="true" data-lpignore="true" name="meta-app-id-x" inputMode="numeric" value={d.meta.appId} onChange={(e) => set({ meta: { ...d.meta, appId: e.target.value } })} />
)}
            <label>App Secret {d.meta.hasAppSecret && <span className="pill ok">saved</span>}</label>
            {d.envFields.includes("meta.appSecret") ? <EnvLocked name="META_APP_SECRET" /> : (
<input {...SECRET} name="meta-secret-x" value={d.newMetaSecret} onChange={(e) => set({ newMetaSecret: e.target.value })} placeholder={d.meta.hasAppSecret ? "•••••• saved" : ""} />
)}
            <p className="small">Redirect: <code>{origin}/api/auth/meta/callback</code></p>
          </div>
          <div>
            <h3>Google (YouTube)</h3>
            <label>OAuth Client ID</label>
            {d.envFields.includes("youtube.clientId") ? <EnvLocked name="GOOGLE_CLIENT_ID" /> : (
<input autoComplete="off" data-1p-ignore="true" data-lpignore="true" name="yt-client-id-x" value={d.youtube.clientId} onChange={(e) => set({ youtube: { ...d.youtube, clientId: e.target.value } })} />
)}
            <label>Client Secret {d.youtube.hasClientSecret && <span className="pill ok">saved</span>}</label>
            {d.envFields.includes("youtube.clientSecret") ? <EnvLocked name="GOOGLE_CLIENT_SECRET" /> : (
<input {...SECRET} name="yt-secret-x" value={d.newYtSecret} onChange={(e) => set({ newYtSecret: e.target.value })} placeholder={d.youtube.hasClientSecret ? "•••••• saved" : ""} />
)}
            <p className="small">Redirect: <code>{origin}/api/auth/youtube/callback</code></p>
          </div>
          <div>
            <h3>LinkedIn</h3>
            <label>Client ID</label>
            {d.envFields.includes("linkedin.clientId") ? <EnvLocked name="LINKEDIN_CLIENT_ID" /> : (
<input autoComplete="off" data-1p-ignore="true" data-lpignore="true" name="li-client-id-x" value={d.linkedin.clientId} onChange={(e) => set({ linkedin: { ...d.linkedin, clientId: e.target.value } })} />
)}
            <label>Client Secret {d.linkedin.hasClientSecret && <span className="pill ok">saved</span>}</label>
            {d.envFields.includes("linkedin.clientSecret") ? <EnvLocked name="LINKEDIN_CLIENT_SECRET" /> : (
<input {...SECRET} name="li-secret-x" value={d.newLiSecret} onChange={(e) => set({ newLiSecret: e.target.value })} placeholder={d.linkedin.hasClientSecret ? "•••••• saved" : ""} />
)}
            <p className="small">Redirect: <code>{origin}/api/auth/linkedin/callback</code></p>
          </div>
        </div>
        <button className="full" disabled={saving} onClick={() => save()}>Keys save karo</button>
      </section>
    </>
  );
}
