import { getDB, getSettings, saveSettings } from "./db";
import { applyTheme } from "./theme";
import type { Category, Point, PointUpdate, PrayerLog, Settings } from "./types";

export interface BackupFile {
  app: "prayer-app";
  version: 1;
  exportedAt: number;
  points: Point[];
  updates: PointUpdate[];
  categories: Category[];
  logs: PrayerLog[];
  settings: Settings;
}

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDB();
  return {
    app: "prayer-app",
    version: 1,
    exportedAt: Date.now(),
    points: await db.getAll("points"),
    updates: await db.getAll("updates"),
    categories: await db.getAll("categories"),
    logs: await db.getAll("logs"),
    settings: await getSettings(),
  };
}

export function validateBackup(data: unknown): BackupFile {
  const b = data as Partial<BackupFile> | null;
  if (!b || b.app !== "prayer-app" || b.version !== 1) {
    throw new Error("This file is not a Prayer App backup.");
  }
  for (const key of ["points", "updates", "categories", "logs"] as const) {
    if (!Array.isArray(b[key])) throw new Error(`Backup is missing "${key}".`);
  }
  return b as BackupFile;
}

// Replace ALL data with the backup. The caller must ask the user first.
export async function importBackup(data: unknown): Promise<void> {
  const b = validateBackup(data);
  const db = await getDB();
  const tx = db.transaction(["points", "updates", "categories", "logs", "meta"], "readwrite");
  for (const name of ["points", "updates", "categories", "logs"] as const) {
    await tx.objectStore(name).clear();
  }
  await tx.objectStore("meta").delete("session");
  for (const p of b.points) await tx.objectStore("points").put(p);
  for (const u of b.updates) await tx.objectStore("updates").put(u);
  for (const c of b.categories) await tx.objectStore("categories").put(c);
  for (const l of b.logs) await tx.objectStore("logs").put(l);
  await tx.done;
  if (b.settings) {
    await saveSettings(b.settings);
    if (b.settings.theme) applyTheme(b.settings.theme);
  }
}

// Ask the browser not to erase our data (helps on iPhone).
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

// ---- Backup reminders ----
const WEEK = 7 * 86_400_000;

export async function getLastBackupAt(): Promise<number | undefined> {
  return (await (await getDB()).get("meta", "lastBackupAt")) as number | undefined;
}

async function setLastBackupAt(at: number): Promise<void> {
  await (await getDB()).put("meta", at, "lastBackupAt");
}

// True when there is data and no backup was made in the last 7 days.
export async function needsBackup(now = Date.now()): Promise<boolean> {
  const db = await getDB();
  if ((await db.count("points")) === 0) return false;
  const last = await getLastBackupAt();
  return last === undefined || now - last > WEEK;
}

export async function isEmpty(): Promise<boolean> {
  return (await (await getDB()).count("points")) === 0;
}

// Share the backup file (iPhone: choose "Save to Files"). Falls back to a download.
export async function shareBackup(): Promise<"shared" | "downloaded" | "cancelled"> {
  const data = await exportBackup();
  const name = `prayer-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([JSON.stringify(data, null, 2)], name, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      await setLastBackupAt(Date.now());
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
  await setLastBackupAt(Date.now());
  return "downloaded";
}
