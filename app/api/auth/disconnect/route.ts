import { NextResponse } from "next/server";
import { publicSettings, updateSettings } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { platform } = await req.json();
  const s = updateSettings((st) => {
    if (platform === "meta") {
      st.meta.userToken = "";
      st.meta.pages = [];
      st.meta.selectedPageId = "";
    } else if (platform === "youtube") {
      st.youtube.refreshToken = "";
      st.youtube.accessToken = "";
      st.youtube.channelTitle = "";
      st.youtube.expiresAt = 0;
    } else if (platform === "linkedin") {
      st.linkedin.accessToken = "";
      st.linkedin.authorUrn = "";
      st.linkedin.name = "";
      st.linkedin.expiresAt = 0;
    }
  });
  return NextResponse.json(publicSettings(s));
}
