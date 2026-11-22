import { describe, expect, it } from "vitest";
import { buildSession, nextExtra, rawRatio, score } from "./scoring";
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
    priority: 2,
    cadenceDays: 7,
    status: "active",
    createdAt: NOW - 1000 * DAY,
    updatedAt: NOW,
    lastPrayedAt: NOW - daysAgo * DAY,
    ...rest,
  };
}

const S: Settings = { ...DEFAULT_SETTINGS, sessionSize: 4, neglectSlots: 1 };

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
    expect(score(p, NOW, S)).toBe(S.ratioCap * S.priorityWeights[2]);
  });
  it("adds the urgency boost only until it expires", () => {
    const p = pt({ daysAgo: 0, urgentUntil: NOW + DAY });
    expect(score(p, NOW, S)).toBe(S.urgencyBoost);
    expect(score(p, NOW + 2 * DAY, S)).toBeLessThan(S.urgencyBoost);
  });
});

describe("never-prayed points", () => {
  it("is due right away (ratio 1.0)", () => {
    const p = pt({ id: "new", cadenceDays: 7, createdAt: NOW, lastPrayedAt: undefined });
    expect(rawRatio(p, NOW)).toBeCloseTo(1);
  });
  it("beats a point that was just prayed for, even in a full queue", () => {
    const fresh = [1, 2, 3].map((i) => pt({ id: `f${i}`, daysAgo: 0 }));
    const brandNew = pt({ id: "new", createdAt: NOW, lastPrayedAt: undefined });
    const ids = buildSession([...fresh, brandNew], { ...S, sessionSize: 1, neglectSlots: 0 }, NOW);
    expect(ids).toEqual(["new"]);
  });
});

describe("buildSession", () => {
  it("picks the most overdue points by score", () => {
    const a = pt({ id: "a", daysAgo: 14 });
    const b = pt({ id: "b", daysAgo: 1 });
    const c = pt({ id: "c", daysAgo: 10 });
    const ids = buildSession([a, b, c], { ...S, sessionSize: 2, neglectSlots: 0 }, NOW);
    expect(ids).toEqual(["a", "c"]);
  });

  it("uses a neglect slot for a low-priority point", () => {
    const high = [1, 2, 3].map((i) => pt({ id: `h${i}`, priority: 3, daysAgo: 20 }));
    const low = pt({ id: "low", priority: 1, daysAgo: 30 });
    const ids = buildSession([...high, low], { ...S, sessionSize: 4, neglectSlots: 1 }, NOW);
    expect(ids).toContain("low");
  });

  it("neglect slot ignores priority and uses the ratio, not raw age", () => {
    // yearly point prayed 100 days ago is not due. Weekly point 20 days ago is very overdue.
    const yearly = pt({ id: "yearly", cadenceDays: 365, daysAgo: 100 });
    const weekly = pt({ id: "weekly", priority: 1, daysAgo: 20 });
    const ids = buildSession(
      [yearly, weekly],
      { ...S, sessionSize: 1, neglectSlots: 1, maxGapDays: 1000 },
      NOW,
    );
    expect(ids).toEqual(["weekly"]);
  });

  it("forces a point past the hard ceiling into the session", () => {
    const old = pt({ id: "old", priority: 1, cadenceDays: 365, daysAgo: 61 });
    const busy = [1, 2, 3, 4].map((i) => pt({ id: `b${i}`, priority: 3, cadenceDays: 1, daysAgo: 5 }));
    const ids = buildSession([...busy, old], { ...S, neglectSlots: 0 }, NOW);
    expect(ids[0]).toBe("old");
  });

  it("never exceeds the session size, even with many forced points", () => {
    const many = Array.from({ length: 10 }, (_, i) => pt({ id: `f${i}`, daysAgo: 100 + i }));
    const ids = buildSession(many, S, NOW);
    expect(ids).toHaveLength(S.sessionSize);
    expect(ids[0]).toBe("f9"); // oldest first
  });

  it("skips answered, archived and snoozed points", () => {
    const pts = [
      pt({ id: "ans", status: "answered", daysAgo: 99 }),
      pt({ id: "arc", status: "archived", daysAgo: 99 }),
      pt({ id: "snz", daysAgo: 99, snoozedUntil: NOW + DAY }),
      pt({ id: "ok", daysAgo: 8 }),
    ];
    expect(buildSession(pts, S, NOW)).toEqual(["ok"]);
  });

  it("includes a point again once its snooze ends", () => {
    const p = pt({ id: "snz", daysAgo: 99, snoozedUntil: NOW - 1 });
    expect(buildSession([p], S, NOW)).toEqual(["snz"]);
  });

  it("returns fewer cards when there are few points", () => {
    expect(buildSession([pt({ id: "only" })], S, NOW)).toEqual(["only"]);
    expect(buildSession([], S, NOW)).toEqual([]);
  });

  it("breaks ties by oldest, then id (stable order)", () => {
    const a = pt({ id: "b", daysAgo: 7 });
    const b = pt({ id: "a", daysAgo: 7 });
    expect(buildSession([a, b], { ...S, neglectSlots: 0 }, NOW)).toEqual(["a", "b"]);
  });

  it("a skipped point rises in score and returns", () => {
    const p = pt({ id: "later", daysAgo: 3 });
    const other = pt({ id: "other", daysAgo: 6 });
    const one = { ...S, sessionSize: 1, neglectSlots: 0 };
    expect(buildSession([p, other], one, NOW)).toEqual(["other"]);
    // 10 days later nobody prayed for "later" (skipped). It now wins.
    const later = NOW + 10 * DAY;
    const other2 = { ...other, lastPrayedAt: later - 1 * DAY };
    expect(buildSession([p, other2], one, later)).toEqual(["later"]);
  });
});

