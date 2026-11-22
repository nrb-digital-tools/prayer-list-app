import { useState } from "preact/hooks";
import { isUrgent } from "../lib/scoring";
import { DEFAULT_URGENT_DAYS, NOT_URGENT, URGENT_PRESETS, urgentFields, urgentLabel, type UrgentChoice } from "../lib/urgent";
import type { Point } from "../lib/types";

// The "Urgent" button and its panel. Used on the Today card and on the point page.
// Closed: one button. Open: choose how long (7 days is picked first), then "Set urgent".
// When the point is already urgent, the panel can change the time or remove urgent.
export function UrgentControl({ point, save }: { point: Point; save: (changes: Partial<Point>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [choice, setChoice] = useState<UrgentChoice | "other">(DEFAULT_URGENT_DAYS);
  const [otherDays, setOtherDays] = useState("10");
  const now = Date.now();
  const urgent = isUrgent(point, now);

  function openPanel() {
    setChoice(point.urgentNoEnd ? "noEnd" : DEFAULT_URGENT_DAYS);
    setOpen(true);
  }

  async function apply() {
    const days = Number(otherDays);
    if (choice === "other" && !(Number.isFinite(days) && days >= 1)) return;
    await save(urgentFields(choice === "other" ? days : choice, Date.now()));
    setOpen(false);
  }

  async function remove() {
    await save(NOT_URGENT);
    setOpen(false);
  }

  if (!open) {
    return (
      <button class={urgent ? "urgent-btn on" : "urgent-btn"} onClick={openPanel}>
        {urgent ? "Urgent ✓" : "Urgent"}
      </button>
    );
  }

  return (
    <div class="urgent-panel stack">
      <div class="small muted">{urgent ? `${urgentLabel(point, now)}. Change it:` : "Make this point urgent. For how long?"}</div>
      <div class="row wrap">
        {URGENT_PRESETS.map((p) => (
          <button key={String(p.choice)} class={choice === p.choice ? "pick on" : "pick"} onClick={() => setChoice(p.choice)}>
            {p.label}
          </button>
        ))}
        <button class={choice === "other" ? "pick on" : "pick"} onClick={() => setChoice("other")}>Other…</button>
      </div>
      {choice === "other" && (
        <label>
          Number of days
          <input type="number" min={1} value={otherDays} onInput={(e) => setOtherDays((e.target as HTMLInputElement).value)} />
        </label>
      )}
      <div class="row wrap">
        <button class="primary" onClick={apply}>{urgent ? "Save" : "Set urgent"}</button>
        {urgent && <button class="danger" onClick={remove}>Remove urgent</button>}
        <button onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
