// Data types. All times are milliseconds since 1970 (Date.now()).
// Every record has an id and updatedAt, so sync can be added later.

export type Theme = "system" | "light" | "dark";
export type PointStatus = "active" | "answered" | "archived";

export interface Point {
  id: string;
  title: string;
  details?: string;
  categoryId?: string;
  priority?: number; // old data only: priority was removed. Ignored.
  cadenceDays: number; // target gap between prayers
  status: PointStatus;
  createdAt: number;
  updatedAt: number;
  lastPrayedAt?: number; // empty until the first prayer (a new point is due at once)
  snoozedUntil?: number; // old data only: snooze was removed. Ignored.
  urgentUntil?: number; // urgent until this time
  urgentNoEnd?: boolean; // urgent until the user removes it
  answeredAt?: number;
  daily?: boolean; // guaranteed daily: shows every day and is not part of the rotation
  items?: string[]; // optional list: each time the point comes up, the next item shows
  itemIndex?: number; // which item shows next (0-based)
}

export interface PointUpdate {
  id: string;
  pointId: string;
  text: string;
  createdAt: number;
  updatedAt: number;
  answeredAt?: number; // set when marked answered: it leaves the card but is kept
}

export interface Category {
  id: string;
  name: string;
  updatedAt: number;
}

export interface PrayerLog {
  id: string;
  pointId: string;
  prayedAt: number;
  item?: string; // the list item prayed for, if the point has a list
  seconds?: number; // time spent on the card (counted while the app is open)
  updatedAt: number;
}

export interface Settings {
  targetMinutes: number; // daily prayer time target. Today ends its list when this is reached.
  neglectSlots: number; // wild cards: due points prayed longest ago, right after the daily points
  maxGapDays: number; // hard ceiling: older points are forced into the session
  urgencyBoost: number;
  ratioCap: number; // limits how large one point's ratio can grow
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  targetMinutes: 30,
  neglectSlots: 2,
  maxGapDays: 60,
  urgencyBoost: 3,
  ratioCap: 10,
  theme: "system",
};
