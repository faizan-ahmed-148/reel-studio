import { loadSettings, updateSettings, type MetaPage } from "@/lib/store";
import { appOrigin, back, checkState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

async function getJson(url: string) {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error?.message || `HTTP ${res.status}`);
  return data;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return back(req, { error: `Meta: ${q.get("error_description") || q.get("error")}` });
  if (!(await checkState("meta", q.get("state")))) return back(req, { error: "Meta login state mismatch, dobara try karein." });
  const s = loadSettings();
  const G = `https://graph.facebook.com/${s.meta.graphVersion}`;
  try {
    const short = await getJson(
      `${G}/oauth/access_token?` +
        new URLSearchParams({
          client_id: s.meta.appId, client_secret: s.meta.appSecret,
          redirect_uri: `${appOrigin(req)}/api/auth/meta/callback`, code: q.get("code") ?? "",
        }),
    );
    // long-lived user token -> page tokens derived from it don't expire
    const long = await getJson(
      `${G}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: "fb_exchange_token", client_id: s.meta.appId, client_secret: s.meta.appSecret,
          fb_exchange_token: short.access_token,
        }),
    );
    const accounts = await getJson(
      `${G}/me/accounts?` +
        new URLSearchParams({
          fields: "id,name,access_token,instagram_business_account{id,username}",
          limit: "100", access_token: long.access_token,
        }),
    );
    const pages: MetaPage[] = (accounts.data ?? []).map((p: any) => ({
      id: p.id, name: p.name, accessToken: p.access_token,
      igUserId: p.instagram_business_account?.id, igUsername: p.instagram_business_account?.username,
    }));
    if (pages.length === 0) return back(req, { error: "Koi Facebook Page nahi mila. Login ke waqt Page select karna zaroori hai." });
    updateSettings((st) => {
      st.meta.userToken = long.access_token;
      st.meta.pages = pages;
      if (!pages.some((p) => p.id === st.meta.selectedPageId)) {
        st.meta.selectedPageId = (pages.find((p) => p.igUserId) ?? pages[0]).id;
      }
    });
    if (!pages.some((p) => p.igUserId)) {
      // tell the user exactly why Instagram is missing
      const perms = await getJson(`${G}/me/permissions?access_token=${encodeURIComponent(long.access_token)}`).catch(() => ({ data: [] }));
      const granted = new Set((perms.data ?? []).filter((p: any) => p.status === "granted").map((p: any) => p.permission));
      const missing = ["instagram_basic", "instagram_content_publish"].filter((p) => !granted.has(p));
      return back(req, {
        error: missing.length
          ? `Facebook connect ho gaya, lekin Instagram nahi: permission(s) ${missing.join(", ")} nahi mili. Meta App → Facebook Login for Business → Configurations mein add karke dobara Connect karein.`
          : "Facebook connect ho gaya, lekin Page se koi Instagram Professional account linked nahi mila. Instagram ko Business/Creator karke Page se link karein, phir dobara Connect karein.",
      });
    }
    return back(req, { connected: "meta" });
  } catch (e) {
    return back(req, { error: `Meta: ${e instanceof Error ? e.message : e}` });
  }
}
