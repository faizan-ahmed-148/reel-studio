/**
 * YouTube Shorts upload (YouTube Data API v3, resumable upload) with the official
 * "altered or synthetic content" disclosure (status.containsSyntheticMedia).
 */
import fs from "node:fs";
import { loadSettings, updateSettings, type Settings } from "./store";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
].join(" ");

async function json(res: Response, label: string) {
  const text = await res.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`${label} -> ${res.status}: ${data?.error?.message || data?.error_description || text.slice(0, 500)}`);
  return data;
}

export async function exchangeCode(code: string, redirectUri: string, s: Settings) {
  return json(await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: s.youtube.clientId, client_secret: s.youtube.clientSecret,
      redirect_uri: redirectUri, grant_type: "authorization_code",
    }),
  }), "Google token");
}

/** Valid access token, refreshed when it is about to expire. */
export async function youtubeToken(): Promise<string> {
  const s = loadSettings();
  if (!s.youtube.refreshToken) throw new Error("YouTube connected nahi hai.");
  if (s.youtube.accessToken && Date.now() < s.youtube.expiresAt - 60_000) return s.youtube.accessToken;
  const t = await json(await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: s.youtube.clientId, client_secret: s.youtube.clientSecret,
      refresh_token: s.youtube.refreshToken, grant_type: "refresh_token",
    }),
  }), "YouTube token refresh");
  updateSettings((x) => {
    x.youtube.accessToken = t.access_token;
    x.youtube.expiresAt = Date.now() + Number(t.expires_in ?? 3600) * 1000;
  });
  return t.access_token;
}

export async function channelTitle(token: string): Promise<string> {
  const d = await json(await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", {
    headers: { Authorization: `Bearer ${token}` },
  }), "YouTube channel");
  return d.items?.[0]?.snippet?.title ?? "";
}

export async function postYouTube(video: string, description: string, s: Settings, title = ""): Promise<string> {
  const token = await youtubeToken();
  const tags = [...new Set((description.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((t) => t.slice(1)))].slice(0, 15);
  const meta = {
    snippet: {
      title: (title || "Software concept in 60 seconds #Shorts").slice(0, 100),
      description: description.slice(0, 4900),
      tags,
      categoryId: "28", // Science & Technology
      defaultLanguage: "ur",
      defaultAudioLanguage: "ur",
    },
    status: {
      privacyStatus: s.youtube.privacy || "public",
      selfDeclaredMadeForKids: false,
      containsSyntheticMedia: s.aiLabel, // YouTube's official AI / synthetic-content label
    },
  };
  const data = fs.readFileSync(video);
  const init = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Length": String(data.length),
      "X-Upload-Content-Type": "video/mp4",
    },
    body: JSON.stringify(meta),
  });
  if (!init.ok) await json(init, "YouTube upload start");
  const location = init.headers.get("location");
  if (!location) throw new Error("YouTube ne upload URL nahi diya");
  const up = await json(await fetch(location, {
    method: "PUT",
    headers: { "Content-Type": "video/mp4", "Content-Length": String(data.length) },
    body: data,
  }), "YouTube upload");
  return up.id;
}
