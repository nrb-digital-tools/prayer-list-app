import { dateLabel } from "./format";
import { isUrgent } from "./scoring";
import type { Point } from "./types";

const DAY = 86_400_000;

// A number of days, or "noEnd" (urgent until the user removes it).
export type UrgentChoice = number | "noEnd";

export const DEFAULT_URGENT_DAYS = 7;

export const URGENT_PRESETS: { choice: UrgentChoice; label: string }[] = [
  { choice: 3, label: "3 days" },
  { choice: 7, label: "7 days" },
  { choice: 14, label: "2 weeks" },
  { choice: 30, label: "1 month" },
  { choice: "noEnd", label: "Until I remove it" },
];

// The fields to save on a point to make it urgent.
export function urgentFields(choice: UrgentChoice, now: number): Pick<Point, "urgentUntil" | "urgentNoEnd"> {
  if (choice === "noEnd") return { urgentUntil: undefined, urgentNoEnd: true };
  const days = Math.max(1, Math.round(choice));
  return { urgentUntil: now + days * DAY, urgentNoEnd: undefined };
}

export const NOT_URGENT: Pick<Point, "urgentUntil" | "urgentNoEnd"> = { urgentUntil: undefined, urgentNoEnd: undefined };

// "Urgent until Nov 29, 2026", "Urgent until you remove it", or "" when not urgent.
export function urgentLabel(p: Point, now: number): string {
  if (!isUrgent(p, now)) return "";
  return p.urgentNoEnd ? "Urgent until you remove it" : `Urgent until ${dateLabel(p.urgentUntil!)}`;
}
