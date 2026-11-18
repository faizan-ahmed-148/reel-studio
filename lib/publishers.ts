/**
 * Upload a local MP4 as a Reel / Short / video post. All of them use direct binary upload,
 * so the video does NOT need to be hosted on a public URL.
 */
import fs from "node:fs";
import { selectedPage, type Platform, type Settings } from "./store";
import { postYouTube } from "./youtube";

const graph = (s: Settings) => `https://graph.facebook.com/${s.meta.graphVersion || "v23.0"}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function check(res: Response, label: string) {
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} -> ${res.status}: ${text.slice(0, 800)}`);
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return { raw: text };
  }
}

function form(data: Record<string, string>) {
  return new URLSearchParams(data);
}

// ---------------- Instagram Reels (chunked resumable upload) ----------------
const IG_CHUNK = 8 * 1024 * 1024;

/** fetch with retries for network errors (slow / flaky connections). */
async function netFetch(url: string, init: RequestInit, tries = 3): Promise<Response> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fetch(url, init);
    } catch (e) {
      last = e;
      await sleep(3000 * (i + 1));
    }
  }
  const err = last as Error & { cause?: { code?: string } };
  throw new Error(`Network error (${err.cause?.code ?? err.message}) — internet check karein`);
}

/** Instagram refused the file (on some accounts: Reels longer than ~40s via the API). */
export class IgRejected extends Error {}

async function igUploadOnce(file: string, caption: string, s: Settings): Promise<string> {
  const page = selectedPage(s)!;
  const token = page.accessToken;
  const c = await check(
    await netFetch(`${graph(s)}/${page.igUserId}/media`, {
      method: "POST",
      body: form({
        media_type: "REELS", upload_type: "resumable", caption, share_to_feed: "true", access_token: token,
        // Meta's official "AI info" label
        ...(s.aiLabel ? { is_ai_generated: "true" } : {}),
      }),
    }),
    "IG create container",
  );
  const data = fs.readFileSync(file);
  for (let off = 0; off < data.length; off += IG_CHUNK) {
    const res = await netFetch(c.uri, {
      method: "POST",
      headers: { Authorization: `OAuth ${token}`, offset: String(off), file_size: String(data.length) },
      body: data.subarray(off, off + IG_CHUNK),
    });
    if (res.status === 206) continue; // chunk accepted, more to come
    const text = await res.text();
    if (!res.ok) {
      if (/ProcessingFailedError/.test(text)) throw new IgRejected(`Instagram ne video reject ki (ProcessingFailedError)`);
      throw new Error(`IG upload -> ${res.status}: ${text.slice(0, 400)}`);
    }
  }
  for (let i = 0; i < 60; i++) {
    const st = await check(await netFetch(`${graph(s)}/${c.id}?fields=status_code,status&access_token=${encodeURIComponent(token)}`, {}), "IG status");
    if (st.status_code === "FINISHED") {
      const pub = await check(
        await netFetch(`${graph(s)}/${page.igUserId}/media_publish`, { method: "POST", body: form({ creation_id: c.id, access_token: token }) }),
        "IG publish",
      );
      return pub.id;
    }
    if (st.status_code === "ERROR") {
      if (/2207076/.test(String(st.status))) throw new IgRejected(`Instagram processing error: ${st.status}`);
      throw new Error(`Instagram processing error: ${JSON.stringify(st)}`);
    }
    await sleep(10_000);
  }
  throw new Error("Instagram processing timed out");
}

export async function postInstagram(video: string, caption: string, s: Settings): Promise<string> {
  const page = selectedPage(s);
  if (!page?.igUserId) throw new Error("Instagram connected nahi hai (Facebook Page se linked Instagram Business/Creator account chahiye).");
  return igUploadOnce(video, caption, s);
}

// ---------------- Facebook Page Reels ----------------
export async function postFacebook(video: string, caption: string, s: Settings): Promise<string> {
  const page = selectedPage(s);
  if (!page) throw new Error("Facebook Page connected nahi hai.");
  const url = `${graph(s)}/${page.id}/video_reels`;
  const start = await check(await fetch(url, { method: "POST", body: form({ upload_phase: "start", access_token: page.accessToken }) }), "FB start");
  const data = fs.readFileSync(video);
  await check(
    await fetch(start.upload_url, {
      method: "POST",
      headers: { Authorization: `OAuth ${page.accessToken}`, offset: "0", file_size: String(data.length) },
      body: data,
    }),
    "FB upload",
  );
  const finish = (ai: boolean, description = caption) =>
    fetch(url, {
      method: "POST",
      body: form({
        upload_phase: "finish", video_id: start.video_id, video_state: "PUBLISHED", description, access_token: page.accessToken,
        // Facebook's official AI self-disclosure switch
        ...(ai ? { is_ai_generated: "true" } : {}),
      }),
    });
  let res = await finish(s.aiLabel);
  if (!res.ok && s.aiLabel) {
    const body = await res.clone().text();
    // if this API version/page refuses the field, publish without it (caption still has the AI note)
    if (/is_ai_generated|param|invalid/i.test(body)) {
      console.warn("[reel-studio] Facebook refused is_ai_generated, publishing without it:", body.slice(0, 200));
      res = await finish(false, `${caption}\n\n🤖 AI-generated: is video ka script, voice aur visuals AI ki madad se banaye gaye hain.`);
    }
  }
  await check(res, "FB finish");
  return start.video_id;
}

