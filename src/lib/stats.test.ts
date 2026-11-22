import { describe, expect, it } from "vitest";
import { buckets, formatMinutes, niceScale, streaks } from "./stats";
import type { PrayerLog } from "./types";

// Local-time helpers, so the tests give the same result in any time zone.
const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h).getTime();
let n = 0;
const log = (prayedAt: number, seconds?: number): PrayerLog => ({
  id: `l${++n}`,
  pointId: "p",
  prayedAt,
  seconds,
  updatedAt: prayedAt,
});

const NOW = at(2026, 11, 22); // a Sunday

describe("streaks", () => {
  it("is 0 with no prayers", () => {
    expect(streaks([], NOW)).toEqual({ current: 0, longest: 0, prayedToday: false, daysPrayed: 0 });
  });
  it("counts days in a row ending today", () => {
    const logs = [at(2026, 11, 20), at(2026, 11, 21), at(2026, 11, 22, 8), at(2026, 11, 22, 20)].map((t) => log(t));
    const s = streaks(logs, NOW);
    expect(s.current).toBe(3);
    expect(s.prayedToday).toBe(true);
    expect(s.daysPrayed).toBe(3);
  });
  it("stays alive when you prayed yesterday but not yet today", () => {
    const logs = [at(2026, 11, 20), at(2026, 11, 21)].map((t) => log(t));
    const s = streaks(logs, NOW);
    expect(s.current).toBe(2);
    expect(s.prayedToday).toBe(false);
  });
  it("resets after a missed day", () => {
    const logs = [at(2026, 11, 18), at(2026, 11, 19), at(2026, 11, 21)].map((t) => log(t));
    expect(streaks(logs, at(2026, 11, 23)).current).toBe(0);
    expect(streaks(logs, NOW).current).toBe(1);
  });
  it("finds the longest streak", () => {
    const logs = [1, 2, 3, 4, 10, 11].map((d) => log(at(2026, 10, d)));
    expect(streaks(logs, NOW).longest).toBe(4);
  });
  it("works across a daylight saving change", () => {
    const logs = [at(2026, 3, 7), at(2026, 3, 8), at(2026, 3, 9), at(2026, 3, 10)].map((t) => log(t));
    expect(streaks(logs, at(2026, 3, 10)).current).toBe(4);
  });
});

describe("buckets", () => {
  it("makes the right number of buckets, oldest first, ending now", () => {
    const b = buckets([], "day", NOW);
    expect(b).toHaveLength(14);
    expect(b[13].start).toBe(at(2026, 11, 22, 0));
    expect(b[0].start).toBe(at(2026, 11, 9, 0));
  });
  it("adds minutes and prayers per day", () => {
    const logs = [log(at(2026, 11, 22, 7), 300), log(at(2026, 11, 22, 21), 120), log(at(2026, 11, 21), 600), log(at(2026, 11, 22, 9))];
    const b = buckets(logs, "day", NOW);
    expect(b[13].minutes).toBeCloseTo(7);
    expect(b[13].prayers).toBe(3);
    expect(b[12].minutes).toBeCloseTo(10);
  });
  it("groups by week (Sunday start) and by month", () => {
    const logs = [log(at(2026, 11, 22), 60), log(at(2026, 11, 16), 120), log(at(2026, 10, 30), 180)];
    const w = buckets(logs, "week", NOW);
    expect(w[11].start).toBe(at(2026, 11, 22, 0));
    expect(w[11].minutes).toBeCloseTo(1);
    expect(w[10].minutes).toBeCloseTo(2); // Nov 16 is in the week of Nov 15
    const m = buckets(logs, "month", NOW);
    expect(m[11].minutes).toBeCloseTo(3);
    expect(m[10].minutes).toBeCloseTo(3);
  });
  it("ignores prayers outside the range", () => {
    const b = buckets([log(at(2025, 1, 1), 600)], "day", NOW);
    expect(b.every((x) => x.prayers === 0)).toBe(true);
  });
});

describe("helpers", () => {
  it("picks a nice axis", () => {
    expect(niceScale(0)).toEqual({ top: 4, step: 1 });
    const s = niceScale(37);
    expect(s.top).toBeGreaterThanOrEqual(37);
    expect(s.top % s.step).toBe(0);
  });
  it("formats minutes", () => {
    expect(formatMinutes(0)).toBe("0 min");
    expect(formatMinutes(0.4)).toBe("<1 min");
    expect(formatMinutes(25)).toBe("25 min");
    expect(formatMinutes(90)).toBe("1 h 30 min");
    expect(formatMinutes(120)).toBe("2 h");
  });
});
