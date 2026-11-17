import { loadSettings } from "@/lib/store";
import { appOrigin, back, newState } from "@/lib/oauth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const s = loadSettings();
  if (!s.linkedin.clientId || !s.linkedin.clientSecret) return back(req, { error: "Pehle LinkedIn Client ID aur Secret save karein." });
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", s.linkedin.clientId);
  url.searchParams.set("redirect_uri", `${appOrigin(req)}/api/auth/linkedin/callback`);
  url.searchParams.set("state", await newState("linkedin"));
  // with a Company Page configured, also ask for permission to post as that Page
  const org = (process.env.LINKEDIN_ORG_ID ?? "").trim();
  // A Community Management API app can't have other products, so it only gets the Page scopes
  url.searchParams.set("scope", org ? "w_organization_social r_organization_social" : "openid profile w_member_social");
  return Response.redirect(url.toString(), 302);
}
