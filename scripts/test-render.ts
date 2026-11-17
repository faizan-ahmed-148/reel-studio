// Renders a sample reel (no Groq, no upload): npx tsx scripts/test-render.ts
import path from "node:path";
import { buildVideo } from "../lib/video";
import { DEFAULT_SETTINGS, OUTPUT_DIR } from "../lib/store";
import type { ReelScript } from "../lib/script";

const script: ReelScript = {
  topic: "Load Balancer", category: "System Design",
  hook: "Lakhon users, phir bhi server crash nahi?",
  scenes: [
    { heading: "", visual: { type: "title" }, subtitle: "Dosto, lakhon users ek saath aayein to server crash kyun nahi hota?", narration: "दोस्तो, लाखों users एक साथ आएं तो server crash क्यों नहीं होता?" },
    { heading: "Load Balancer ka kaam", subtitle: "Load balancer traffic ko kai servers mein barabar baant deta hai.", narration: "Load balancer traffic को कई servers में बराबर बाँट देता है।",
      visual: { type: "diagram", nodes: [
        { id: "u", label: "Users", kind: "user", row: 0 }, { id: "lb", label: "Load Balancer", kind: "loadbalancer", row: 1 },
        { id: "s1", label: "Server 1", kind: "server", row: 2 }, { id: "s2", label: "Server 2", kind: "server", row: 2 }, { id: "s3", label: "Server 3", kind: "server", row: 2 },
        { id: "db", label: "Database", kind: "database", row: 3 }],
        edges: [{ from: "u", to: "lb", label: "HTTPS" }, { from: "lb", to: "s1" }, { from: "lb", to: "s2" }, { from: "lb", to: "s3" }, { from: "s1", to: "db" }, { from: "s2", to: "db" }, { from: "s3", to: "db" }] } },
    { heading: "Speed ka farq", subtitle: "Cache se data milna database se kahin zyada tez hai.", narration: "Cache से data मिलना database से कहीं ज़्यादा तेज़ है।",
      visual: { type: "chart", title: "Response time (kam behtar)", unit: "ms", bars: [{ label: "Database", value: 120 }, { label: "Redis Cache", value: 2 }, { label: "CDN", value: 15 }] } },
    { heading: "Round Robin vs Least Conn", subtitle: "Do mashhoor tareeqay, dono ke apne fayde.", narration: "दो मशहूर तरीक़े, दोनों के अपने फ़ायदे।",
      visual: { type: "compare", left: { title: "Round Robin", items: ["Baari baari request", "Simple setup"] }, right: { title: "Least Conn", items: ["Kam load wala server", "Smart balancing"] } } },
    { heading: "Nginx config", subtitle: "Nginx mein bas itni si config chahiye.", narration: "Nginx में बस इतनी सी config चाहिए।",
      visual: { type: "code", lang: "nginx", lines: ["upstream app {", "  server 10.0.0.1;", "  server 10.0.0.2;", "}", "location / {", "  proxy_pass http://app;", "}"] } },
    { heading: "Netflix ka scale", subtitle: "Bade apps hazaron servers par traffic baant-te hain. Follow karo aisi aur videos ke liye!", narration: "बड़े apps हज़ारों servers पर traffic बाँटते हैं। ऐसी और videos के लिए follow करें!",
      visual: { type: "stat", value: "99.99%", label: "Uptime load balancing ki wajah se" } },
  ],
  caption: "test", hashtags: [],
};
const t = Date.now();
buildVideo(script, { ...DEFAULT_SETTINGS, handle: "@softwarewala" }, path.join(OUTPUT_DIR, "_test"), (m) => console.log(m))
  .then((f) => console.log("OK:", f, (Date.now() - t) / 1000, "s"));
