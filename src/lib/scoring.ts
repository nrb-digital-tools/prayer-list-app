import { sameLocalDay } from "./format";
import type { Point, Settings } from "./types";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

// When a point was last prayed. A never-prayed point counts as one full cadence ago, so it is due now.
export function lastPrayed(p: Point): number {
  return p.lastPrayedAt ?? p.createdAt - p.cadenceDays * DAY;
}

export function isEligible(p: Point): boolean {
  return p.status === "active";
}

// Urgent until a date, or until the user removes it.
export function isUrgent(p: Point, now: number): boolean {
  return !!p.urgentNoEnd || (!!p.urgentUntil && p.urgentUntil > now);
}

// How overdue a point is. 1.0 means "exactly due". Not capped.
export function rawRatio(p: Point, now: number): number {
  const sinceHours = Math.max(0, now - lastPrayed(p)) / HOUR;
  return sinceHours / (p.cadenceDays * 24);
}

export function score(p: Point, now: number, s: Settings): number {
  const ratio = Math.min(rawRatio(p, now), s.ratioCap);
  return ratio + (isUrgent(p, now) ? s.urgencyBoost : 0);
}

// Oldest first. Ties go to the smaller id, so the order is stable.
function byOldest(a: Point, b: Point): number {
  return lastPrayed(a) - lastPrayed(b) || a.id.localeCompare(b.id);
}

// When a point is next due (last prayed + goal gap).
export function nextDue(p: Point): number {
  return lastPrayed(p) + p.cadenceDays * DAY;
}

// Due or overdue: the goal gap has passed.
export function isDue(p: Point, now: number): boolean {
  return rawRatio(p, now) >= 1;
}

// Today's first cards, set once when the day starts:
//   1. Guaranteed daily points not yet prayed today (oldest first by creation).
//   2. Wild cards: due points prayed longest ago (neglectSlots of them).
//   3. Hard limit: points not prayed for maxGapDays or more, not already picked (oldest first).
export function dayStart(points: Point[], s: Settings, now: number): string[] {
  const dailies = points
    .filter((p) => p.daily && isEligible(p) && !(p.lastPrayedAt && sameLocalDay(p.lastPrayedAt, now)))
    .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
  const rotation = points.filter((p) => !p.daily && isEligible(p));
  const wild = rotation
    .filter((p) => isDue(p, now))
    .sort(byOldest)
    .slice(0, Math.max(0, s.neglectSlots));
  const taken = new Set(wild.map((p) => p.id));
  const forced = rotation
    .filter((p) => !taken.has(p.id) && now - lastPrayed(p) >= s.maxGapDays * DAY)
    .sort(byOldest);
  return [...dailies, ...wild, ...forced].map((p) => p.id);
}

// What has happened in the current round (a round = every non-daily point once).
export interface Round {
  shown: string[]; // ids shown in this round, in order (a point can appear twice if it was postponed)
  later: string[]; // ids postponed with "Later" in this round, in the order they were postponed
}

// The next card after the day-start cards. Guaranteed daily points are never picked here.
//   a. Due, overdue, or urgent points not yet shown in this round, by score (highest first).
//   b. Points postponed with "Later" in this round that have not come back yet (first postponed first).
//      Each comes back once per round. A second "Later" waits for the next round.
//   c. Not-yet-due points not yet shown in this round, by next due date (soonest first).
// The card just shown is never picked again right away if another card is available
// (so "Later" never brings the same card straight back).
// Returns "newRound" when every point has had its turn, and undefined when there are no points at all.
export function nextCard(points: Point[], s: Settings, now: number, round: Round): string | "newRound" | undefined {
  const pool = points.filter((p) => !p.daily && isEligible(p));
  if (pool.length === 0) return undefined;
  const shown = new Set(round.shown);
  const fresh = pool.filter((p) => !shown.has(p.id));

  const due = fresh
    .filter((p) => isDue(p, now) || isUrgent(p, now))
    .sort((a, b) => score(b, now, s) - score(a, now, s) || byOldest(a, b));
  const ids = new Set(pool.map((p) => p.id));
  const timesShown = (id: string) => round.shown.filter((x) => x === id).length;
  const back = round.later.filter((id, i) => ids.has(id) && round.later.indexOf(id) === i && timesShown(id) === 1);
  const notDue = fresh
    .filter((p) => !due.includes(p))
    .sort((a, b) => nextDue(a) - nextDue(b) || a.id.localeCompare(b.id));

  const order = [...due.map((p) => p.id), ...back, ...notDue.map((p) => p.id)];
  if (order.length === 0) return "newRound";
  const last = round.shown[round.shown.length - 1];
  return order.find((id) => id !== last) ?? order[0];
}
