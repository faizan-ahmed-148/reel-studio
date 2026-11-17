import cron, { type ScheduledTask } from "node-cron";
import { loadHistory, loadSettings, upsertHistory } from "./store";
import { runOnce } from "./pipeline";

// keep jobs on globalThis so hot-reload / separate module instances share them
const g = globalThis as unknown as { __reelTasks?: ScheduledTask[]; __reelStarted?: boolean };

export function reloadScheduler() {
  for (const t of g.__reelTasks ?? []) t.stop();
  g.__reelTasks = [];
  const { schedule } = loadSettings();
  if (!schedule.enabled || schedule.days.length === 0) return;
  for (const time of schedule.times) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!m) continue;
    const expr = `${Number(m[2])} ${Number(m[1])} * * ${[...schedule.days].sort().join(",")}`;
    const task = cron.schedule(
      expr,
      () => {
        console.log(`[reel-studio] scheduled run (${time})`);
        void runOnce({ trigger: "schedule" });
      },
      { timezone: schedule.timezone, name: `reel-${time}`, noOverlap: true },
    );
    g.__reelTasks.push(task);
  }
  console.log(`[reel-studio] scheduler: ${g.__reelTasks.length} job(s) active (${schedule.timezone})`);
}

export function startScheduler() {
  if (g.__reelStarted) return;
  g.__reelStarted = true;
  // a restart kills in-flight jobs; mark them failed so the UI doesn't spin forever
  for (const e of loadHistory()) {
    if (["generating", "rendering", "publishing"].includes(e.status)) {
      upsertHistory({ ...e, status: "failed", progress: undefined, error: "Server restart ho gaya tha — dobara chalayein." });
    }
  }
  reloadScheduler();
}

/** Next N run times computed from the schedule (for display). */
export function nextRuns(count = 5): string[] {
  const { schedule } = loadSettings();
  if (!schedule.enabled) return [];
  const out: Date[] = [];
  const tz = schedule.timezone;
  // current wall-clock time in the target timezone
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false, weekday: "short",
  });
  const parts = (d: Date) => Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  const offsetMs = (() => {
    const p = parts(now);
    const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute);
    return asUtc - Math.floor(now.getTime() / 60000) * 60000;
  })();
  const wallNow = new Date(now.getTime() + offsetMs);
  for (let d = 0; d < 14 && out.length < count * 3; d++) {
    const day = new Date(Date.UTC(wallNow.getUTCFullYear(), wallNow.getUTCMonth(), wallNow.getUTCDate() + d));
    if (!schedule.days.includes(day.getUTCDay())) continue;
    for (const t of schedule.times) {
      const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
      if (!m) continue;
      const wall = new Date(day.getTime() + (+m[1] * 60 + +m[2]) * 60000);
      if (wall > wallNow) out.push(new Date(wall.getTime() - offsetMs));
    }
  }
  return out.sort((a, b) => +a - +b).slice(0, count).map((d) => d.toISOString());
}
