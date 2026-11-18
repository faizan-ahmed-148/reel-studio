/**
 * Signed session cookie (HMAC-SHA256 via Web Crypto, works in middleware and route handlers).
 * The signing key includes the admin password, so changing the password logs everyone out.
 */
export const SESSION_COOKIE = "rs_session";
export const SESSION_DAYS = 30;

const enc = new TextEncoder();

export function authConfigured() {
  return !!(process.env.ADMIN_USERNAME?.trim() && process.env.ADMIN_PASSWORD);
}

async function key() {
  const material = `${process.env.SESSION_SECRET ?? ""}|${process.env.ADMIN_USERNAME ?? ""}|${process.env.ADMIN_PASSWORD ?? ""}|reel-studio`;
  return crypto.subtle.importKey("raw", enc.encode(material), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

const b64url = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

export async function createSession(user: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify({ u: user, exp: Date.now() + SESSION_DAYS * 86400_000 })));
  const sig = await crypto.subtle.sign("HMAC", await key(), enc.encode(payload));
  return `${payload}.${b64url(sig)}`;
}

export async function verifySession(token: string | undefined): Promise<boolean> {
  if (!token || !authConfigured()) return false;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  try {
    const ok = await crypto.subtle.verify("HMAC", await key(), fromB64url(sig), enc.encode(payload));
    if (!ok) return false;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return data.u === process.env.ADMIN_USERNAME?.trim() && typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}
