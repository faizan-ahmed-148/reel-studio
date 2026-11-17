import { loadSettings, updateSettings } from "@/lib/store";
import { appOrigin, back, checkState } from "@/lib/oauth";
import { channelInfo, exchangeCode } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return back(req, { error: `YouTube: ${q.get("error")}` });
  if (!(await checkState("youtube", q.get("state")))) return back(req, { error: "YouTube login state mismatch, dobara try karein." });
  try {
    const t = await exchangeCode(q.get("code") ?? "", `${appOrigin(req)}/api/auth/youtube/callback`, loadSettings());
    if (!t.refresh_token) throw new Error("Refresh token nahi mila — myaccount.google.com/permissions se app hata kar dobara connect karein.");
    const ch = await channelInfo(t.access_token).catch(() => ({ title: "", handle: "" }));
    updateSettings((s) => {
      s.youtube.refreshToken = t.refresh_token;
      s.youtube.accessToken = t.access_token;
      s.youtube.expiresAt = Date.now() + Number(t.expires_in ?? 3600) * 1000;
      s.youtube.channelTitle = ch.title;
      s.youtube.handle = ch.handle;
    });
    return back(req, { connected: "youtube" });
  } catch (e) {
    return back(req, { error: `YouTube: ${e instanceof Error ? e.message : e}` });
  }
}
