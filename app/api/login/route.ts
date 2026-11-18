import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { authConfigured, createSession, SESSION_COOKIE, SESSION_DAYS } from "@/lib/session";

export const dynamic = "force-dynamic";

// simple in-memory brute-force protection: 5 failed tries per IP per 15 minutes
const g = globalThis as unknown as { __loginFails?: Map<string, { n: number; until: number }> };
const fails = (g.__loginFails ??= new Map());
const WINDOW = 15 * 60_000;

const same = (a: string, b: string) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export async function POST(req: Request) {
  if (!authConfigured())
    return NextResponse.json({ error: "Login set nahi: .env.local mein ADMIN_USERNAME aur ADMIN_PASSWORD daal kar server restart karein." }, { status: 503 });
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
  const f = fails.get(ip);
  if (f && f.n >= 5 && f.until > Date.now()) {
    const mins = Math.ceil((f.until - Date.now()) / 60_000);
    return NextResponse.json({ error: `Bohot zyada ghalat koshishein. ${mins} minute baad try karein.` }, { status: 429 });
  }
  const body = await req.json().catch(() => ({}));
  const user = String(body.username ?? "");
  const pass = String(body.password ?? "");
  // check both (no short-circuit) so timing doesn't reveal which one was wrong
  const okUser = same(user, process.env.ADMIN_USERNAME!.trim());
  const okPass = same(pass, process.env.ADMIN_PASSWORD!);
  if (!(okUser && okPass)) {
    const cur = f && f.until > Date.now() ? f : { n: 0, until: Date.now() + WINDOW };
    fails.set(ip, { n: cur.n + 1, until: cur.until });
    await new Promise((r) => setTimeout(r, 600)); // slow down guessing
    return NextResponse.json({ error: "Username ya password ghalat hai." }, { status: 401 });
  }
  fails.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await createSession(user), {
    httpOnly: true,
    sameSite: "lax",
    secure: new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
