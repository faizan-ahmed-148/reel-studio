"use client";

import { useState, type FormEvent } from "react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
    const r = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(r.error || "Login nahi hua");
    const next = new URLSearchParams(window.location.search).get("next");
    // only allow same-site relative paths
    window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand"><div className="logo">▶</div><div>Reel Studio<small>Sign in to continue</small></div></div>
        <label>Username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus required />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <div className="err-text" style={{ marginTop: 12 }}>{error}</div>}
        <button className="full big" disabled={busy}>{busy ? <span className="spin sm" /> : "Login"}</button>
      </form>
    </div>
  );
}
