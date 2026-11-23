import { describe, expect, it } from "vitest";
import { dayStart, isDue, nextCard, nextDue, rawRatio, score, type Round } from "./scoring";
import { addMissingDailies, addNext, cardSeconds, currentIndex, MAX_CARD_SECONDS, newDay, pauseTimer, record, resetCardTime, roundOf, startTimer, targetReached } from "./session";
import { minutesToday } from "./stats";
import { DEFAULT_SETTINGS, type Point, type Settings } from "./types";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;

let n = 0;
function pt(over: Partial<Point> & { daysAgo?: number }): Point {
  const { daysAgo = 0, ...rest } = over;
  const id = rest.id ?? `p${++n}`;
  return {
    id,
    title: id,
    cadenceDays: 7,
    status: "active",
    createdAt: NOW - 1000 * DAY,
    updatedAt: NOW,
    lastPrayedAt: NOW - daysAgo * DAY,
    ...rest,
  };
}

const S: Settings = { ...DEFAULT_SETTINGS, neglectSlots: 1 };
const R0: Round = { shown: [], later: [] };

describe("ratio and score", () => {
  it("is 1.0 when a point is exactly due", () => {
    expect(rawRatio(pt({ daysAgo: 7 }), NOW)).toBeCloseTo(1);
  });
  it("is 0 right after praying", () => {
    expect(score(pt({ daysAgo: 0 }), NOW, S)).toBe(0);
  });
  it("grows with time (aging)", () => {
    const p = pt({ daysAgo: 7 });
    expect(score(p, NOW + 7 * DAY, S)).toBeGreaterThan(score(p, NOW, S));
  });
  it("caps the ratio", () => {
    const p = pt({ cadenceDays: 1, daysAgo: 500 });
    expect(score(p, NOW, S)).toBe(S.ratioCap);
  });
  it("adds the urgency boost only until it expires", () => {
    const p = pt({ daysAgo: 0, urgentUntil: NOW + DAY });
    expect(score(p, NOW, S)).toBe(S.urgencyBoost);
    expect(score(p, NOW + 2 * DAY, S)).toBeLessThan(S.urgencyBoost);
  });
  it("keeps the urgency boost with no end date until it is removed", () => {
    const p = pt({ daysAgo: 0, urgentNoEnd: true });
    expect(score(p, NOW + 1000 * DAY, { ...S, ratioCap: 0 })).toBe(S.urgencyBoost);
    expect(score({ ...p, urgentNoEnd: undefined }, NOW, S)).toBe(0);
  });
  it("ignores old priority values (priority was removed)", () => {
    expect(score(pt({ daysAgo: 7, priority: 3 }), NOW, S)).toBeCloseTo(score(pt({ daysAgo: 7, priority: 1 }), NOW, S));
  });
});

describe("never-prayed points", () => {
  it("are due right away (ratio 1.0)", () => {
    const p = pt({ id: "new", cadenceDays: 7, createdAt: NOW, lastPrayedAt: undefined });
    expect(rawRatio(p, NOW)).toBeCloseTo(1);
    expect(isDue(p, NOW)).toBe(true);
  });
  it("come before points that were just prayed for", () => {
    const fresh = [1, 2, 3].map((i) => pt({ id: `f${i}`, daysAgo: 0 }));
    const brandNew = pt({ id: "new", createdAt: NOW, lastPrayedAt: undefined });
    expect(nextCard([...fresh, brandNew], S, NOW, R0)).toBe("new");
  });
});

describe("dayStart (first cards of the day)", () => {
  it("puts daily points first, then wild cards, then hard-limit points", () => {
    const d = pt({ id: "d", daily: true, daysAgo: 1 });
    const due = pt({ id: "due", daysAgo: 10 });
    const old = pt({ id: "old", cadenceDays: 365, daysAgo: 70 }); // not due, but past the 60-day hard limit
    const fresh = pt({ id: "fresh", daysAgo: 1 });
    expect(dayStart([fresh, old, due, d], S, NOW)).toEqual(["d", "due", "old"]);
  });
  it("wild cards take only due points, oldest last-prayed date first", () => {
    const yearly = pt({ id: "yearly", cadenceDays: 365, daysAgo: 50 }); // oldest date, but not due
    const a = pt({ id: "a", daysAgo: 20 });
    const b = pt({ id: "b", daysAgo: 30 });
    const c = pt({ id: "c", daysAgo: 8 });
    expect(dayStart([yearly, a, b, c], { ...S, neglectSlots: 2 }, NOW)).toEqual(["b", "a"]);
  });
  it("has no wild cards when nothing is due", () => {
    expect(dayStart([pt({ id: "a", daysAgo: 1 })], { ...S, neglectSlots: 2 }, NOW)).toEqual([]);
  });
  it("leaves out daily points prayed today, and answered or archived points", () => {
    const d = pt({ id: "d", daily: true, lastPrayedAt: NOW - 1000 });
    const ans = pt({ id: "ans", status: "answered", daysAgo: 99 });
    const arc = pt({ id: "arc", status: "archived", daysAgo: 99 });
    expect(dayStart([d, ans, arc], S, NOW)).toEqual([]);
  });
  it("brings a daily point back the next day, whatever its cadence", () => {
    const d = pt({ id: "d", daily: true, cadenceDays: 365, daysAgo: 1 });
    expect(dayStart([d], S, NOW)).toEqual(["d"]);
  });
  it("ignores old snooze dates (snooze was removed)", () => {
    const p = pt({ id: "snz", daysAgo: 99, snoozedUntil: NOW + DAY });
    expect(dayStart([p], S, NOW)).toContain("snz");
  });
});

