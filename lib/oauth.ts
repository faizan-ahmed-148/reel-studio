import crypto from "node:crypto";
import { cookies } from "next/headers";

export function appOrigin(req: Request): string {
  return (process.env.APP_URL || new URL(req.url).origin).replace(/\/$/, "");
}

export async function newState(name: string): Promise<string> {
  const state = crypto.randomBytes(16).toString("hex");
  (await cookies()).set(`oauth_${name}`, state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return state;
}

export async function checkState(name: string, state: string | null): Promise<boolean> {
  const jar = await cookies();
  const expected = jar.get(`oauth_${name}`)?.value;
  jar.delete(`oauth_${name}`);
  return !!state && !!expected && state === expected;
}

export function back(req: Request, params: Record<string, string>) {
  const url = new URL("/", appOrigin(req));
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return Response.redirect(url.toString(), 302);
}
