import { loadSettings, updateSettings } from "@/lib/store";
import { appOrigin, back, checkState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  if (q.get("error")) return back(req, { error: `LinkedIn: ${q.get("error_description") || q.get("error")}` });
  if (!(await checkState("linkedin", q.get("state")))) return back(req, { error: "LinkedIn login state mismatch, dobara try karein." });
  const s = loadSettings();
  try {
    const tokRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code", code: q.get("code") ?? "",
        redirect_uri: `${appOrigin(req)}/api/auth/linkedin/callback`,
        client_id: s.linkedin.clientId, client_secret: s.linkedin.clientSecret,
      }),
    });
    const tok = await tokRes.json();
    if (!tokRes.ok) throw new Error(tok.error_description || JSON.stringify(tok));
    const org = (process.env.LINKEDIN_ORG_ID ?? "").trim();
    let me: { sub?: string; name?: string } = {};
    const meRes = await fetch("https://api.linkedin.com/v2/userinfo", { headers: { Authorization: `Bearer ${tok.access_token}` } });
    if (meRes.ok) me = await meRes.json();
    // Page-only apps have no profile scope: that's fine, posts go to the Page
    if (!me.sub && !org) throw new Error(`userinfo failed: ${(await meRes.text().catch(() => "")).slice(0, 200)}`);
    updateSettings((st) => {
      st.linkedin.accessToken = tok.access_token;
      st.linkedin.expiresAt = Date.now() + Number(tok.expires_in ?? 0) * 1000;
      st.linkedin.authorUrn = me.sub ? `urn:li:person:${me.sub}` : `urn:li:organization:${org.replace(/\D/g, "")}`;
      st.linkedin.name = me.name ?? (org ? `Company Page ${org}` : "");
      st.linkedin.orgScope = String(tok.scope ?? "").split(/[ ,]+/).includes("w_organization_social");
    });
    return back(req, { connected: "linkedin" });
  } catch (e) {
    return back(req, { error: `LinkedIn: ${e instanceof Error ? e.message : e}` });
  }
}
