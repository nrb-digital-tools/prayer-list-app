import { useEffect, useState } from "preact/hooks";
import { BarChart } from "../components/BarChart";
import { listLogs } from "../lib/db";
import { buckets, formatMinutes, RANGE_COUNT, streaks, totalMinutes, type Range } from "../lib/stats";
import type { PrayerLog } from "../lib/types";

const UNIT: Record<Range, string> = { day: "day", week: "week", month: "month" };
const TITLE: Record<Range, string> = {
  day: "Minutes prayed per day (last 14 days)",
  week: "Minutes prayed per week (last 12 weeks)",
  month: "Minutes prayed per month (last 12 months)",
};

export function Stats() {
  const [logs, setLogs] = useState<PrayerLog[]>();
  const [range, setRange] = useState<Range>("day");
  const [table, setTable] = useState(false);

  useEffect(() => {
    listLogs().then(setLogs);
  }, []);

  if (!logs) return <p class="muted">Loading…</p>;

  const now = Date.now();
  const s = streaks(logs, now);
  const data = buckets(logs, range, now);
  const total = totalMinutes(data);
  const thisWeek = buckets(logs, "week", now, 1)[0];
  const today = buckets(logs, "day", now, 1)[0];
  const recorded = logs.some((l) => l.seconds);

  return (
    <section class="stack">
      <h1>Stats</h1>

      <div class="tiles">
        <div class="tile">
          <div class="tile-value">🔥 {s.current}</div>
          <div class="tile-label">day streak{s.current > 0 && !s.prayedToday ? " (pray today to keep it)" : ""}</div>
        </div>
        <div class="tile">
          <div class="tile-value">{s.longest}</div>
          <div class="tile-label">best streak (days)</div>
        </div>
        <div class="tile">
          <div class="tile-value">{formatMinutes(today.minutes)}</div>
          <div class="tile-label">today · {today.prayers} {today.prayers === 1 ? "prayer" : "prayers"}</div>
        </div>
        <div class="tile">
          <div class="tile-value">{formatMinutes(thisWeek.minutes)}</div>
          <div class="tile-label">this week · {thisWeek.prayers} {thisWeek.prayers === 1 ? "prayer" : "prayers"}</div>
        </div>
      </div>

      <div class="seg" role="group" aria-label="Time range">
        {(["day", "week", "month"] as Range[]).map((r) => (
          <button key={r} class={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>
            {r === "day" ? "Days" : r === "week" ? "Weeks" : "Months"}
          </button>
        ))}
      </div>

      <div class="card stack">
        <h2>{TITLE[range]}</h2>
        <p class="small muted">
          Total {formatMinutes(total)} · average {formatMinutes(total / RANGE_COUNT[range])} per {UNIT[range]}
        </p>
        <BarChart data={data} label={TITLE[range]} />
        {!recorded && (
          <p class="small muted">No time recorded yet. Minutes are counted while a card is open on the Today screen.</p>
        )}
        <button class="link" onClick={() => setTable(!table)}>{table ? "Hide table" : "Show as table"}</button>
        {table && (
          <table class="data">
            <thead>
              <tr><th>{range === "day" ? "Day" : range === "week" ? "Week" : "Month"}</th><th>Minutes</th><th>Prayers</th></tr>
            </thead>
            <tbody>
              {[...data].reverse().map((b) => (
                <tr key={b.start}><td>{b.full}</td><td>{Math.round(b.minutes * 10) / 10}</td><td>{b.prayers}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        <p class="small muted">Minutes are counted while a card is open and the app is on screen, up to 15 minutes per card. They are approximate.</p>
      </div>

      <p class="small muted">All time: {s.daysPrayed} {s.daysPrayed === 1 ? "day" : "days"} with prayer · {logs.length} {logs.length === 1 ? "prayer" : "prayers"} logged.</p>
    </section>
  );
}