// ---------------- LinkedIn (Videos API + Posts API) ----------------
function liHeaders(s: Settings) {
  return {
    Authorization: `Bearer ${s.linkedin.accessToken}`,
    "LinkedIn-Version": s.linkedin.apiVersion,
    "X-Restli-Protocol-Version": "2.0.0",
    "Content-Type": "application/json",
  };
}

export const linkedinOrgId = () => (process.env.LINKEDIN_ORG_ID ?? "").trim().replace(/\D/g, "");

// LinkedIn "little text" format reserves these characters
const liEscape = (t: string) => t.replace(/([\\|{}@[\]()<>#*_~])/g, "\\$1");

export async function postLinkedIn(video: string, caption: string, s: Settings, title = ""): Promise<string> {
  if (!s.linkedin.accessToken || !s.linkedin.authorUrn) throw new Error("LinkedIn connected nahi hai.");
  // Company Page posting (needs the Community Management API product + w_organization_social).
  // When a Page is configured we NEVER fall back to the personal profile.
  const orgId = linkedinOrgId();
  if (orgId && !s.linkedin.orgScope)
    throw new Error("LinkedIn Company Page set hai lekin token mein Page permission (w_organization_social) nahi — Community Management API approve hone ke baad Accounts se dobara Connect karein.");
  const owner = orgId ? `urn:li:organization:${orgId}` : s.linkedin.authorUrn;
  if (s.linkedin.expiresAt && Date.now() > s.linkedin.expiresAt) throw new Error("LinkedIn token expire ho gaya — dobara Connect karein.");
  const h = liHeaders(s);
  const data = fs.readFileSync(video);
  const init = (
    await check(
      await fetch("https://api.linkedin.com/rest/videos?action=initializeUpload", {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          initializeUploadRequest: { owner, fileSizeBytes: data.length, uploadCaptions: false, uploadThumbnail: false },
        }),
      }),
      "LI init",
    )
  ).value;
  const etags: string[] = [];
  for (const part of init.uploadInstructions) {
    const res = await fetch(part.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: data.subarray(part.firstByte, part.lastByte + 1),
    });
    if (!res.ok) throw new Error(`LinkedIn chunk upload failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
    etags.push(res.headers.get("etag") ?? "");
  }
  await check(
    await fetch("https://api.linkedin.com/rest/videos?action=finalizeUpload", {
      method: "POST",
      headers: h,
      body: JSON.stringify({ finalizeUploadRequest: { video: init.video, uploadToken: init.uploadToken ?? "", uploadedPartIds: etags } }),
    }),
    "LI finalize",
  );
  // wait until LinkedIn has processed the video
  for (let i = 0; i < 30; i++) {
    const st = await check(await fetch(`https://api.linkedin.com/rest/videos/${encodeURIComponent(init.video)}`, { headers: h }), "LI status");
    if (st.status === "AVAILABLE") break;
    if (st.status === "PROCESSING_FAILED") throw new Error(`LinkedIn processing failed: ${JSON.stringify(st)}`);
    await sleep(5_000);
  }
  const res = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: h,
    body: JSON.stringify({
      author: owner,
      commentary: liEscape(caption),
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { title: title.slice(0, 200), id: init.video } },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  });
  await check(res, "LI post");
  return res.headers.get("x-restli-id") ?? init.video;
}

export const PUBLISHERS: Record<Platform, (video: string, caption: string, s: Settings, title?: string) => Promise<string>> = {
  instagram: postInstagram,
  facebook: postFacebook,
  youtube: postYouTube,
  linkedin: postLinkedIn,
};

export function isConnected(p: Platform, s: Settings): boolean {
  const page = selectedPage(s);
  if (p === "facebook") return !!page;
  if (p === "instagram") return !!page?.igUserId;
  if (p === "youtube") return !!s.youtube.refreshToken;
  return !!s.linkedin.accessToken;
}
