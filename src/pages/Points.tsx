import { useEffect, useState } from "preact/hooks";
import type { Go } from "../App";
import { listCategories, listPoints } from "../lib/db";
import { cadenceLabel, lastPrayedLabel } from "../lib/format";
import { isUrgent, lastPrayed } from "../lib/scoring";
import { currentItem } from "../lib/items";
import type { Category, Point } from "../lib/types";

export function Points({ go }: { go: Go }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    listPoints().then(setPoints);
    listCategories().then(setCats);
  }, []);

  const needle = q.trim().toLowerCase();
  const shown = points
    .filter((p) => (showArchived ? p.status === "archived" : p.status === "active"))
    .filter((p) => !cat || p.categoryId === cat)
    .filter((p) => !needle || `${p.title} ${p.details ?? ""}`.toLowerCase().includes(needle))
    .sort((a, b) => lastPrayed(a) - lastPrayed(b));

  return (
    <section>
      <div class="row between">
        <h1>Points</h1>
        <button class="primary" onClick={() => go({ page: "form", from: "points" })}>+ Add</button>
      </div>
      <input type="search" placeholder="Search" value={q} onInput={(e) => setQ((e.target as HTMLInputElement).value)} />
      <div class="row wrap">
        <select value={cat} onChange={(e) => setCat((e.target as HTMLSelectElement).value)}>
          <option value="">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label class="check">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived((e.target as HTMLInputElement).checked)} />
          Archived
        </label>
      </div>
      {shown.length === 0 && <p class="muted">No points here.</p>}
      <ul class="list">
        {shown.map((p) => (
          <li key={p.id}>
            <button class="list-item" onClick={() => go({ page: "detail", id: p.id, from: "points" })}>
              <span class="list-title">{p.title}</span>
              <span class="small muted">
                {lastPrayedLabel(p.lastPrayedAt)} · {p.daily ? "every day" : cadenceLabel(p.cadenceDays).toLowerCase()}
                {currentItem(p) ? ` · list ${currentItem(p)!.index + 1}/${currentItem(p)!.total}` : ""}
                {isUrgent(p, Date.now()) ? " · urgent" : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p class="muted small">Sorted by longest since prayed.</p>
    </section>
  );
}
