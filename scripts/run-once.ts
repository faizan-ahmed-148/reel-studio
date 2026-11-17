// Usage: npm run generate -- "optional topic" [--no-publish]
try { process.loadEnvFile(".env.local"); } catch { /* optional */ }
import { runOnce } from "../lib/pipeline";

const args = process.argv.slice(2);
const publish = args.includes("--no-publish") ? false : undefined;
const topic = args.filter((a) => !a.startsWith("--")).join(" ") || undefined;
runOnce({ topic, publish }).then((e) => {
  console.log(JSON.stringify(e, null, 2));
  process.exit(e?.status === "failed" ? 1 : 0);
});