describe("nextCard (one card at a time)", () => {
  it("picks due points by score, then not-yet-due points by next due date", () => {
    const weeklyLate = pt({ id: "wl", cadenceDays: 7, daysAgo: 14 }); // ratio 2
    const monthlyLate = pt({ id: "ml", cadenceDays: 30, daysAgo: 45 }); // ratio 1.5
    const soon = pt({ id: "soon", cadenceDays: 7, daysAgo: 6 }); // due in 1 day
    const later = pt({ id: "later", cadenceDays: 30, daysAgo: 25 }); // due in 5 days
    const pts = [later, soon, monthlyLate, weeklyLate];
    const order: string[] = [];
    const round: Round = { shown: [], later: [] };
    for (let i = 0; i < 4; i++) {
      const id = nextCard(pts, S, NOW, round) as string;
      order.push(id);
      round.shown.push(id);
    }
    expect(order).toEqual(["wl", "ml", "soon", "later"]);
  });
  it("puts urgent points with the due ones, even when they are not due", () => {
    const due = pt({ id: "due", daysAgo: 8 });
    const urgent = pt({ id: "urgent", daysAgo: 0, urgentNoEnd: true });
    expect(nextCard([due, urgent], S, NOW, R0)).toBe("urgent");
  });
  it("brings a Later point back after the due points, before not-yet-due points", () => {
    const a = pt({ id: "a", daysAgo: 20 });
    const b = pt({ id: "b", daysAgo: 10 });
    const notDue = pt({ id: "nd", daysAgo: 1 });
    const pts = [a, b, notDue];
    // "a" was shown and postponed. "b" (due) comes first, then "a" again, then the not-due point.
    expect(nextCard(pts, S, NOW, { shown: ["a"], later: ["a"] })).toBe("b");
    expect(nextCard(pts, S, NOW, { shown: ["a", "b"], later: ["a"] })).toBe("a");
    expect(nextCard(pts, S, NOW, { shown: ["a", "b", "a"], later: ["a"] })).toBe("nd");
  });
  it("never brings the card just postponed straight back when another card is available", () => {
    const a = pt({ id: "a", daysAgo: 1 }); // not due
    const b = pt({ id: "b", daysAgo: 2 }); // not due
    // "a" was just postponed and nothing is due: show "b" first, then "a" comes back
    expect(nextCard([a, b], S, NOW, { shown: ["a"], later: ["a"] })).toBe("b");
    expect(nextCard([a, b], S, NOW, { shown: ["a", "b"], later: ["a"] })).toBe("a");
    // with only one point, it does come back (there is nothing else)
    expect(nextCard([a], S, NOW, { shown: ["a"], later: ["a"] })).toBe("a");
  });
  it("a second Later waits for the next round", () => {
    const a = pt({ id: "a", daysAgo: 20 });
    expect(nextCard([a], S, NOW, { shown: ["a", "a"], later: ["a", "a"] })).toBe("newRound");
  });
  it("says newRound when every point has had its turn, and undefined when there are no points", () => {
    const a = pt({ id: "a", daysAgo: 1 });
    expect(nextCard([a], S, NOW, { shown: ["a"], later: [] })).toBe("newRound");
    expect(nextCard([], S, NOW, R0)).toBeUndefined();
  });
  it("never picks guaranteed daily points", () => {
    const d = pt({ id: "d", daily: true, daysAgo: 99 });
    expect(nextCard([d], S, NOW, R0)).toBeUndefined();
    expect(nextCard([d, pt({ id: "o", daysAgo: 1 })], S, NOW, R0)).toBe("o");
  });
  it("next due date is last prayed plus the goal gap", () => {
    expect(nextDue(pt({ cadenceDays: 7, daysAgo: 2 }))).toBe(NOW + 5 * DAY);
  });
});

