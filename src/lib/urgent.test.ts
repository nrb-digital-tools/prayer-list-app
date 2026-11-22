import { describe, expect, it } from "vitest";
import { isUrgent } from "./scoring";
import { NOT_URGENT, urgentFields, urgentLabel } from "./urgent";
import type { Point } from "./types";

const DAY = 86_400_000;
const NOW = 1_800_000_000_000;
const base: Point = { id: "p", title: "P", cadenceDays: 7, status: "active", createdAt: NOW, updatedAt: NOW };

describe("urgent", () => {
  it("lasts the chosen number of days, then ends by itself", () => {
    const p = { ...base, ...urgentFields(7, NOW) };
    expect(isUrgent(p, NOW + 6 * DAY)).toBe(true);
    expect(isUrgent(p, NOW + 7 * DAY + 1)).toBe(false);
  });
  it("with no end date, stays until removed", () => {
    const p = { ...base, ...urgentFields("noEnd", NOW) };
    expect(isUrgent(p, NOW + 5000 * DAY)).toBe(true);
    expect(urgentLabel(p, NOW)).toBe("Urgent until you remove it");
    expect(isUrgent({ ...p, ...NOT_URGENT }, NOW)).toBe(false);
  });
  it("changing from no end to a number of days sets an end again", () => {
    const p = { ...base, ...urgentFields("noEnd", NOW) };
    const q = { ...p, ...urgentFields(3, NOW) };
    expect(q.urgentNoEnd).toBeUndefined();
    expect(isUrgent(q, NOW + 4 * DAY)).toBe(false);
  });
  it("rounds odd day counts and never goes below 1 day", () => {
    expect(urgentFields(0, NOW).urgentUntil).toBe(NOW + DAY);
    expect(urgentFields(2.4, NOW).urgentUntil).toBe(NOW + 2 * DAY);
  });
  it("has an empty label when not urgent", () => {
    expect(urgentLabel(base, NOW)).toBe("");
  });
});
