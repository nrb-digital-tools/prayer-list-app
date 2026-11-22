import { useState } from "preact/hooks";
import { dateLabel } from "../lib/format";
import type { PointUpdate } from "../lib/types";

// One update with its date and a "Remove" button.
// Remove asks: mark it answered (it leaves the card but is kept), or delete it for good.
// For an answered update, the buttons are "Not answered" (back on the card) and "Delete".
export function UpdateEntry({
  update,
  onAnswered,
  onReopen,
  onDelete,
}: {
  update: PointUpdate;
  onAnswered: () => void;
  onReopen: () => void;
  onDelete: () => void;
}) {
  const [asking, setAsking] = useState(false);
  const answered = !!update.answeredAt;

  return (
    <div class={answered ? "latest answered" : "latest"}>
      <div class="small muted row between">
        <span>
          {dateLabel(update.createdAt)}
          {answered ? ` · answered ${dateLabel(update.answeredAt!)}` : ""}
        </span>
        {!asking && (
          <button class="link small" onClick={() => setAsking(true)}>
            {answered ? "Change" : "Remove"}
          </button>
        )}
      </div>
      <p>{update.text}</p>
      {asking && (
        <div class="row wrap remove-choices">
          {answered ? (
            <button onClick={() => { setAsking(false); onReopen(); }}>Not answered</button>
          ) : (
            <button class="primary" onClick={() => { setAsking(false); onAnswered(); }}>Answered 🙏</button>
          )}
          <button class="danger" onClick={() => { setAsking(false); onDelete(); }}>Delete</button>
          <button onClick={() => setAsking(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
