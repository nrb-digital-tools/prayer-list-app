import { describe, expect, it } from "vitest";
import { currentItem, parseItems, reindex } from "./items";
import type { Point } from "./types";

const base: Point = {
  id: "a",
  title: "Communities",
  cadenceDays: 7,
  status: "active",
  createdAt: 0,
  updatedAt: 0,
};

describe("parseItems", () => {
  it("splits lines, trims, and drops blanks", () => {
    expect(parseItems("A\n  B  \r\n\n C\n")).toEqual(["A", "B", "C"]);
  });
  it("returns an empty list for empty text", () => {
    expect(parseItems("  \n \n")).toEqual([]);
  });
});

describe("currentItem", () => {
  it("is undefined for a point without a list", () => {
    expect(currentItem(base)).toBeUndefined();
    expect(currentItem({ ...base, items: [] })).toBeUndefined();
  });
  it("starts at the first item", () => {
    expect(currentItem({ ...base, items: ["A", "B"] })).toEqual({ text: "A", index: 0, total: 2 });
  });
  it("wraps an out-of-range index", () => {
    expect(currentItem({ ...base, items: ["A", "B"], itemIndex: 5 })?.text).toBe("B");
  });
});

describe("reindex", () => {
  const p = { ...base, items: ["A", "B", "C"], itemIndex: 1 };
  it("keeps pointing at the same item when it moves", () => {
    expect(reindex(p, ["X", "A", "B", "C"])).toBe(2);
  });
  it("clamps when the current item was removed", () => {
    expect(reindex(p, ["A"])).toBe(0);
  });
  it("starts at 0 for a new list", () => {
    expect(reindex(undefined, ["A", "B"])).toBe(0);
  });
});
