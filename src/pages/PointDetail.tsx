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
  setUpdateAnswered,
} from "../lib/db";
import { currentItem } from "../lib/items";
import { cadenceLabel, dateLabel, lastPrayedLabel } from "../lib/format";
import { urgentLabel } from "../lib/urgent";
import { UrgentControl } from "../components/UrgentControl";
import { UpdateEntry } from "../components/UpdateEntry";
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
  const urgent = urgentLabel(point, now);
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

  // Open updates show on the card. Answered updates are kept here, newest answer first.
  const openUpdates = updates.filter((u) => !u.answeredAt);
  const answeredUpdates = updates.filter((u) => u.answeredAt).sort((a, b) => b.answeredAt! - a.answeredAt!);
  const entry = (u: PointUpdate) => (
    <UpdateEntry
      key={u.id}
      update={u}
      onAnswered={async () => { await setUpdateAnswered(u.id, Date.now()); await load(); }}
      onReopen={async () => { await setUpdateAnswered(u.id, undefined); await load(); }}
      onDelete={async () => { await deleteUpdate(u.id); await load(); }}
    />
  );

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
          {point.status !== "active" && <span class="chip">{point.status}</span>}
          {urgent && <span class="chip urgent">{urgent}</span>}
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
        {openUpdates.length === 0 && <p class="muted small">No open updates.</p>}
        {openUpdates.map((u) => entry(u))}
        {answeredUpdates.length > 0 && (
          <>
            <h3>Answered ({answeredUpdates.length})</h3>
            {answeredUpdates.map((u) => entry(u))}
          </>
        )}
      </div>

      <div class="card stack">
        <h2>Actions</h2>
        {point.status === "active" ? (
          <>
            <div class="row wrap">
              <UrgentControl point={point} save={patch} />
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