describe("guaranteed daily points", () => {
  it("come first and do not use up rotation slots", () => {
    const d = pt({ id: "d", daily: true, daysAgo: 1 });
    const rot = [1, 2, 3, 4].map((i) => pt({ id: `r${i}`, daysAgo: 10 + i }));
    const ids = buildSession([...rot, d], { ...S, sessionSize: 4, neglectSlots: 0 }, NOW);
    expect(ids).toHaveLength(5);
    expect(ids[0]).toBe("d");
  });
  it("are left out once prayed today", () => {
    const d = pt({ id: "d", daily: true, lastPrayedAt: NOW - 1000 });
    expect(buildSession([d], S, NOW)).toEqual([]);
  });
  it("come back the next day, whatever their cadence or priority", () => {
    const d = pt({ id: "d", daily: true, priority: 1, cadenceDays: 365, daysAgo: 1 });
    expect(buildSession([d], S, NOW)).toEqual(["d"]);
  });
  it("are never picked by the rotation (even when they are overdue)", () => {
    const d = pt({ id: "d", daily: true, daysAgo: 99 });
    const other = pt({ id: "o", daysAgo: 1 });
    // d appears once, as a daily, and not a second time from the rotation
    expect(buildSession([d, other], S, NOW).filter((x) => x === "d")).toHaveLength(1);
    expect(nextExtra([d, other], S, NOW, [], 0)).toBe("o");
  });
  it("respect snooze and answered status", () => {
    const a = pt({ id: "a", daily: true, snoozedUntil: NOW + DAY });
    const b = pt({ id: "b", daily: true, status: "answered" });
    expect(buildSession([a, b], S, NOW)).toEqual([]);
  });
});

describe("nextExtra (keep praying)", () => {
  it("gives the highest-score point not yet shown", () => {
    const a = pt({ id: "a", daysAgo: 14 });
    const b = pt({ id: "b", daysAgo: 10 });
    const c = pt({ id: "c", daysAgo: 5 });
    expect(nextExtra([a, b, c], S, NOW, [], 0)).toBe("a");
    expect(nextExtra([a, b, c], S, NOW, ["a"], 1)).toBe("b");
    expect(nextExtra([a, b, c], S, NOW, ["a", "b"], 2)).toBe("c");
    expect(nextExtra([a, b, c], S, NOW, ["a", "b", "c"], 3)).toBeUndefined();
  });
  it("makes every 4th extra a neglect pick that ignores priority", () => {
    const high = pt({ id: "high", priority: 3, cadenceDays: 7, daysAgo: 8 }); // score 1.14 x 1.6
    const low = pt({ id: "low", priority: 1, cadenceDays: 7, daysAgo: 20 }); // ratio 2.86 but x 0.6
    expect(nextExtra([high, low], S, NOW, [], 0)).toBe("high"); // normal pick uses weights
    expect(nextExtra([high, low], S, NOW, [], 3)).toBe("low"); // 4th pick: neglect, by ratio
  });
  it("skips snoozed and inactive points", () => {
    const a = pt({ id: "a", daysAgo: 20, snoozedUntil: NOW + DAY });
    expect(nextExtra([a], S, NOW, [], 0)).toBeUndefined();
  });
});
