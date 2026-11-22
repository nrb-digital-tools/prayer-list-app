import { useEffect, useRef, useState } from "preact/hooks";
import type { Go } from "../App";
import {
  addUpdate,
  getSession,
  getSettings,
  listCategories,
  listLogs,
  listPoints,
  listUpdates,
  deleteUpdate,
  markPrayed,
  saveSession,
  type SessionSnapshot,
} from "../lib/db";
import { buildSession, nextExtra } from "../lib/scoring";
import { streaks } from "../lib/stats";
import { BackupBanner } from "../components/BackupBanner";
import { currentItem } from "../lib/items";
import { cadenceLabel, dateLabel, lastPrayedLabel, sameLocalDay } from "../lib/format";
import type { Category, Point, PointUpdate, PrayerLog } from "../lib/types";

// Time on a card counts as prayer time, up to this much per card.
const MAX_CARD_SECONDS = 15 * 60;

// Build a new session (daily points first, then the rotation).
async function startSession(): Promise<SessionSnapshot> {
  const [points, settings] = await Promise.all([listPoints(), getSettings()]);
  const now = Date.now();
  const snap: SessionSnapshot = {
    startedAt: now,
    ids: buildSession(points, settings, now),
    done: [],
    skipped: [],
  };
  await saveSession(snap);
  return snap;
}

// "Keep praying": add the next single point. If nothing is left, turn the mode off.
async function appendNext(snap: SessionSnapshot): Promise<SessionSnapshot> {
  const [points, settings] = await Promise.all([listPoints(), getSettings()]);
  const extraFrom = snap.extraFrom ?? snap.ids.length;
  const id = nextExtra(points, settings, Date.now(), snap.ids, snap.ids.length - extraFrom);
  return id
    ? { ...snap, extraFrom, keepGoing: true, ids: [...snap.ids, id] }
    : { ...snap, extraFrom, keepGoing: false };
}

// A card shows this many updates at first. "Show all" shows the rest.
const SHOWN_UPDATES = 3;

