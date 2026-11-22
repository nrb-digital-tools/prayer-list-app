import { useEffect, useState } from "preact/hooks";
import type { Go } from "../App";
import { listPoints } from "../lib/db";
import { dateLabel } from "../lib/format";
import type { Point } from "../lib/types";

export function Answered({ go }: { go: Go }) {
  const [points, setPoints] = useState<Point[]>([]);
  useEffect(() => {
    listPoints().then((all) =>
      setPoints(all.filter((p) => p.status === "answered").sort((a, b) => (b.answeredAt ?? 0) - (a.answeredAt ?? 0))),
    );
  }, []);

  return (
    <section>
      <h1>Answered prayers</h1>
      {points.length === 0 && <p class="muted">Nothing answered yet. When God answers one, mark it from the point page.</p>}
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
    </section>
  );
}
