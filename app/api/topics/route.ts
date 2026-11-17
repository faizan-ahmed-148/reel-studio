import { NextResponse } from "next/server";
import { loadHistory, loadSettings } from "@/lib/store";
import { allTopics, CATEGORIES, normTopic } from "@/lib/topics";

export const dynamic = "force-dynamic";

/** All categories with their topics and whether each topic was already made. */
export async function GET() {
  const s = loadSettings();
  const used = new Set([...s.usedTopics, ...loadHistory().map((e) => e.topic)].filter(Boolean).map(normTopic));
  const queued = new Set(s.topicQueue.map(normTopic));
  const bank = allTopics(s.customTopics);
  const categories = Object.entries(bank).map(([name, topics]) => ({
    name,
    builtIn: !!CATEGORIES[name],
    enabled: s.categories.length === 0 || s.categories.includes(name),
    topics: topics.map((t) => ({
      title: t,
      custom: (s.customTopics[name] ?? []).includes(t),
      used: used.has(normTopic(t)),
      queued: queued.has(normTopic(t)),
    })),
  }));
  return NextResponse.json({ categories, queue: s.topicQueue, usedCount: s.usedTopics.length });
}
