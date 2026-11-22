// Data types. All times are milliseconds since 1970 (Date.now()).
// Every record has an id and updatedAt, so sync can be added later.

export type Priority = 1 | 2 | 3;
export type Theme = "system" | "light" | "dark";
export type PointStatus = "active" | "answered" | "archived";

export interface Point {
  id: string;
  title: string;
  details?: string;
  categoryId?: string;
  priority: Priority;
  cadenceDays: number; // target gap between prayers
  status: PointStatus;
  createdAt: number;
  updatedAt: number;
  lastPrayedAt?: number; // empty until the first prayer (a new point is due at once)
  snoozedUntil?: number;
  urgentUntil?: number;
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
  sessionSize: number;
  neglectSlots: number;
  maxGapDays: number; // hard ceiling: older points are forced into the session
  priorityWeights: Record<Priority, number>;
  urgencyBoost: number;
  ratioCap: number; // limits how large one point's ratio can grow
  theme: Theme;
}

export const DEFAULT_SETTINGS: Settings = {
  sessionSize: 8,
  neglectSlots: 2,
  maxGapDays: 60,
  priorityWeights: { 1: 0.6, 2: 1, 3: 1.6 },
  urgencyBoost: 3,
  ratioCap: 10,
  theme: "system",
};
