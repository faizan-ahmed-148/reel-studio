// npx tsx scripts/test-script.ts "topic" -> generates a script with the saved settings and prints stats
import { generateScript } from "../lib/script";
import { loadSettings } from "../lib/store";
const t = Date.now();
generateScript(loadSettings(), process.argv[2] || "WebSockets vs HTTP polling", "Backend").then((s) => {
  const words = s.scenes.reduce((n, x) => n + x.narration.split(/\s+/).length, 0);
  console.log(`${(Date.now() - t) / 1000}s · ${s.scenes.length} scenes · ${words} words · visuals: ${s.scenes.map((x) => x.visual.type).join(",")}`);
  console.log(s.scenes.map((x) => `- ${x.heading} | ${x.narration}`).join("\n"));
}).catch((e) => console.error("ERR", e.message));