describe("session (today's cards)", () => {
  const active = () => true;
  it("goes through the day-start cards, then adds one at a time, then starts new rounds", () => {
    const d = pt({ id: "d", daily: true, daysAgo: 1 });
    const a = pt({ id: "a", daysAgo: 10 });
    const b = pt({ id: "b", daysAgo: 1 });
    const pts = [d, a, b];
    let s = newDay(pts, S, NOW);
    expect(s.cards.map((c) => c.id)).toEqual(["d", "a"]); // daily, then 1 wild card
    s = record(s, 0, "prayed");
    s = record(s, 1, "prayed");
    expect(currentIndex(s, active)).toBe(-1);
    s = addNext(s, pts, S, NOW);
    expect(s.cards[2].id).toBe("b");
    s = record(s, 2, "prayed");
    // every non-daily point has had a turn: a new round starts, without the daily point
    s = addNext(s, pts, S, NOW);
    expect(s.roundStart).toBe(3);
    expect(["a", "b"]).toContain(s.cards[3].id);
    expect(roundOf(s).shown).toEqual([s.cards[3].id]);
  });
  it("skips cards for points that are no longer active", () => {
    let s = newDay([pt({ id: "a", daysAgo: 10 })], S, NOW);
    expect(currentIndex(s, (id) => id !== "a")).toBe(-1);
    s = record(s, 0, "later");
    expect(roundOf(s).later).toEqual(["a"]);
  });
  it("adds a daily point created after the day started, before the next card", () => {
    const a = pt({ id: "a", daysAgo: 10 });
    let s = record(newDay([a], S, NOW), 0, "prayed");
    s = addNext(s, [a, pt({ id: "b", daysAgo: 1 })], S, NOW);
    const d = pt({ id: "d", daily: true, createdAt: NOW, lastPrayedAt: undefined });
    s = addMissingDailies(s, [a, d], NOW);
    expect(s.cards.map((c) => c.id)).toEqual(["a", "d", "b"]);
    expect(addMissingDailies(s, [a, d], NOW)).toBe(s); // not added twice
    // already prayed today: not added
    const prayedToday = { ...d, id: "d2", lastPrayedAt: NOW - 1000 };
    expect(addMissingDailies(s, [prayedToday], NOW)).toBe(s);
  });
  it("adds nothing when there are only daily points", () => {
    const s = newDay([pt({ id: "d", daily: true, daysAgo: 1 })], S, NOW);
    expect(addNext(record(s, 0, "prayed"), [pt({ id: "d", daily: true, daysAgo: 0 })], S, NOW).cards).toHaveLength(1);
  });
  it("knows when the time target is reached", () => {
    expect(targetReached(29.9, { ...S, targetMinutes: 30 })).toBe(false);
    expect(targetReached(30, { ...S, targetMinutes: 30 })).toBe(true);
  });
  it("counts today's minutes from prayer logs only", () => {
    const today = new Date(NOW).setHours(12, 0, 0, 0);
    const logs = [
      { id: "1", pointId: "x", prayedAt: today, seconds: 600, updatedAt: today },
      { id: "2", pointId: "x", prayedAt: today + 1000, seconds: 300, updatedAt: today },
      { id: "3", pointId: "x", prayedAt: today - DAY, seconds: 900, updatedAt: today },
    ];
    expect(minutesToday(logs, today + 2000)).toBe(15);
  });
});

describe("prayer timer (Start / Pause)", () => {
  const base = newDay([], S, NOW);
  it("counts nothing until Start", () => {
    expect(cardSeconds(base, NOW + 60_000)).toBe(0);
  });
  it("counts by the clock while running, even with no screen updates (phone locked)", () => {
    const s = startTimer(base, NOW);
    expect(cardSeconds(s, NOW + 5 * 60_000)).toBe(300);
  });
  it("keeps the counted time when paused, and adds more after Start again", () => {
    let s = startTimer(base, NOW);
    s = pauseTimer(s, NOW + 60_000);
    expect(cardSeconds(s, NOW + 10 * 60_000)).toBe(60);
    s = startTimer(s, NOW + 10 * 60_000);
    expect(cardSeconds(s, NOW + 11 * 60_000)).toBe(120);
  });
  it("caps one card at 30 minutes", () => {
    expect(MAX_CARD_SECONDS).toBe(1800);
    expect(cardSeconds(startTimer(base, NOW), NOW + 5 * 3_600_000)).toBe(1800);
  });
  it("starts the next card at 0, still running if it was running", () => {
    const running = resetCardTime(startTimer(base, NOW), NOW + 60_000);
    expect(cardSeconds(running, NOW + 90_000)).toBe(30);
    const paused = resetCardTime(pauseTimer(startTimer(base, NOW), NOW + 60_000), NOW + 70_000);
    expect(paused.timerSince).toBeUndefined();
    expect(cardSeconds(paused, NOW + 999_000)).toBe(0);
  });
});