export function Today({ go }: { go: Go }) {
  const [session, setSession] = useState<SessionSnapshot>();
  const [points, setPoints] = useState<Map<string, Point>>(new Map());
  const [cats, setCats] = useState<Category[]>([]);
  const [logs, setLogs] = useState<PrayerLog[]>([]);
  const [updates, setUpdates] = useState<PointUpdate[]>([]);
  const [showAll, setShowAll] = useState(false);
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  async function reloadPoints() {
    const [all, c, l] = await Promise.all([listPoints(), listCategories(), listLogs()]);
    setPoints(new Map(all.map((p) => [p.id, p])));
    setCats(c);
    setLogs(l);
    return all;
  }

  useEffect(() => {
    (async () => {
      await reloadPoints();
      let s = await getSession();
      // A session from an earlier day is stale. An empty one is too (points may be added since).
      if (!s || s.ids.length === 0 || !sameLocalDay(s.startedAt, Date.now())) s = await startSession();
      setSession(s);
    })();
  }, []);

  const pending = session
    ? session.ids.filter(
        (id) => !session.done.includes(id) && !session.skipped.includes(id) && points.get(id)?.status === "active",
      )
    : [];
  const current = pending.length ? points.get(pending[0]) : undefined;

  // Prayer time: seconds the app is open and visible while a card is showing.
  const timer = useRef<{ ms: number; since: number | null }>({ ms: 0, since: null });
  useEffect(() => {
    timer.current = { ms: 0, since: document.visibilityState === "visible" ? Date.now() : null };
  }, [current?.id]);
  useEffect(() => {
    const onVisibility = () => {
      const t = timer.current;
      if (document.visibilityState === "hidden") {
        if (t.since !== null) t.ms += Date.now() - t.since;
        t.since = null;
      } else if (t.since === null) {
        t.since = Date.now();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const elapsedSeconds = () => {
    const t = timer.current;
    const ms = t.ms + (t.since !== null ? Date.now() - t.since : 0);
    return Math.min(Math.round(ms / 1000), MAX_CARD_SECONDS);
  };

  useEffect(() => {
    setUpdates([]);
    setShowAll(false);
    setAdding(false);
    setNote("");
    if (current) listUpdates(current.id).then(setUpdates);
  }, [current?.id]);

  async function update(next: SessionSnapshot) {
    setSession(next);
    await saveSession(next);
  }

  // Ignore a second tap while the first is still saving (a double tap must not count twice).
  const busy = useRef(false);
  async function once(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } finally {
      busy.current = false;
    }
  }

  const prayed = () =>
    once(async () => {
      if (!session || !current) return;
      await markPrayed(current.id, Date.now(), elapsedSeconds());
      await reloadPoints();
      let next = { ...session, done: [...session.done, current.id] };
      if (next.keepGoing) next = await appendNext(next);
      await update(next);
    });

  const later = () =>
    once(async () => {
      if (!session || !current) return;
      let next = { ...session, skipped: [...session.skipped, current.id] };
      if (next.keepGoing) next = await appendNext(next);
      await update(next);
    });

  async function keepPraying() {
    if (!session) return;
    await update(await appendNext(session));
  }

  // Leave "keep praying" mode. The extra card on screen has not been prayed, so drop it.
  async function stop() {
    if (!session || !current) return;
    await update({ ...session, keepGoing: false, ids: session.ids.filter((id) => id !== current.id) });
  }

  async function saveNote() {
    if (!current || !note.trim()) return;
    const u = await addUpdate(current.id, note.trim());
    setUpdates((list) => [u, ...list]);
    setNote("");
    setAdding(false);
  }

  // Updates stay on the card until you remove them here or on the point page.
  async function removeUpdate(u: PointUpdate) {
    if (!confirm("Remove this update?")) return;
    await deleteUpdate(u.id);
    setUpdates((list) => list.filter((x) => x.id !== u.id));
  }

  async function fresh() {
    setSession(await startSession());
  }

  async function restored() {
    await reloadPoints();
    setSession(await startSession());
  }

  if (!session) return <p class="muted">Loading…</p>;

  const total = session.ids.length;
  const cat = cats.find((c) => c.id === current?.categoryId);
  const streak = streaks(logs, Date.now());
  const header = (
    <div class="row between">
      <h1>Today</h1>
      {streak.current > 0 && (
        <span class={streak.prayedToday ? "streak" : "streak at-risk"} title="Days in a row with at least one prayer">
          🔥 {streak.current} {streak.current === 1 ? "day" : "days"}
        </span>
      )}
    </div>
  );

  if (!current) {
    const ranOut = session.extraFrom !== undefined && !session.keepGoing;
    return (
      <section>
        {header}
        <BackupBanner onRestored={restored} />
        {total === 0 ? (
          <div class="card center">
            <p>You have no points to pray for yet.</p>
            <button class="primary" onClick={() => go({ page: "form", from: "today" })}>Add your first point</button>
          </div>
        ) : (
          <div class="card center">
            <p class="big">🙏 Session complete</p>
            <p class="muted">
              {session.done.length} prayed
              {session.skipped.length ? `, ${session.skipped.length} saved for later` : ""}.
            </p>
            {ranOut && <p class="muted">Nothing else is waiting right now. Well done.</p>}
            {streak.current > 0 && (
              <p class="muted small">
                🔥 {streak.current}-day streak{streak.prayedToday ? "" : " (pray for one point today to keep it)"}
              </p>
            )}
            <button class="primary" onClick={keepPraying}>Keep praying</button>
            <button onClick={fresh}>Start a fresh session</button>
            <p class="muted small">“Keep praying” brings one more point at a time, until you stop.</p>
          </div>
        )}
      </section>
    );
  }

  const urgent = current.urgentUntil && current.urgentUntil > Date.now();
  const item = currentItem(current);
  const index = session.ids.indexOf(current.id);
  const isExtra = session.extraFrom !== undefined && index >= session.extraFrom;

  return (
    <section>
      {header}
      <BackupBanner onRestored={restored} />
      <p class="muted small">
        {isExtra ? `Keep praying · extra card ${index - session.extraFrom! + 1}` : `Card ${index + 1} of ${session.extraFrom ?? total}`}
      </p>
      <div class="card">
        <div class="chips">
          {current.daily && <span class="chip">Daily</span>}
          {cat && <span class="chip">{cat.name}</span>}
          {urgent && <span class="chip urgent">Urgent</span>}
          {!current.daily && current.priority === 3 && <span class="chip">High priority</span>}
        </div>
        <h2 class="point-title">{current.title}</h2>
        {current.details && <p class="details">{current.details}</p>}
        {item && (
          <div class="item-box">
            <div class="small muted">Today's item · {item.index + 1} of {item.total}</div>
            <p class="item-text">{item.text}</p>
          </div>
        )}
        {updates.length > 0 && (
          <div class="updates">
            <div class="small muted">{updates.length === 1 ? "1 update" : `${updates.length} updates`} · newest first</div>
            {(showAll ? updates : updates.slice(0, SHOWN_UPDATES)).map((u) => (
              <div key={u.id} class="latest">
                <div class="small muted row between">
                  <span>{dateLabel(u.createdAt)}</span>
                  <button class="link small" onClick={() => removeUpdate(u)}>Remove</button>
                </div>
                <p>{u.text}</p>
              </div>
            ))}
            {updates.length > SHOWN_UPDATES && (
              <button class="link small" onClick={() => setShowAll(!showAll)}>
                {showAll ? "Show fewer" : `Show all ${updates.length} updates`}
              </button>
            )}
          </div>
        )}
        <p class="small muted">
          {lastPrayedLabel(current.lastPrayedAt)}
          {current.daily ? " · every day" : ` · goal: ${cadenceLabel(current.cadenceDays).toLowerCase()}`}
        </p>

        {adding ? (
          <div class="stack">
            <textarea
              rows={3}
              placeholder="What is new? (for example, news from the field)"
              value={note}
              onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)}
            />
            <div class="row">
              <button class="primary" onClick={saveNote}>Save update</button>
              <button onClick={() => setAdding(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div class="row wrap">
            <button class="primary big-btn" onClick={prayed}>Prayed ✓</button>
            <button onClick={later}>Later</button>
            <button onClick={() => setAdding(true)}>+ Update</button>
            <button onClick={() => go({ page: "detail", id: current.id, from: "today" })}>Open</button>
          </div>
        )}
      </div>
      {session.keepGoing && (
        <button class="link" onClick={stop}>Stop for now</button>
      )}
    </section>
  );
}
