import { useEffect, useState } from "preact/hooks";
import type { Go, Tab } from "../App";
import {
  addUpdate,
  deletePoint,
  deleteUpdate,
  getPoint,
  listCategories,
  listUpdates,
  markAnswered,
  markPrayed,
  reopenPoint,
  savePoint,
} from "../lib/db";
import { currentItem } from "../lib/items";
import { cadenceLabel, dateLabel, lastPrayedLabel, PRIORITY_LABELS } from "../lib/format";
import type { Category, Point, PointUpdate } from "../lib/types";

const DAY = 86_400_000;

export function PointDetail({ id, back, go, from }: { id: string; back: () => void; go: Go; from: Tab }) {
  const [point, setPoint] = useState<Point>();
  const [updates, setUpdates] = useState<PointUpdate[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [note, setNote] = useState("");

  async function load() {
    setPoint(await getPoint(id));
    setUpdates(await listUpdates(id));
  }
  useEffect(() => {
    load();
    listCategories().then(setCats);
  }, [id]);

  if (!point) return <p class="muted">Loading…</p>;

  const now = Date.now();
  const urgent = !!point.urgentUntil && point.urgentUntil > now;
  const snoozed = !!point.snoozedUntil && point.snoozedUntil > now;
  const cat = cats.find((c) => c.id === point.categoryId);
  const item = currentItem(point);

  async function patch(changes: Partial<Point>) {
    await savePoint({ ...point!, ...changes });
    await load();
  }

  async function saveNote() {
    if (!note.trim()) return;
    await addUpdate(id, note.trim());
    setNote("");
    await load();
  }

  async function remove() {
    if (!confirm("Delete this point and all its updates? This cannot be undone.")) return;
    await deletePoint(id);
    back();
  }

  return (
    <section class="stack">
      <button class="link" onClick={back}>← Back</button>
      <div class="card">
        <div class="chips">
          {point.daily && <span class="chip">Daily</span>}
          {cat && <span class="chip">{cat.name}</span>}
          {!point.daily && <span class="chip">{PRIORITY_LABELS[point.priority]} priority</span>}
          {point.status !== "active" && <span class="chip">{point.status}</span>}
          {urgent && <span class="chip urgent">Urgent until {dateLabel(point.urgentUntil!)}</span>}
          {snoozed && <span class="chip">Snoozed until {dateLabel(point.snoozedUntil!)}</span>}
        </div>
        <h1 class="point-title">{point.title}</h1>
        {point.details && <p class="details">{point.details}</p>}
        {item && (
          <div class="item-box">
            <div class="small muted">Next item · {item.index + 1} of {item.total}</div>
            <p class="item-text">{item.text}</p>
          </div>
        )}
        <p class="small muted">
          {lastPrayedLabel(point.lastPrayedAt)} · {point.daily ? "every day" : `goal: ${cadenceLabel(point.cadenceDays).toLowerCase()}`}
          {point.answeredAt ? ` · answered ${dateLabel(point.answeredAt)}` : ""}
        </p>
        <div class="row wrap">
          {point.status === "active" && (
            <button class="primary" onClick={async () => { await markPrayed(id); await load(); }}>Prayed now ✓</button>
          )}
          <button onClick={() => go({ page: "form", id, from })}>Edit</button>
        </div>
      </div>

      {item && (
        <div class="card stack">
          <h2>List</h2>
          <p class="small muted">Each time you pray, the next item shows. Tap an item to make it the next one.</p>
          <ul class="list">
            {point.items!.map((t, i) => (
              <li key={i}>
                <button class={i === item.index ? "list-item current" : "list-item"} onClick={() => patch({ itemIndex: i })}>
                  {i + 1}. {t}{i === item.index ? "  ← next" : ""}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div class="card stack">
        <h2>Updates</h2>
        <textarea rows={2} placeholder="Add an update" value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
        <button onClick={saveNote}>Add update</button>
        {updates.length === 0 && <p class="muted small">No updates yet.</p>}
        {updates.map((u) => (
          <div key={u.id} class="update">
            <div class="small muted row between">
              <span>{dateLabel(u.createdAt)}</span>
              <button class="link small" onClick={async () => { if (confirm("Remove this update?")) { await deleteUpdate(u.id); await load(); } }}>Remove</button>
            </div>
            <p>{u.text}</p>
          </div>
        ))}
      </div>

      <div class="card stack">
        <h2>Actions</h2>
        {point.status === "active" ? (
          <>
            <div class="row wrap">
              {urgent ? (
                <button onClick={() => patch({ urgentUntil: undefined })}>Clear urgent</button>
              ) : (
                <button onClick={() => patch({ urgentUntil: now + 7 * DAY })}>Urgent for 7 days</button>
              )}
              {snoozed ? (
                <button onClick={() => patch({ snoozedUntil: undefined })}>Wake up now</button>
              ) : (
                <>
                  <button onClick={() => patch({ snoozedUntil: now + 7 * DAY })}>Snooze 1 week</button>
                  <button onClick={() => patch({ snoozedUntil: now + 30 * DAY })}>Snooze 1 month</button>
                </>
              )}
            </div>
            <div class="row wrap">
              <button onClick={async () => { await markAnswered(id); await load(); }}>Mark answered</button>
              <button onClick={() => patch({ status: "archived" })}>Archive</button>
            </div>
          </>
        ) : (
          <button onClick={async () => { await reopenPoint(id); await load(); }}>Reopen (make active)</button>
        )}
        <button class="danger" onClick={remove}>Delete</button>
      </div>
    </section>
  );
}
