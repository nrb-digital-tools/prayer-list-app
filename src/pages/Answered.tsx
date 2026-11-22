import { useEffect, useState } from "preact/hooks";
import type { Go } from "../App";
import { listAnsweredUpdates, listPoints } from "../lib/db";
import { dateLabel } from "../lib/format";
import type { Point, PointUpdate } from "../lib/types";

// Answered points, and answered updates (an update marked "Answered" on a card or point page).
export function Answered({ go }: { go: Go }) {
  const [points, setPoints] = useState<Point[]>([]);
  const [titles, setTitles] = useState<Map<string, string>>(new Map());
  const [updates, setUpdates] = useState<PointUpdate[]>([]);
  useEffect(() => {
    listPoints().then((all) => {
      setTitles(new Map(all.map((p) => [p.id, p.title])));
      setPoints(all.filter((p) => p.status === "answered").sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0)));
    });
    listAnsweredUpdates().then(setUpdates);
  }, []);

  const empty = points.length === 0 && updates.length === 0;
  return (
    <section>
      <h1>Answered prayers</h1>
      {empty && (
        <p class="muted">
          Nothing answered yet. When God answers one, mark the point answered on its page, or tap Remove on an update and choose Answered.
        </p>
      )}
      {points.length > 0 && (
        <>
          <h2>Points</h2>
          <ul class="list">
            {points.map((p) => (
              <li key={p.id}>
                <button class="list-item" onClick={() => go({ page: "detail", id: p.id, from: "answered" })}>
                  <span class="list-title">{p.title}</span>
                  <span class="small muted">Answered {p.answeredAt ? dateLabel(p.answeredAt) : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {updates.length > 0 && (
        <>
          <h2>Updates</h2>
          <ul class="list">
            {updates.map((u) => (
              <li key={u.id}>
                <button class="list-item" onClick={() => go({ page: "detail", id: u.pointId, from: "answered" })}>
                  <span class="list-title">{u.text}</span>
                  <span class="small muted">
                    {titles.get(u.pointId) ?? ""} · answered {dateLabel(u.answeredAt!)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
