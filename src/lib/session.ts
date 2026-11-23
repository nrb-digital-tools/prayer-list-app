// Today's list of cards, step by step. No screen code here, so it is easy to test.
import type { SessionSnapshot } from "./db";
import { dayStart, nextCard, type Round } from "./scoring";
import type { Point, Settings } from "./types";

// A new day: daily points, wild cards, and hard-limit points first.
export function newDay(points: Point[], s: Settings, now: number): SessionSnapshot {
  return { version: 2, startedAt: now, cards: dayStart(points, s, now).map((id) => ({ id })), roundStart: 0 };
}

// Guaranteed daily points added after the day started (or edited to daily) are added
// before the next card, if they are not in today's list yet and not prayed today.
export function addMissingDailies(snap: SessionSnapshot, points: Point[], now: number): SessionSnapshot {
  const inList = new Set(snap.cards.map((c) => c.id));
  const missing = dayStart(points.filter((p) => p.daily), { neglectSlots: 0, maxGapDays: Infinity } as Settings, now).filter(
    (id) => !inList.has(id),
  );
  if (!missing.length) return snap;
  const firstOpen = snap.cards.findIndex((c) => !c.result);
  const at = firstOpen === -1 ? snap.cards.length : firstOpen;
  const cards = [...snap.cards.slice(0, at), ...missing.map((id) => ({ id })), ...snap.cards.slice(at)];
  return { ...snap, cards, roundStart: snap.roundStart > at ? snap.roundStart + missing.length : snap.roundStart };
}

// The ids shown and postponed in the current round.
export function roundOf(snap: SessionSnapshot): Round {
  const cards = snap.cards.slice(snap.roundStart);
  return { shown: cards.map((c) => c.id), later: cards.filter((c) => c.result === "later").map((c) => c.id) };
}

// Index of the card on screen: the first card with no result whose point is still active. -1 if none.
export function currentIndex(snap: SessionSnapshot, isActive: (id: string) => boolean): number {
  return snap.cards.findIndex((c) => !c.result && isActive(c.id));
}

// Add the next card. Starts a new round when every point has had its turn.
// Returns the same snapshot when there is nothing to add (no non-daily points).
export function addNext(snap: SessionSnapshot, points: Point[], s: Settings, now: number): SessionSnapshot {
  let next = nextCard(points, s, now, roundOf(snap));
  let roundStart = snap.roundStart;
  if (next === "newRound") {
    roundStart = snap.cards.length;
    next = nextCard(points, s, now, { shown: [], later: [] });
  }
  if (!next || next === "newRound") return snap;
  return { ...snap, roundStart, cards: [...snap.cards, { id: next }] };
}

// Save what you did with the card at index i.
export function record(snap: SessionSnapshot, i: number, result: "prayed" | "later"): SessionSnapshot {
  return { ...snap, cards: snap.cards.map((c, j) => (j === i ? { ...c, result } : c)) };
}

export function targetReached(minutes: number, s: Settings): boolean {
  return minutes >= s.targetMinutes;
}

// ---- Prayer timer (Start / Pause) ----

// One card counts at most this much, so a timer left running cannot add hours by mistake.
export const MAX_CARD_SECONDS = 30 * 60;

// Seconds counted for the card on screen (capped).
export function cardSeconds(snap: SessionSnapshot, now: number): number {
  const ms = (snap.cardMs ?? 0) + (snap.timerSince !== undefined ? Math.max(0, now - snap.timerSince) : 0);
  return Math.min(Math.round(ms / 1000), MAX_CARD_SECONDS);
}

export function startTimer(snap: SessionSnapshot, now: number): SessionSnapshot {
  return snap.timerSince !== undefined ? snap : { ...snap, timerSince: now };
}

export function pauseTimer(snap: SessionSnapshot, now: number): SessionSnapshot {
  if (snap.timerSince === undefined) return snap;
  return { ...snap, timerSince: undefined, cardMs: (snap.cardMs ?? 0) + Math.max(0, now - snap.timerSince) };
}

// A new card starts at 0. A running timer keeps running for it; a paused one stays paused.
export function resetCardTime(snap: SessionSnapshot, now: number): SessionSnapshot {
  return { ...snap, cardMs: 0, timerSince: snap.timerSince !== undefined ? now : undefined };
}
