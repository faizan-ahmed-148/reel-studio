import { NextResponse } from "next/server";
import { loadHistory } from "@/lib/store";
import { isBusy } from "@/lib/pipeline";
import { nextRuns } from "@/lib/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ busy: isBusy(), nextRuns: nextRuns(), history: loadHistory().slice(0, 50) });
}
