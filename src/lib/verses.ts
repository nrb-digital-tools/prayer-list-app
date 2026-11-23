// Daily verse on the Today screen. One verse per local calendar day, in this order, then it starts again.
// To add a verse: add a line to the list.
import { dayIndex } from "./stats";

export interface Verse {
  ref: string;
  text: string;
}

// ESV text. (Philippians 4:6 starts with a small "d" in the ESV, because it continues verse 5.)
export const VERSES: Verse[] = [
  { ref: "John 16:24", text: "Until now you have asked nothing in my name. Ask, and you will receive, that your joy may be full." },
  { ref: "John 15:7", text: "If you abide in me, and my words abide in you, ask whatever you wish, and it will be done for you." },
  { ref: "Romans 12:12", text: "Rejoice in hope, be patient in tribulation, be constant in prayer." },
  {
    ref: "Philippians 4:6",
    text: "Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.",
  },
];

export const ESV_NOTICE =
  "Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.";

export function verseForDay(now: number): Verse {
  const n = VERSES.length;
  return VERSES[((dayIndex(now) % n) + n) % n];
}
