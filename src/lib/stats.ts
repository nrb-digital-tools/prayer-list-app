import type { PrayerLog } from "./types";

export type Range = "day" | "week" | "month";

export interface Bucket {
  start: number; // start of the day / week (Sunday) / month, local time
  label: string; // short axis label
  full: string; // long label for tooltips and the table
  minutes: number;
  prayers: number;
}

export const RANGE_COUNT: Record<Range, number> = { day: 14, week: 12, month: 12 };

function startOf(range: Range, ms: number): Date {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  if (range === "week") d.setDate(d.getDate() - d.getDay());
  if (range === "month") d.setDate(1);
  return d;
}

function step(range: Range, d: Date, n: number): Date {
  const x = new Date(d);
  if (range === "day") x.setDate(x.getDate() + n);
  else if (range === "week") x.setDate(x.getDate() + 7 * n);
  else x.setMonth(x.getMonth() + n);
  return x;
}

// The last `count` days / weeks / months, oldest first, with the minutes and prayers in each.
export function buckets(logs: PrayerLog[], range: Range, now: number, count = RANGE_COUNT[range]): Bucket[] {
  const current = startOf(range, now);
  const starts = Array.from({ length: count }, (_, i) => step(range, current, i - (count - 1)));
  const out: Bucket[] = starts.map((d) => ({
    start: d.getTime(),
    label:
      range === "day"
        ? String(d.getDate())
        : range === "week"
          ? `${d.getMonth() + 1}/${d.getDate()}`
          : d.toLocaleDateString(undefined, { month: "short" }),
    full:
      range === "day"
        ? d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
        : range === "week"
          ? `Week of ${d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
          : d.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    minutes: 0,
    prayers: 0,
  }));
  const end = step(range, current, 1).getTime();
  for (const l of logs) {
    if (l.prayedAt < out[0].start || l.prayedAt >= end) continue;
    let i = out.length - 1;
    while (i > 0 && out[i].start > l.prayedAt) i--;
    out[i].minutes += (l.seconds ?? 0) / 60;
    out[i].prayers += 1;
  }
  return out;
}

// Minutes prayed today (time on cards marked Prayed, as on the Stats tab).
export function minutesToday(logs: PrayerLog[], now: number): number {
  return buckets(logs, "day", now, 1)[0].minutes;
}

// A whole-number index for the local calendar day (safe across daylight saving changes).
function dayIndex(ms: number): number {
  const d = new Date(ms);
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000);
}

export interface Streaks {
  current: number; // days in a row. Still alive if you prayed yesterday but not yet today.
  longest: number;
  prayedToday: boolean;
  daysPrayed: number; // all-time days with at least one prayer
}

// A day counts when at least one point was marked prayed on it.
export function streaks(logs: PrayerLog[], now: number): Streaks {
  const days = [...new Set(logs.map((l) => dayIndex(l.prayedAt)))].sort((a, b) => a - b);
  const set = new Set(days);
  const today = dayIndex(now);
  let d = set.has(today) ? today : today - 1;
  let current = 0;
  while (set.has(d)) {
    current++;
    d--;
  }
  let longest = 0;
  let run = 0;
  days.forEach((x, i) => {
    run = i > 0 && x === days[i - 1] + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
  });
  return { current, longest, prayedToday: set.has(today), daysPrayed: days.length };
}

export function totalMinutes(buckets: Bucket[]): number {
  return buckets.reduce((sum, b) => sum + b.minutes, 0);
}

// A "nice" top value and tick step for the chart's vertical axis.
export function niceScale(max: number): { top: number; step: number } {
  if (max <= 0) return { top: 4, step: 1 };
  const raw = max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw)!;
  return { top: Math.ceil(max / step) * step, step };
}

export function formatMinutes(min: number): string {
  if (min < 1) return min > 0 ? "<1 min" : "0 min";
  if (min < 60) return `${Math.round(min)} min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
}
