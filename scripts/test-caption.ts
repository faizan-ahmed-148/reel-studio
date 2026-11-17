// npx tsx scripts/test-caption.ts  -> prints sample captions using the saved Groq key
import { generateCaptions } from "../lib/caption";
import { loadSettings } from "../lib/store";
const script = {
  topic: "Load Balancer", category: "System Design", hook: "Lakhon users, phir bhi server crash nahi?",
  scenes: [
    { heading: "Load Balancer ka kaam", subtitle: "Load balancer traffic ko kai servers mein barabar baant deta hai.", narration: "", visual: { type: "title" as const } },
    { heading: "Round Robin vs Least Conn", subtitle: "Do mashhoor tareeqay, dono ke apne fayde.", narration: "", visual: { type: "title" as const } },
  ],
  caption: "", hashtags: [],
};
generateCaptions(script, loadSettings()).then((c) => { for (const [p, t] of Object.entries(c)) console.log(`\n===== ${p} =====\n${t}`); });
