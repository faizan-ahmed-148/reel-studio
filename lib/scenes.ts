/**
 * Frame renderer: draws one 1080x1920 frame of a scene at time t (seconds).
 * Visual style: dark "system design whiteboard" with animated diagrams, charts and captions.
 */
import fs from "node:fs";
import path from "node:path";
import { createCanvas, GlobalFonts, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import type { DiagramNode, NodeKind, Scene, Visual } from "./script";

export const W = 1080;
export const H = 1920;

const C = {
  bg1: "#070b18",
  bg2: "#150d34",
  accent: "#00dcb4",
  accent2: "#ffc400",
  pink: "#ff5fa2",
  white: "#f2f5ff",
  muted: "#8c97b8",
  panel: "#111934",
  panel2: "#18223f",
  line: "rgba(255,255,255,0.10)",
};
const PALETTE = ["#00dcb4", "#ffc400", "#ff5fa2", "#60a5fa", "#a78bfa", "#fb923c"];

const KIND_COLOR: Record<NodeKind, string> = {
  user: "#60a5fa", client: "#60a5fa", server: "#00dcb4", service: "#00dcb4", api: "#2dd4bf", worker: "#34d399",
  database: "#ffc400", cache: "#ff5fa2", queue: "#a78bfa", loadbalancer: "#34d399", gateway: "#38bdf8",
  cdn: "#38bdf8", storage: "#fb923c", external: "#94a3b8", ai: "#c084fc", dns: "#f472b6",
};

// layout bands (Instagram covers ~top 200px and bottom ~380px with UI)
const TOP = 170;
const CONTENT_TOP = 540;
const CONTENT_BOTTOM = 1340;
const SUB_Y = 1465;

// ---------------------------------------------------------------- fonts
let fontsReady = false;
export function registerFonts() {
  if (fontsReady) return;
  const custom = path.join(process.cwd(), "assets", "fonts");
  const candidates: [string, string][] = [
    [path.join(custom, "Bold.ttf"), "RB"], [path.join(custom, "Regular.ttf"), "RR"], [path.join(custom, "Mono.ttf"), "RM"],
    ["/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf", "RB"], ["/usr/share/fonts/truetype/ubuntu/Ubuntu-M.ttf", "RR"],
    ["/usr/share/fonts/truetype/ubuntu/UbuntuMono-B.ttf", "RM"],
    ["/usr/share/fonts/truetype/open-sans/OpenSans-Bold.ttf", "RB"], ["/usr/share/fonts/truetype/open-sans/OpenSans-Semibold.ttf", "RR"],
    ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "RB"], ["/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "RR"],
    ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", "RM"], ["/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", "RM"],
    ["C:\\Windows\\Fonts\\arialbd.ttf", "RB"], ["C:\\Windows\\Fonts\\arial.ttf", "RR"], ["C:\\Windows\\Fonts\\consola.ttf", "RM"],
  ];
  const done = new Set<string>();
  for (const [file, fam] of candidates) {
    if (done.has(fam) || !fs.existsSync(file)) continue;
    GlobalFonts.registerFromPath(file, fam);
    done.add(fam);
  }
  fontsReady = true;
}

// ---------------------------------------------------------------- helpers
const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x: number) => { const c = 1.7; const p = clamp(x) - 1; return 1 + (c + 1) * p * p * p + c * p * p; };
const prog = (t: number, start: number, dur: number) => clamp((t - start) / dur);

