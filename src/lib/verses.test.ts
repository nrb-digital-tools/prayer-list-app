import { describe, expect, it } from "vitest";
import { VERSES, verseForDay } from "./verses";

const DAY = 86_400_000;
const morning = new Date(2026, 10, 23, 7, 0).getTime();

describe("daily verse", () => {
  it("is the same all day", () => {
    const night = new Date(2026, 10, 23, 23, 30).getTime();
    expect(verseForDay(night)).toBe(verseForDay(morning));
  });
  it("moves to the next verse the next day, and wraps after the last one", () => {
    const i = VERSES.indexOf(verseForDay(morning));
    for (let d = 1; d <= VERSES.length; d++) {
      expect(verseForDay(morning + d * DAY)).toBe(VERSES[(i + d) % VERSES.length]);
    }
  });
  it("has the four starting verses, each with text", () => {
    expect(VERSES.map((v) => v.ref)).toEqual(["John 16:24", "John 15:7", "Romans 12:12", "Philippians 4:6"]);
    expect(VERSES.every((v) => v.text.length > 20)).toBe(true);
  });
});
