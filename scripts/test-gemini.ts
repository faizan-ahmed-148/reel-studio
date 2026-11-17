// npx tsx scripts/test-gemini.ts -> one Gemini request for 3 scenes, prints segment durations
import path from "node:path";
import { execFileSync } from "node:child_process";
import { geminiReel, voiceSpec } from "../lib/tts";
import { loadSettings, OUTPUT_DIR } from "../lib/store";
const texts = [
  "दोस्तो, सोचो अगर लाखों users एक साथ आपकी website खोलें तो server क्यों नहीं गिरता?",
  "इसका जवाब है load balancer, जो traffic को कई servers में बराबर बाँट देता है।",
  "ऐसी और videos के लिए follow करो!",
];
const dir = path.join(OUTPUT_DIR, "_gemini_test");
geminiReel(texts, voiceSpec(loadSettings()), dir).then((files) => {
  for (const f of files) console.log(path.basename(f), execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString().trim());
}).catch((e) => console.error("ERR", e.message.slice(0, 400)));