function hexA(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function rr(ctx: SKRSContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function wrap(ctx: SKRSContext2D, text: string, maxW: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

/** Largest font size (<= max) that fits text in maxLines lines of maxW. */
function fitFont(ctx: SKRSContext2D, text: string, family: string, max: number, min: number, maxW: number, maxLines: number) {
  for (let s = max; s >= min; s -= 2) {
    ctx.font = `${s}px ${family}`;
    if (wrap(ctx, text, maxW).length <= maxLines) return s;
  }
  ctx.font = `${min}px ${family}`;
  return min;
}

// ---------------------------------------------------------------- background
let bgCache: Canvas | null = null;
function background(ctx: SKRSContext2D, gt: number) {
  if (!bgCache) {
    bgCache = createCanvas(W, H);
    const b = bgCache.getContext("2d");
    const g = b.createLinearGradient(0, 0, W * 0.4, H);
    g.addColorStop(0, C.bg1);
    g.addColorStop(1, C.bg2);
    b.fillStyle = g;
    b.fillRect(0, 0, W, H);
    const v = b.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.75);
    v.addColorStop(0, "rgba(0,0,0,0)");
    v.addColorStop(1, "rgba(0,0,0,0.45)");
    b.fillStyle = v;
    b.fillRect(0, 0, W, H);
  }
  ctx.drawImage(bgCache, 0, 0);
  // slowly drifting blueprint grid
  const off = (gt * 12) % 60;
  ctx.strokeStyle = "rgba(120,160,255,0.05)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = -60 + off; x < W; x += 60) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
  for (let y = -60 + off; y < H; y += 60) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
  ctx.stroke();
  // moving glows
  const gx = W * (0.7 + 0.2 * Math.sin(gt * 0.3));
  const gy = H * (0.22 + 0.05 * Math.cos(gt * 0.4));
  const glow = ctx.createRadialGradient(gx, gy, 0, gx, gy, 650);
  glow.addColorStop(0, "rgba(0,220,180,0.16)");
  glow.addColorStop(1, "rgba(0,220,180,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const g2 = ctx.createRadialGradient(W * 0.1, H * 0.8, 0, W * 0.1, H * 0.8, 700);
  g2.addColorStop(0, "rgba(160,90,255,0.13)");
  g2.addColorStop(1, "rgba(160,90,255,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

// ---------------------------------------------------------------- icons
function icon(ctx: SKRSContext2D, kind: NodeKind, cx: number, cy: number, s: number, color: string) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.08;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const h = s / 2;
  switch (kind) {
    case "user": {
      ctx.beginPath(); ctx.arc(cx, cy - h * 0.35, h * 0.32, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + h * 0.75, h * 0.62, Math.PI, 0); ctx.fill();
      break;
    }
    case "client": {
      rr(ctx, cx - h * 0.85, cy - h * 0.65, h * 1.7, h * 1.1, h * 0.12); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - h * 0.4, cy + h * 0.75); ctx.lineTo(cx + h * 0.4, cy + h * 0.75); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy + h * 0.45); ctx.lineTo(cx, cy + h * 0.75); ctx.stroke();
      break;
    }
    case "server": case "service": case "worker": {
      for (let i = 0; i < 3; i++) {
        const y = cy - h * 0.8 + i * h * 0.56;
        rr(ctx, cx - h * 0.8, y, h * 1.6, h * 0.44, h * 0.1); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx - h * 0.5, y + h * 0.22, h * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(cx - h * 0.1, y + h * 0.22); ctx.lineTo(cx + h * 0.55, y + h * 0.22); ctx.stroke();
      }
      break;
    }
    case "database": {
      const rx = h * 0.75, ry = h * 0.25;
      ctx.beginPath(); ctx.ellipse(cx, cy - h * 0.6, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - rx, cy - h * 0.6); ctx.lineTo(cx - rx, cy + h * 0.6);
      ctx.ellipse(cx, cy + h * 0.6, rx, ry, 0, Math.PI, 0, true); ctx.lineTo(cx + rx, cy - h * 0.6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); ctx.stroke();
      break;
    }
    case "cache": {
      ctx.beginPath();
      ctx.moveTo(cx + h * 0.15, cy - h * 0.9); ctx.lineTo(cx - h * 0.5, cy + h * 0.1); ctx.lineTo(cx - h * 0.02, cy + h * 0.1);
      ctx.lineTo(cx - h * 0.15, cy + h * 0.9); ctx.lineTo(cx + h * 0.5, cy - h * 0.1); ctx.lineTo(cx + h * 0.02, cy - h * 0.1);
      ctx.closePath(); ctx.fill();
      break;
    }
    case "queue": {
      for (let i = 0; i < 4; i++) { rr(ctx, cx - h * 0.95 + i * h * 0.5, cy - h * 0.35, h * 0.38, h * 0.7, h * 0.08); i === 3 ? ctx.fill() : ctx.stroke(); }
      break;
    }
    case "loadbalancer": case "gateway": {
      ctx.beginPath(); ctx.arc(cx, cy - h * 0.55, h * 0.25, 0, Math.PI * 2); ctx.fill();
      for (const dx of [-0.75, 0, 0.75]) {
        ctx.beginPath(); ctx.moveTo(cx, cy - h * 0.3); ctx.lineTo(cx + dx * h, cy + h * 0.55); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + dx * h, cy + h * 0.7, h * 0.16, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case "cdn": case "external": case "dns": {
      ctx.beginPath(); ctx.arc(cx, cy, h * 0.8, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, cy, h * 0.35, h * 0.8, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx - h * 0.8, cy); ctx.lineTo(cx + h * 0.8, cy); ctx.stroke();
      break;
    }
    case "storage": {
      ctx.beginPath();
      ctx.moveTo(cx - h * 0.85, cy - h * 0.55); ctx.lineTo(cx - h * 0.2, cy - h * 0.55); ctx.lineTo(cx - h * 0.05, cy - h * 0.35);
      ctx.lineTo(cx + h * 0.85, cy - h * 0.35); ctx.lineTo(cx + h * 0.85, cy + h * 0.65); ctx.lineTo(cx - h * 0.85, cy + h * 0.65); ctx.closePath(); ctx.stroke();
      break;
    }
    case "ai": {
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * Math.PI) / 4 - Math.PI / 2;
        const r = i % 2 === 0 ? h * 0.9 : h * 0.28;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case "api": default: {
      ctx.font = `${Math.round(s * 0.7)}px RM`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("{ }", cx, cy + s * 0.03);
    }
  }
  ctx.restore();
}

// ---------------------------------------------------------------- header / heading / subtitles
export interface FrameInfo {
  topic: string;
  category: string;
  handle: string;
  sceneIdx: number;
  sceneCount: number;
  hook: string;
}

function header(ctx: SKRSContext2D, f: FrameInfo, t: number, dur: number) {
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  // category chip
  ctx.font = "30px RB";
  const label = f.category.toUpperCase();
  const w = ctx.measureText(label).width + 44;
  rr(ctx, 60, TOP, w, 54, 27);
  ctx.fillStyle = hexA(C.accent, 0.14); ctx.fill();
  ctx.strokeStyle = hexA(C.accent, 0.5); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.accent;
  ctx.fillText(label, 82, TOP + 12);
  // handle
  ctx.textAlign = "right";
  ctx.font = "32px RB";
  ctx.fillStyle = C.muted;
  ctx.fillText(f.handle, W - 60, TOP + 10);
  ctx.textAlign = "left";
  // story-style progress segments
  const segW = (W - 120 - (f.sceneCount - 1) * 10) / f.sceneCount;
  for (let i = 0; i < f.sceneCount; i++) {
    const x = 60 + i * (segW + 10);
    rr(ctx, x, TOP + 82, segW, 8, 4);
    ctx.fillStyle = "rgba(255,255,255,0.14)"; ctx.fill();
    const p = i < f.sceneIdx ? 1 : i === f.sceneIdx ? clamp(t / dur) : 0;
    if (p > 0) { rr(ctx, x, TOP + 82, segW * p, 8, 4); ctx.fillStyle = C.accent; ctx.fill(); }
  }
}

function heading(ctx: SKRSContext2D, text: string, t: number) {
  const a = easeOut(prog(t, 0.05, 0.45));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(-40 * (1 - a), 0);
  const size = fitFont(ctx, text, "RB", 68, 46, W - 120, 2);
  ctx.fillStyle = C.white;
  ctx.textBaseline = "top";
  const lines = wrap(ctx, text, W - 120);
  lines.forEach((l, i) => ctx.fillText(l, 60, 310 + i * size * 1.15));
  // accent underline
  const lw = Math.min(ctx.measureText(lines[0] ?? "").width, 220) * easeOut(prog(t, 0.3, 0.5));
  rr(ctx, 60, 310 + lines.length * size * 1.15 + 14, lw, 8, 4);
  ctx.fillStyle = C.accent2; ctx.fill();
  ctx.restore();
}

/** Split subtitle into short chunks and pick the one for time t (proportional to text length). */
export function subtitleChunks(text: string): string[] {
  const chunks: string[] = [];
  // split at sentence ends first, then into evenly sized pieces of ~5-7 words
  for (const sentence of text.split(/(?<=[.?!])\s+/)) {
    const words = sentence.split(/\s+/).filter(Boolean);
    if (!words.length) continue;
    const n = Math.ceil(words.length / 7);
    const size = Math.ceil(words.length / n);
    for (let i = 0; i < words.length; i += size) chunks.push(words.slice(i, i + size).join(" "));
  }
  return chunks;
}

/** Kinetic captions: the chunk being spoken, with the current word highlighted (karaoke style). */
function subtitles(ctx: SKRSContext2D, chunks: string[], t: number, speech: number) {
  if (!chunks.length || t > speech + 0.15) return;
  const words = chunks.flatMap((c, ci) => c.split(/\s+/).filter(Boolean).map((w) => ({ w, ci })));
  if (!words.length) return;
  const weights = words.map((x) => x.w.length + 2);
  const total = weights.reduce((a, b) => a + b, 0);
  const starts: number[] = [];
  let acc = 0;
  for (let i = 0; i < words.length; i++) { starts.push(acc); acc += (weights[i] / total) * speech; }
  let wi = 0;
  for (let i = 0; i < words.length; i++) if (starts[i] <= t) wi = i;
  const ci = words[wi].ci;
  const idxs = words.map((x, i) => i).filter((i) => words[i].ci === ci);
  const chunkStart = starts[idxs[0]];
  const pop = easeBack(prog(t, chunkStart, 0.16));

  ctx.save();
  ctx.font = "56px RB";
  const space = ctx.measureText(" ").width;
  // wrap words of this chunk into lines
  const maxW = W - 200;
  const lines: number[][] = [[]];
  let lw = 0;
  for (const i of idxs) {
    const ww = ctx.measureText(words[i].w).width;
    if (lw > 0 && lw + space + ww > maxW) { lines.push([]); lw = 0; }
    lines[lines.length - 1].push(i);
    lw += (lw > 0 ? space : 0) + ww;
  }
  const lh = 70;
  const widths = lines.map((ln) => ln.reduce((sum, i, k) => sum + ctx.measureText(words[i].w).width + (k ? space : 0), 0));
  const boxW = Math.max(...widths) + 64;
  const boxH = lines.length * lh + 36;
  ctx.translate(W / 2, SUB_Y);
  const sc = 0.9 + 0.1 * pop;
  ctx.scale(sc, sc);
  rr(ctx, -boxW / 2, -boxH / 2, boxW, boxH, 24);
  ctx.fillStyle = "rgba(5,8,20,0.78)"; ctx.fill();
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";
  lines.forEach((ln, li) => {
    let x = -widths[li] / 2;
    const y = -boxH / 2 + 18 + lh / 2 + li * lh;
    for (const i of ln) {
      const ww = ctx.measureText(words[i].w).width;
      if (i === wi) {
        // highlighted word: accent pill behind it
        const k = easeOut(prog(t, starts[i], 0.12));
        rr(ctx, x - 8, y - 34, ww + 16, 68, 14);
        ctx.fillStyle = hexA(C.accent2, 0.95 * k); ctx.fill();
        ctx.fillStyle = "#0a0e1e";
      } else ctx.fillStyle = i < wi ? C.white : "rgba(242,245,255,0.55)";
      ctx.fillText(words[i].w, x, y + 2);
      x += ww + space;
    }
  });
  ctx.restore();
}

/** End card: "Follow" call-to-action over the last seconds. */
function followCard(ctx: SKRSContext2D, handle: string, t: number) {
  const p = easeBack(prog(t, 0, 0.45));
  if (p <= 0) return;
  ctx.save();
  ctx.globalAlpha = clamp(p);
  ctx.translate(W / 2, 1312);
  ctx.scale(0.8 + 0.2 * p, 0.8 + 0.2 * p);
  ctx.font = "44px RB";
  const label = `Follow ${handle}`;
  const tw = ctx.measureText(label).width;
  const w = tw + 150, h = 104;
  const pulse = 1 + 0.03 * Math.sin(t * 9);
  ctx.scale(pulse, pulse);
  ctx.shadowColor = hexA(C.pink, 0.6); ctx.shadowBlur = 40;
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  g.addColorStop(0, "#ff5fa2"); g.addColorStop(1, "#ffc400");
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fillStyle = g; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#0a0e1e";
  ctx.font = "56px RB"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("+", -w / 2 + 58, 2);
  ctx.font = "44px RB"; ctx.textAlign = "left";
  ctx.fillText(label, -w / 2 + 100, 3);
  ctx.restore();
}

// ---------------------------------------------------------------- visuals
function drawTitle(ctx: SKRSContext2D, f: FrameInfo, t: number) {
  // floating network in the background
  const pts = Array.from({ length: 12 }, (_, i) => ({
    x: W * (0.1 + 0.8 * ((i * 0.618) % 1)) + Math.sin(t * 0.8 + i) * 25,
    y: 980 + ((i * 97) % 380) + Math.cos(t * 0.7 + i * 2) * 20,
  }));
  ctx.save();
  ctx.globalAlpha = 0.6 * easeOut(prog(t, 0.2, 1));
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) {
      const d = Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y);
      if (d < 330) {
        ctx.strokeStyle = `rgba(0,220,180,${0.35 * (1 - d / 330)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(pts[j].x, pts[j].y); ctx.stroke();
      }
    }
  pts.forEach((p, i) => {
    ctx.fillStyle = PALETTE[i % PALETTE.length];
    ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();

  // hook, word by word
  const hook = f.hook || f.topic;
  const size = fitFont(ctx, hook, "RB", 104, 64, W - 140, 4);
  const lines = wrap(ctx, hook, W - 140);
  let wi = 0;
  ctx.textBaseline = "top";
  lines.forEach((line, li) => {
    let x = 70;
    for (const word of line.split(" ")) {
      const p = easeBack(prog(t, 0.15 + wi * 0.12, 0.35));
      ctx.save();
      ctx.globalAlpha = clamp(p);
      const ww = ctx.measureText(word).width;
      ctx.translate(x + ww / 2, 520 + li * size * 1.12 + size / 2);
      ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
      ctx.fillStyle = wi % 4 === 1 || /\?|!/.test(word) ? C.accent2 : C.white;
      ctx.fillText(word, -ww / 2, -size / 2);
      ctx.restore();
      x += ww + ctx.measureText(" ").width;
      wi++;
    }
  });
  // topic pill
  const a = easeOut(prog(t, 0.4 + wi * 0.12, 0.4));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = "40px RB";
  const label = f.topic;
  const tw = Math.min(ctx.measureText(label).width, W - 200);
  const y = 520 + lines.length * size * 1.12 + 50;
  rr(ctx, 70, y, tw + 60, 76, 38);
  ctx.fillStyle = hexA(C.accent, 0.16); ctx.fill();
  ctx.strokeStyle = C.accent; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = C.accent;
  ctx.fillText(label, 100, y + 17, W - 200);
  ctx.restore();
}

interface Box { x: number; y: number; w: number; h: number; node: DiagramNode }

function layoutDiagram(nodes: DiagramNode[]): Box[] {
  const rows = Math.max(...nodes.map((n) => n.row)) + 1;
  const avail = CONTENT_BOTTOM - CONTENT_TOP;
  // leave at least ~95px between rows for arrows + labels
  const nodeH = Math.max(118, Math.min(175, (avail - (rows - 1) * 95) / rows));
  const gap = rows > 1 ? Math.min(150, (avail - rows * nodeH) / (rows - 1)) : 0;
  const totalH = rows * nodeH + (rows - 1) * gap;
  const y0 = CONTENT_TOP + (avail - totalH) / 2;
  const boxes: Box[] = [];
  for (let r = 0; r < rows; r++) {
    const inRow = nodes.filter((n) => n.row === r);
    const n = inRow.length;
    if (!n) continue;
    const w = n === 1 ? 440 : n === 2 ? 400 : (W - 100 - 2 * 30) / 3;
    const gx = n === 2 ? 60 : 30;
    const total = n * w + (n - 1) * gx;
    const x0 = (W - total) / 2;
    inRow.forEach((node, i) => boxes.push({ x: x0 + i * (w + gx), y: y0 + r * (nodeH + gap), w, h: nodeH, node }));
  }
  return boxes;
}

type Pt = { x: number; y: number };
function edgePath(a: Box, b: Box): [Pt, Pt, Pt, Pt] {
  if (b.node.row !== a.node.row) {
    const down = b.node.row > a.node.row;
    const p0 = { x: a.x + a.w / 2, y: down ? a.y + a.h : a.y };
    const p3 = { x: b.x + b.w / 2, y: down ? b.y : b.y + b.h };
    const dy = (p3.y - p0.y) * 0.5;
    return [p0, { x: p0.x, y: p0.y + dy }, { x: p3.x, y: p3.y - dy }, p3];
  }
  const right = b.x > a.x;
  const p0 = { x: right ? a.x + a.w : a.x, y: a.y + a.h / 2 };
  const p3 = { x: right ? b.x : b.x + b.w, y: b.y + b.h / 2 };
  return [p0, { x: (p0.x + p3.x) / 2, y: p0.y }, { x: (p0.x + p3.x) / 2, y: p3.y }, p3];
}
function bez(p: [Pt, Pt, Pt, Pt], u: number): Pt {
  const v = 1 - u;
  return {
    x: v * v * v * p[0].x + 3 * v * v * u * p[1].x + 3 * v * u * u * p[2].x + u * u * u * p[3].x,
    y: v * v * v * p[0].y + 3 * v * v * u * p[1].y + 3 * v * u * u * p[2].y + u * u * u * p[3].y,
  };
}

function drawDiagram(ctx: SKRSContext2D, v: Extract<Visual, { type: "diagram" }>, t: number, dur: number) {
  const boxes = layoutDiagram(v.nodes);
  const byId = new Map(boxes.map((b) => [b.node.id, b]));
  const order = [...boxes].sort((a, b) => a.node.row - b.node.row || a.x - b.x);
  const items = order.length + v.edges.length;
  const window = Math.min(dur * 0.55, items * 0.45);
  const step = window / Math.max(1, items);
  const nodeStart = new Map(order.map((b, i) => [b.node.id, 0.35 + i * step]));
  // edges appear right after both ends exist
  const edgeStart = v.edges.map((e, i) => Math.max(nodeStart.get(e.from)!, nodeStart.get(e.to)!) + 0.2 + i * 0.08);

  // edges first (under the nodes)
  v.edges.forEach((e, i) => {
    const a = byId.get(e.from), b = byId.get(e.to);
    if (!a || !b) return;
    const p = edgePath(a, b);
    const s = edgeStart[i];
    const grow = easeOut(prog(t, s, 0.5));
    if (grow <= 0) return;
    const color = KIND_COLOR[a.node.kind];
    // partial curve while growing
    ctx.save();
    ctx.strokeStyle = hexA(color, 0.75);
    ctx.lineWidth = 5;
    ctx.setLineDash([16, 12]);
    ctx.lineDashOffset = -t * 40;
    ctx.beginPath();
    const steps = 30;
    for (let k = 0; k <= steps * grow; k++) {
      const q = bez(p, k / steps);
      k === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    // arrow head
    if (grow > 0.98) {
      const end = p[3];
      const prev = bez(p, 0.94);
      const ang = Math.atan2(end.y - prev.y, end.x - prev.x);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - 26 * Math.cos(ang - 0.45), end.y - 26 * Math.sin(ang - 0.45));
      ctx.lineTo(end.x - 26 * Math.cos(ang + 0.45), end.y - 26 * Math.sin(ang + 0.45));
      ctx.closePath(); ctx.fill();
      // travelling data packets
      for (let k = 0; k < 2; k++) {
        const u = ((t - s) * 0.55 + k * 0.5 + i * 0.13) % 1;
        const q = bez(p, u);
        const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, 22);
        g.addColorStop(0, "rgba(255,255,255,0.95)");
        g.addColorStop(0.35, hexA(color, 0.9));
        g.addColorStop(1, hexA(color, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(q.x, q.y, 22, 0, Math.PI * 2); ctx.fill();
      }
    }
    // label
    if (e.label && grow > 0.6) {
      const m = bez(p, 0.5);
      ctx.globalAlpha = easeOut(prog(t, s + 0.3, 0.3));
      ctx.font = "26px RB";
      const tw = ctx.measureText(e.label).width;
      rr(ctx, m.x - tw / 2 - 14, m.y - 21, tw + 28, 42, 21);
      ctx.fillStyle = "#0b1126"; ctx.fill();
      ctx.strokeStyle = hexA(color, 0.6); ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = C.white; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(e.label, m.x, m.y + 1);
    }
    ctx.restore();
  });

  // nodes
  for (const b of boxes) {
    const p = easeBack(prog(t, nodeStart.get(b.node.id)!, 0.45));
    if (p <= 0) continue;
    const color = KIND_COLOR[b.node.kind];
    ctx.save();
    ctx.globalAlpha = clamp(p);
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.scale(0.7 + 0.3 * p, 0.7 + 0.3 * p);
    const x = -b.w / 2, y = -b.h / 2;
    // glow
    ctx.shadowColor = hexA(color, 0.45);
    ctx.shadowBlur = 30;
    rr(ctx, x, y, b.w, b.h, 26);
    ctx.fillStyle = C.panel; ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = hexA(color, 0.9); ctx.lineWidth = 3; ctx.stroke();
    // colored top strip
    rr(ctx, x + 18, y, b.w - 36, 6, 3);
    ctx.fillStyle = color; ctx.fill();
    icon(ctx, b.node.kind, 0, y + b.h * 0.36, b.h * 0.39, color);
    const size = fitFont(ctx, b.node.label, "RB", Math.round(b.h * 0.21), 22, b.w - 30, 1);
    ctx.fillStyle = C.white;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `${size}px RB`;
    ctx.fillText(b.node.label, 0, y + b.h * 0.79, b.w - 24);
    ctx.restore();
  }
}

function drawChart(ctx: SKRSContext2D, v: Extract<Visual, { type: "chart" }>, t: number) {
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  ctx.globalAlpha = easeOut(prog(t, 0.2, 0.4));
  ctx.font = "38px RR";
  ctx.fillStyle = C.muted;
  ctx.fillText(v.title, 60, CONTENT_TOP, W - 120);
  ctx.globalAlpha = 1;
  const max = Math.max(...v.bars.map((b) => b.value), 1e-9);
  const n = v.bars.length;
  const rowH = Math.min(170, (CONTENT_BOTTOM - CONTENT_TOP - 90) / n);
  v.bars.forEach((b, i) => {
    const y = CONTENT_TOP + 90 + i * rowH;
    const s = 0.4 + i * 0.35;
    const p = easeOut(prog(t, s, 0.9));
    const color = PALETTE[i % PALETTE.length];
    ctx.globalAlpha = clamp(prog(t, s, 0.3));
    ctx.font = "36px RB";
    ctx.fillStyle = C.white;
    ctx.fillText(b.label, 60, y);
    // track
    rr(ctx, 60, y + 52, W - 120, 58, 16);
    ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fill();
    const bw = Math.max(18, (W - 120) * (b.value / max)) * p;
    const g = ctx.createLinearGradient(60, 0, 60 + bw, 0);
    g.addColorStop(0, hexA(color, 0.65));
    g.addColorStop(1, color);
    rr(ctx, 60, y + 52, bw, 58, 16);
    ctx.fillStyle = g; ctx.fill();
    // value
    const shown = b.value * p;
    const val = `${b.value >= 100 ? Math.round(shown).toLocaleString("en-US") : shown.toFixed(b.value % 1 ? 2 : 0)} ${v.unit}`.trim();
    ctx.font = "34px RB";
    const tw = ctx.measureText(val).width;
    const inside = bw > tw + 40;
    ctx.fillStyle = inside ? "#0a0e1e" : C.white;
    ctx.fillText(val, inside ? 60 + bw - tw - 20 : 60 + bw + 16, y + 63);
    ctx.globalAlpha = 1;
  });
}

function drawCompare(ctx: SKRSContext2D, v: Extract<Visual, { type: "compare" }>, t: number) {
  const colW = (W - 120 - 40) / 2;
  const sides = [{ ...v.left, x: 60, color: C.accent }, { ...v.right, x: 60 + colW + 40, color: C.pink }];
  const maxItems = Math.max(v.left.items.length, v.right.items.length);
  sides.forEach((side, si) => {
    const a = easeOut(prog(t, 0.3 + si * 0.25, 0.5));
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, 40 * (1 - a));
    const top = CONTENT_TOP + 10;
    const h = 150 + maxItems * 150;
    rr(ctx, side.x, top, colW, h, 28);
    ctx.fillStyle = C.panel; ctx.fill();
    ctx.strokeStyle = hexA(side.color, 0.6); ctx.lineWidth = 3; ctx.stroke();
    rr(ctx, side.x, top, colW, 110, 28);
    ctx.fillStyle = hexA(side.color, 0.16); ctx.fill();
    ctx.fillStyle = side.color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    fitFont(ctx, side.title, "RB", 52, 30, colW - 40, 1);
    ctx.fillText(side.title, side.x + colW / 2, top + 56);
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    side.items.forEach((item, i) => {
      const ip = easeOut(prog(t, 0.9 + (i * 2 + si) * 0.3, 0.4));
      ctx.globalAlpha = a * ip;
      const y = top + 140 + i * 150;
      ctx.fillStyle = side.color;
      ctx.beginPath(); ctx.arc(side.x + 38, y + 22, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = C.white;
      ctx.font = "34px RR";
      wrap(ctx, item, colW - 80).slice(0, 3).forEach((l, li) => ctx.fillText(l, side.x + 62, y + li * 42));
    });
    ctx.restore();
  });
  // VS badge
  const p = easeBack(prog(t, 0.7, 0.4));
  if (p > 0) {
    ctx.save();
    ctx.translate(W / 2, CONTENT_TOP + 65);
    ctx.scale(p, p);
    ctx.beginPath(); ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fillStyle = C.accent2; ctx.fill();
    ctx.fillStyle = "#0a0e1e"; ctx.font = "40px RB"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("VS", 0, 2);
    ctx.restore();
  }
}

const KW = /^(const|let|var|function|return|if|else|for|while|async|await|import|from|export|class|new|def|print|try|catch|except|SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|CREATE|TABLE|JOIN|ON|GROUP|BY|ORDER|LIMIT|INDEX|true|false|null|None|True|False|public|private|static|void|int|string|go|func|fn|use|docker|kubectl|git|npm|RUN|FROM|COPY|CMD)$/;
function tokens(line: string): { text: string; color: string }[] {
  const out: { text: string; color: string }[] = [];
  const re = /((?:^|(?<=\s))(?:\/\/|#|--).*)|("[^"]*"?|'[^']*'?|`[^`]*`?)|(\b\d+(\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    const [tok] = m;
    let color = "#e6edf3";
    if (m[1]) color = "#6b7a99";
    else if (m[2]) color = "#ffd479";
    else if (m[3]) color = "#bd93f9";
    else if (m[5]) color = KW.test(tok) ? "#ff79c6" : /^[A-Z]/.test(tok) ? "#8be9fd" : line[re.lastIndex] === "(" ? "#50fa7b" : "#e6edf3";
    else if (m[7]) color = "#8c97b8";
    out.push({ text: tok, color });
  }
  return out;
}

function drawCode(ctx: SKRSContext2D, v: Extract<Visual, { type: "code" }>, t: number, dur: number) {
  const lh = 58;
  const h = 120 + v.lines.length * lh + 30;
  const y0 = CONTENT_TOP + Math.max(0, (CONTENT_BOTTOM - CONTENT_TOP - h) / 2 - 40);
  const a = easeOut(prog(t, 0.2, 0.4));
  ctx.save();
  ctx.globalAlpha = a;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 40;
  rr(ctx, 50, y0, W - 100, h, 24);
  ctx.fillStyle = "#0d1117"; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 2; ctx.stroke();
  ["#ff5f57", "#febc2e", "#28c840"].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(95 + i * 40, y0 + 45, 12, 0, Math.PI * 2); ctx.fill(); });
  ctx.fillStyle = C.muted; ctx.font = "28px RM"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
  ctx.fillText(v.lang, W - 90, y0 + 45);
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  const totalChars = v.lines.reduce((s, l) => s + l.length, 0);
  let budget = Math.floor(totalChars * prog(t, 0.6, Math.max(1, dur * 0.6)));
  ctx.font = "36px RM";
  const charW = ctx.measureText("M").width;
  let cursor: Pt | null = null;
  v.lines.forEach((line, i) => {
    const y = y0 + 100 + i * lh;
    ctx.fillStyle = "#3b4566";
    ctx.textAlign = "right";
    ctx.fillText(String(i + 1), 120, y);
    ctx.textAlign = "left";
    if (budget <= 0) return;
    let x = 150;
    let remaining = Math.min(budget, line.length);
    budget -= line.length;
    for (const tk of tokens(line)) {
      if (remaining <= 0) break;
      const part = tk.text.slice(0, remaining);
      ctx.fillStyle = tk.color;
      ctx.fillText(part, x, y);
      x += part.length * charW;
      remaining -= part.length;
    }
    cursor = { x, y };
  });
  const cur = cursor as Pt | null;
  if (cur && Math.floor(t * 2.5) % 2 === 0) { ctx.fillStyle = C.accent; ctx.fillRect(cur.x + 2, cur.y, 4, 40); }
  ctx.restore();
}

function drawStat(ctx: SKRSContext2D, v: Extract<Visual, { type: "stat" }>, t: number) {
  const cx = W / 2, cy = CONTENT_TOP + 330;
  const p = easeOut(prog(t, 0.3, 1.2));
  // ring
  ctx.save();
  ctx.lineWidth = 22;
  ctx.strokeStyle = "rgba(255,255,255,0.07)";
  ctx.beginPath(); ctx.arc(cx, cy, 280, 0, Math.PI * 2); ctx.stroke();
  const g = ctx.createLinearGradient(cx - 280, cy - 280, cx + 280, cy + 280);
  g.addColorStop(0, C.accent); g.addColorStop(1, C.accent2);
  ctx.strokeStyle = g;
  ctx.lineCap = "round";
  ctx.beginPath(); ctx.arc(cx, cy, 280, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * 0.78 * p); ctx.stroke();
  // value with count-up
  const m = /^([^\d]*)(\d+(?:\.\d+)?)(.*)$/.exec(v.value);
  const decimals = m && m[2].includes(".") ? m[2].split(".")[1].length : 0;
  const text = m ? `${m[1]}${(parseFloat(m[2]) * p).toFixed(decimals)}${m[3]}` : v.value;
  const pop = easeBack(prog(t, 0.3, 0.5));
  ctx.translate(cx, cy);
  ctx.scale(0.5 + 0.5 * pop, 0.5 + 0.5 * pop);
  ctx.globalAlpha = clamp(pop);
  ctx.fillStyle = C.white;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  fitFont(ctx, v.value, "RB", 190, 80, 400, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = easeOut(prog(t, 0.9, 0.4));
  ctx.fillStyle = C.accent2;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  const size = fitFont(ctx, v.label, "RB", 52, 34, W - 160, 2);
  wrap(ctx, v.label, W - 160).forEach((l, i) => ctx.fillText(l, W / 2, cy + 330 + i * size * 1.2));
  ctx.restore();
}

function drawBullets(ctx: SKRSContext2D, points: string[], t: number, dur: number) {
  let y = CONTENT_TOP + 20;
  const step = Math.min(1.2, (dur * 0.6) / Math.max(1, points.length));
  points.forEach((p, i) => {
    const a = easeOut(prog(t, 0.4 + i * step, 0.45));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(60 * (1 - a), 0);
    ctx.font = "44px RR";
    const lines = wrap(ctx, p, W - 260);
    const h = lines.length * 58 + 64;
    rr(ctx, 60, y, W - 120, h, 26);
    ctx.fillStyle = C.panel; ctx.fill();
    ctx.strokeStyle = C.line; ctx.lineWidth = 2; ctx.stroke();
    rr(ctx, 90, y + h / 2 - 32, 64, 64, 18);
    ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.fill();
    ctx.fillStyle = "#0a0e1e"; ctx.font = "38px RB"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(String(i + 1), 122, y + h / 2 + 1);
    ctx.textAlign = "left"; ctx.textBaseline = "top"; ctx.fillStyle = C.white; ctx.font = "44px RR";
    lines.forEach((l, li) => ctx.fillText(l, 185, y + 32 + li * 58));
    ctx.restore();
    y += h + 28;
  });
}

// ---------------------------------------------------------------- main entry
export interface SceneTiming { dur: number; speech: number; chunks: string[] }

export function drawFrame(ctx: SKRSContext2D, f: FrameInfo, scene: Scene, timing: SceneTiming, t: number, globalT: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  background(ctx, globalT);
  header(ctx, f, t, timing.dur);

  // scene entrance: quick swipe in from the right + slow push-in (keeps the frame alive)
  const enter = easeOut(prog(t, 0, 0.28));
  const zoom = 1 + 0.03 * clamp(t / Math.max(timing.dur, 0.1));
  ctx.save();
  ctx.globalAlpha = clamp(enter * 1.4);
  ctx.translate(W / 2, 900);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2 + 90 * (1 - enter), -900);
  const v = scene.visual;
  if (v.type === "title") drawTitle(ctx, f, t);
  else {
    heading(ctx, scene.heading, t);
    if (v.type === "diagram") drawDiagram(ctx, v, t, timing.dur);
    else if (v.type === "chart") drawChart(ctx, v, t);
    else if (v.type === "compare") drawCompare(ctx, v, t);
    else if (v.type === "code") drawCode(ctx, v, t, timing.dur);
    else if (v.type === "stat") drawStat(ctx, v, t);
    else drawBullets(ctx, v.points, t, timing.dur);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
  // quick light sweep on scene change
  if (t < 0.22 && f.sceneIdx > 0) {
    const x = -300 + (W + 600) * (t / 0.22);
    const g = ctx.createLinearGradient(x - 200, 0, x + 200, 0);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, "rgba(255,255,255,0.10)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
  subtitles(ctx, timing.chunks, t, timing.speech);
  if (f.sceneIdx === f.sceneCount - 1) followCard(ctx, f.handle, t - Math.max(0.6, timing.dur - 2.6));
}
