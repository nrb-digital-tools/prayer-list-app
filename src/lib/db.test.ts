import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  addUpdate,
  createPoint,
  deletePoint,
  getPoint,
  listPoints,
  listUpdates,
  markAnswered,
  markPrayed,
  reopenPoint,
} from "./db";
import { currentItem } from "./items";
import { exportBackup, importBackup, validateBackup } from "./backup";

describe("list points", () => {
  it("shows the next item each time it is prayed, then wraps", async () => {
    const p = await createPoint({ title: "Communities", priority: 2, cadenceDays: 7, items: ["A", "B", "C"], itemIndex: 0 });
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
    const p = await createPoint({ title: "Plain", priority: 2, cadenceDays: 7 });
    await markPrayed(p.id);
    expect((await getPoint(p.id))!.itemIndex).toBeUndefined();
  });
});

describe("db", () => {
  it("creates a point, prays for it, and keeps updates", async () => {
    const p = await createPoint({ title: "Missionary A", priority: 3, cadenceDays: 7 });
    await addUpdate(p.id, "Arrived on the field");
    await addUpdate(p.id, "Visa approved");
    await markPrayed(p.id, p.createdAt + 5000);
    expect((await getPoint(p.id))!.lastPrayedAt).toBe(p.createdAt + 5000);
    expect(await listUpdates(p.id)).toHaveLength(2);
  });

  it("answers and reopens a point", async () => {
    const p = await createPoint({ title: "Healing", priority: 2, cadenceDays: 3 });
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
    const extra = await createPoint({ title: "Temp", priority: 1, cadenceDays: 30 });
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
