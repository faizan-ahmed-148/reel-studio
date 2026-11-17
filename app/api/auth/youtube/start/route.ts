import { loadSettings } from "@/lib/store";
import { appOrigin, back, newState } from "@/lib/oauth";
import { YT_SCOPES } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = loadSettings();
  if (!s.youtube.clientId || !s.youtube.clientSecret) return back(req, { error: "Pehle Google OAuth Client ID aur Secret save karein (Accounts page)." });
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", s.youtube.clientId);
  url.searchParams.set("redirect_uri", `${appOrigin(req)}/api/auth/youtube/callback`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YT_SCOPES);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", await newState("youtube"));
  return Response.redirect(url.toString(), 302);
}
