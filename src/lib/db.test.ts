import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  addUpdate,
  createPoint,
  deletePoint,
  deleteUpdate,
  getPoint,
  listPoints,
  listAnsweredUpdates,
  listUpdates,
  setUpdateAnswered,
  markAnswered,
  markPrayed,
  reopenPoint,
} from "./db";
import { currentItem } from "./items";
import { exportBackup, importBackup, validateBackup } from "./backup";

describe("list points", () => {
  it("shows the next item each time it is prayed, then wraps", async () => {
    const p = await createPoint({ title: "Communities", cadenceDays: 7, items: ["A", "B", "C"], itemIndex: 0 });
    const seen: (string | undefined)[] = [];
    for (let i = 0; i < 4; i++) {
      const cur = (await getPoint(p.id))!;
      seen.push(currentItem(cur)?.text);
      await markPrayed(p.id);
    }
    expect(seen).toEqual(["A", "B", "C", "A"]);
    expect(currentItem((await getPoint(p.id))!)?.text).toBe("B");
  });
  it("does not change a point without a list", async () => {
    const p = await createPoint({ title: "Plain", cadenceDays: 7 });
    await markPrayed(p.id);
    expect((await getPoint(p.id))!.itemIndex).toBeUndefined();
  });
});

describe("db", () => {
  it("creates a point, prays for it, and keeps updates", async () => {
    const p = await createPoint({ title: "Missionary A", cadenceDays: 7 });
    await addUpdate(p.id, "Arrived on the field");
    await addUpdate(p.id, "Visa approved");
    await markPrayed(p.id, p.createdAt + 5000);
    expect((await getPoint(p.id))!.lastPrayedAt).toBe(p.createdAt + 5000);
    expect(await listUpdates(p.id)).toHaveLength(2);
  });

  it("keeps every update until one is removed, newest first", async () => {
    const p = await createPoint({ title: "Missionary B", cadenceDays: 7 });
    const a = await addUpdate(p.id, "First");
    await new Promise((r) => setTimeout(r, 2));
    const b = await addUpdate(p.id, "Second");
    await new Promise((r) => setTimeout(r, 2));
    await addUpdate(p.id, "Third");
    await markPrayed(p.id, Date.now());
    await markPrayed(p.id, Date.now() + 1000);
    expect((await listUpdates(p.id)).map((u) => u.text)).toEqual(["Third", "Second", "First"]);
    await deleteUpdate(b.id);
    expect((await listUpdates(p.id)).map((u) => u.text)).toEqual(["Third", "First"]);
    expect((await listUpdates(p.id)).some((u) => u.id === a.id)).toBe(true);
  });

  it("answers and reopens a point", async () => {
    const p = await createPoint({ title: "Healing", cadenceDays: 3 });
    await markAnswered(p.id);
    expect((await getPoint(p.id))!.status).toBe("answered");
    await reopenPoint(p.id);
    const again = (await getPoint(p.id))!;
    expect(again.status).toBe("active");
    expect(again.answeredAt).toBeUndefined();
  });

  it("round-trips a backup", async () => {
    const before = await exportBackup();
    const json = JSON.parse(JSON.stringify(before));
    const extra = await createPoint({ title: "Temp", cadenceDays: 30 });
    await deletePoint(extra.id);
    await importBackup(json);
    const after = await exportBackup();
    expect(after.points).toEqual(before.points);
    expect(after.updates).toHaveLength(before.updates.length);
    expect((await listPoints()).length).toBe(before.points.length);
  });

  it("rejects a file that is not a backup", () => {
    expect(() => validateBackup({ hello: "world" })).toThrow();
  });
});

describe("answered updates", () => {
  it("marks an update answered, lists it, and can undo it", async () => {
    const p = await createPoint({ title: "Answered test", cadenceDays: 7 });
    const a = await addUpdate(p.id, "Open one");
    const b = await addUpdate(p.id, "Answered one");
    await setUpdateAnswered(b.id, 123);
    const all = await listUpdates(p.id);
    expect(all.find((u) => u.id === b.id)!.answeredAt).toBe(123);
    expect(all.find((u) => u.id === a.id)!.answeredAt).toBeUndefined();
    expect((await listAnsweredUpdates()).map((u) => u.id)).toContain(b.id);
    await setUpdateAnswered(b.id, undefined);
    expect((await listAnsweredUpdates()).map((u) => u.id)).not.toContain(b.id);
    expect(await listUpdates(p.id)).toHaveLength(2);
  });
});
