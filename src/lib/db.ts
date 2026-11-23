import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import {
  DEFAULT_SETTINGS,
  type Category,
  type Point,
  type PointUpdate,
  type PrayerLog,
  type Settings,
} from "./types";
import { currentItem } from "./items";

interface PrayerDB extends DBSchema {
  points: { key: string; value: Point; indexes: { "by-status": string } };
  updates: { key: string; value: PointUpdate; indexes: { "by-point": string } };
  categories: { key: string; value: Category };
  logs: { key: string; value: PrayerLog; indexes: { "by-point": string } };
  meta: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<PrayerDB>> | undefined;

export function getDB() {
  dbPromise ??= openDB<PrayerDB>("prayer-app", 1, {
    upgrade(db) {
      const points = db.createObjectStore("points", { keyPath: "id" });
      points.createIndex("by-status", "status");
      const updates = db.createObjectStore("updates", { keyPath: "id" });
      updates.createIndex("by-point", "pointId");
      db.createObjectStore("categories", { keyPath: "id" });
      const logs = db.createObjectStore("logs", { keyPath: "id" });
      logs.createIndex("by-point", "pointId");
      db.createObjectStore("meta");
    },
  });
  return dbPromise;
}

export const newId = () => crypto.randomUUID();

// ---- Points ----
export async function listPoints(): Promise<Point[]> {
  return (await getDB()).getAll("points");
}

export async function getPoint(id: string): Promise<Point | undefined> {
  return (await getDB()).get("points", id);
}

export async function createPoint(
  input: Pick<Point, "title" | "cadenceDays"> & Partial<Point>,
): Promise<Point> {
  const now = Date.now();
  const point: Point = {
    status: "active",
    ...input,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
  await (await getDB()).put("points", point);
  return point;
}

export async function savePoint(point: Point): Promise<void> {
  await (await getDB()).put("points", { ...point, updatedAt: Date.now() });
}

export async function deletePoint(id: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["points", "updates", "logs"], "readwrite");
  await tx.objectStore("points").delete(id);
  for (const u of await tx.objectStore("updates").index("by-point").getAllKeys(id)) {
    await tx.objectStore("updates").delete(u);
  }
  for (const l of await tx.objectStore("logs").index("by-point").getAllKeys(id)) {
    await tx.objectStore("logs").delete(l);
  }
  await tx.done;
}

// Mark a point as prayed. This resets its score to 0.
export async function markPrayed(id: string, at = Date.now(), seconds?: number): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["points", "logs"], "readwrite");
  const p = await tx.objectStore("points").get(id);
  if (p) {
    // A list point moves on to its next item (and wraps to the first after the last).
    const cur = currentItem(p);
    const next = cur ? { itemIndex: (cur.index + 1) % cur.total } : {};
    await tx.objectStore("points").put({ ...p, ...next, lastPrayedAt: at, updatedAt: at });
    await tx.objectStore("logs").put({ id: newId(), pointId: id, prayedAt: at, item: cur?.text, seconds, updatedAt: at });
  }
  await tx.done;
}

export async function listLogs(): Promise<PrayerLog[]> {
  return (await getDB()).getAll("logs");
}

export async function markAnswered(id: string): Promise<void> {
  const p = await getPoint(id);
  if (p) await savePoint({ ...p, status: "answered", answeredAt: Date.now() });
}

export async function reopenPoint(id: string): Promise<void> {
  const p = await getPoint(id);
  if (!p) return;
  const { answeredAt: _drop, ...rest } = p;
  await savePoint({ ...rest, status: "active", lastPrayedAt: Date.now() });
}

// ---- Updates (dated notes on one point) ----
export async function listUpdates(pointId: string): Promise<PointUpdate[]> {
  const all = await (await getDB()).getAllFromIndex("updates", "by-point", pointId);
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export async function addUpdate(pointId: string, text: string): Promise<PointUpdate> {
  const now = Date.now();
  const u: PointUpdate = { id: newId(), pointId, text, createdAt: now, updatedAt: now };
  await (await getDB()).put("updates", u);
  return u;
}

export async function deleteUpdate(id: string): Promise<void> {
  await (await getDB()).delete("updates", id);
}

// Mark an update answered (at = time), or not answered again (at = undefined).
export async function setUpdateAnswered(id: string, at: number | undefined): Promise<void> {
  const db = await getDB();
  const u = await db.get("updates", id);
  if (u) await db.put("updates", { ...u, answeredAt: at, updatedAt: Date.now() });
}

// Every answered update, newest answer first.
export async function listAnsweredUpdates(): Promise<PointUpdate[]> {
  const all = await (await getDB()).getAll("updates");
  return all.filter((u) => u.answeredAt).sort((a, b) => b.answeredAt! - a.answeredAt!);
}

// ---- Categories ----
export async function listCategories(): Promise<Category[]> {
  const all = await (await getDB()).getAll("categories");
  return all.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addCategory(name: string): Promise<Category> {
  const c: Category = { id: newId(), name, updatedAt: Date.now() };
  await (await getDB()).put("categories", c);
  return c;
}

export async function deleteCategory(id: string): Promise<void> {
  const db = await getDB();
  await db.delete("categories", id);
  for (const p of await db.getAll("points")) {
    if (p.categoryId === id) await savePoint({ ...p, categoryId: undefined });
  }
}

// ---- Settings and session snapshot (in the "meta" store) ----
export async function getSettings(): Promise<Settings> {
  const saved = (await (await getDB()).get("meta", "settings")) as Partial<Settings> | undefined;
  // Drop settings from older versions (priority weights and points per day were removed).
  const { priorityWeights: _old, sessionSize: _old2, ...rest } = (saved ?? {}) as Partial<Settings> & {
    priorityWeights?: unknown;
    sessionSize?: unknown;
  };
  return { ...DEFAULT_SETTINGS, ...rest };
}

export async function saveSettings(s: Settings): Promise<void> {
  await (await getDB()).put("meta", s, "settings");
}

// One card shown on the Today screen, and what you did with it.
export interface SessionCard {
  id: string; // point id (the same point can show more than once a day)
  result?: "prayed" | "later"; // empty while the card is on screen
}

// Today's cards. Saved so the app can close and reopen without losing its place.
export interface SessionSnapshot {
  version: 2;
  startedAt: number;
  cards: SessionCard[]; // in order: daily, wild cards, hard limit, then one at a time
  roundStart: number; // index in cards where the current round started
  keepGoing?: boolean; // "Keep praying" after the time target was reached
  // Prayer timer (Start / Pause). It uses the clock, so it keeps counting when the phone locks or the app closes.
  timerSince?: number; // running since this time; empty when paused
  cardMs?: number; // time already counted for the card on screen (from earlier runs)
}

// Returns undefined for a session saved by an older version (it is rebuilt).
export async function getSession(): Promise<SessionSnapshot | undefined> {
  const s = (await (await getDB()).get("meta", "session")) as SessionSnapshot | undefined;
  return s && s.version === 2 && Array.isArray(s.cards) ? s : undefined;
}

export async function saveSession(s: SessionSnapshot | undefined): Promise<void> {
  const db = await getDB();
  if (s) await db.put("meta", s, "session");
  else await db.delete("meta", "session");
}
