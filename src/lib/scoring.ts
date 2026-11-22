import { sameLocalDay } from "./format";
import type { Point, Settings } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// When a point was last prayed. A never-prayed point counts as one full cadence ago, so it is due now.
export function lastPrayed(p: Point): number {
  return p.lastPrayedAt ?? p.createdAt - p.cadenceDays * DAY;
}

export function isEligible(p: Point, now: number): boolean {
  return p.status === "active" && !(p.snoozedUntil && p.snoozedUntil > now);
}

// How overdue a point is. 1.0 means "exactly due". Not capped.
export function rawRatio(p: Point, now: number): number {
  const sinceHours = Math.max(0, now - lastPrayed(p)) / HOUR;
  return sinceHours / (p.cadenceDays * 24);
}

export function score(p: Point, now: number, s: Settings): number {
  const ratio = Math.min(rawRatio(p, now), s.ratioCap);
  const boost = p.urgentUntil && p.urgentUntil > now ? s.urgencyBoost : 0;
  return ratio * s.priorityWeights[p.priority] + boost;
}

// Oldest first. Ties go to the smaller id, so the order is stable.
function byOldest(a: Point, b: Point): number {
  return lastPrayed(a) - lastPrayed(b) || a.id.localeCompare(b.id);
}

// The rotation (the algorithm). Order of picks:
//   1. Forced: points not prayed for maxGapDays or more (oldest first).
//   2. Top points by score.
//   3. Neglect ("wild card") slots: highest unweighted ratio, ignoring priority.
function pickRotation(points: Point[], s: Settings, now: number): string[] {
  const eligible = points.filter((p) => isEligible(p, now));
  const chosen: Point[] = [];
  const taken = new Set<string>();
  const take = (p: Point) => {
    chosen.push(p);
    taken.add(p.id);
  };

  const forced = eligible
    .filter((p) => now - lastPrayed(p) >= s.maxGapDays * DAY)
    .sort(byOldest)
    .slice(0, s.sessionSize);
  forced.forEach(take);

  const remaining = s.sessionSize - chosen.length;
  const neglectCount = Math.min(s.neglectSlots, remaining);
  const scoreCount = remaining - neglectCount;

  eligible
    .filter((p) => !taken.has(p.id))
    .sort((a, b) => score(b, now, s) - score(a, now, s) || byOldest(a, b))
    .slice(0, scoreCount)
    .forEach(take);

  eligible
    .filter((p) => !taken.has(p.id))
    .sort((a, b) => rawRatio(b, now) - rawRatio(a, now) || byOldest(a, b))
    .slice(0, neglectCount)
    .forEach(take);

  // If neglect slots found nothing, fill spare room with more top-score points.
  const spare = s.sessionSize - chosen.length;
  if (spare > 0) {
    eligible
      .filter((p) => !taken.has(p.id))
      .sort((a, b) => score(b, now, s) - score(a, now, s) || byOldest(a, b))
      .slice(0, spare)
      .forEach(take);
  }

  return chosen.map((p) => p.id);
}

// Today's list: every "guaranteed daily" point first (once a day), then the rotation.
// Daily points are NOT part of the rotation and do not use up its slots.
export function buildSession(points: Point[], s: Settings, now: number): string[] {
  const dailies = points
    .filter((p) => p.daily && isEligible(p, now) && !(p.lastPrayedAt && sameLocalDay(p.lastPrayedAt, now)))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id))
    .map((p) => p.id);
  const rotation = pickRotation(points.filter((p) => !p.daily), s, now);
  return [...dailies, ...rotation];
}

// "Keep praying": the next single point from the rotation, skipping ids already shown.
// Every 4th extra card is a neglect (wild card) pick, so low-priority points still get a turn.
export function nextExtra(
  points: Point[],
  s: Settings,
  now: number,
  exclude: string[],
  extraCount: number,
): string | undefined {
  const pool = points.filter((p) => !p.daily && !exclude.includes(p.id));
  const one: Settings = { ...s, sessionSize: 1, neglectSlots: extraCount % 4 === 3 ? 1 : 0 };
  return pickRotation(pool, one, now)[0];
}
