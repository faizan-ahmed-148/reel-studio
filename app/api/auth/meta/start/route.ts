import { loadSettings } from "@/lib/store";
import { appOrigin, back, newState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

const SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "business_management",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

export async function GET(req: Request) {
  const s = loadSettings();
  if (!s.meta.appId || !s.meta.appSecret) return back(req, { error: "Pehle Meta App ID aur App Secret save karein." });
  const url = new URL(`https://www.facebook.com/${s.meta.graphVersion}/dialog/oauth`);
  url.searchParams.set("client_id", s.meta.appId);
  url.searchParams.set("redirect_uri", `${appOrigin(req)}/api/auth/meta/callback`);
  url.searchParams.set("state", await newState("meta"));
  // Facebook Login for Business: a Configuration ID replaces the scope list (recommended by Meta)
  const configId = (process.env.META_LOGIN_CONFIG_ID ?? "").trim();
  if (configId) url.searchParams.set("config_id", configId);
  else url.searchParams.set("scope", SCOPES);
  url.searchParams.set("response_type", "code");
  return Response.redirect(url.toString(), 302);
}
