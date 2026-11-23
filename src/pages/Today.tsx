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
  setUpdateAnswered,
  markPrayed,
  saveSession,
  type SessionSnapshot,
  savePoint,
} from "../lib/db";
import { addMissingDailies, addNext, cardSeconds, currentIndex, newDay, pauseTimer, record, resetCardTime, startTimer, targetReached } from "../lib/session";
import { formatMinutes, minutesToday, streaks } from "../lib/stats";
import { BackupBanner } from "../components/BackupBanner";
import { UrgentControl } from "../components/UrgentControl";
import { UpdateEntry } from "../components/UpdateEntry";
import { urgentLabel } from "../lib/urgent";
import { verseForDay } from "../lib/verses";
import { currentItem } from "../lib/items";
import { cadenceLabel, lastPrayedLabel, sameLocalDay } from "../lib/format";
import { DEFAULT_SETTINGS, type Category, type Point, type PointUpdate, type PrayerLog, type Settings } from "../lib/types";

// If no card is waiting, add the next one, unless today's time target is reached
// (then the target screen shows, until you tap "Keep praying").
function fill(snap: SessionSnapshot, all: Point[], settings: Settings, logs: PrayerLog[]): SessionSnapshot {
  const now = Date.now();
  const active = new Set(all.filter((p) => p.status === "active").map((p) => p.id));
  if (currentIndex(snap, (id) => active.has(id)) !== -1) return snap;
  let next = snap;
  if (snap.keepGoing || !targetReached(minutesToday(logs, now), settings)) next = addNext(snap, all, settings, now);
  // No card left (target reached, or nothing to show): pause the timer, so waiting time does not count.
  if (currentIndex(next, (id) => active.has(id)) === -1) next = { ...pauseTimer(next, now), cardMs: 0 };
  return next;
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
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [, setTick] = useState(0);

  async function reloadPoints() {
    const [all, c, l, st] = await Promise.all([listPoints(), listCategories(), listLogs(), getSettings()]);
    setPoints(new Map(all.map((p) => [p.id, p])));
    setCats(c);
    setLogs(l);
    setSettings(st);
    return { all, logs: l, settings: st };
  }

  // Start (or continue) today's cards. A session from an earlier day, or from an older app version, starts over.
  async function load(forceNewDay = false) {
    const data = await reloadPoints();
    let s = forceNewDay ? undefined : await getSession();
    if (!s || !sameLocalDay(s.startedAt, Date.now())) s = newDay(data.all, data.settings, Date.now());
    else s = addMissingDailies(s, data.all, Date.now());
    await update(fill(s, data.all, data.settings, data.logs));
  }

  useEffect(() => {
    load();
  }, []);

  const index = session ? currentIndex(session, (id) => points.get(id)?.status === "active") : -1;
  const current = index >= 0 ? points.get(session!.cards[index].id) : undefined;

  // Prayer time for the card on screen, from the Start / Pause timer.
  const elapsedSeconds = () => (session ? cardSeconds(session, Date.now()) : 0);
  const running = session?.timerSince !== undefined;
  // Redraw every 5 seconds while the timer runs, so the minutes line stays current.
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setTick((n) => n + 1), 5_000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    setUpdates([]);
    setShowAll(false);
    setAdding(false);
    setNote("");
    // Only open updates show on the card. Answered ones are kept on the point page and the Answered tab.
    if (current) listUpdates(current.id).then((u) => setUpdates(u.filter((x) => !x.answeredAt)));
  }, [index, current?.id]);

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

  // Save what you did with the card on screen, then bring the next card (if any).
  async function finish(result: "prayed" | "later") {
    if (!session || !current) return;
    const now = Date.now();
    // Only Prayed cards keep their time. The next card starts at 0 (the timer keeps running if it was).
    if (result === "prayed") await markPrayed(current.id, now, cardSeconds(session, now));
    const data = await reloadPoints();
    await update(fill(resetCardTime(record(session, index, result), now), data.all, data.settings, data.logs));
  }
  const prayed = () => once(() => finish("prayed"));
  const later = () => once(() => finish("later"));

  // After the target: one more card at a time, until you stop. It never runs out (it starts new rounds).
  async function keepPraying() {
    if (!session) return;
    const data = await reloadPoints();
    await update(fill({ ...session, keepGoing: true }, data.all, data.settings, data.logs));
  }

  async function toggleTimer() {
    if (!session) return;
    const now = Date.now();
    await update(running ? pauseTimer(session, now) : startTimer(session, now));
  }

  // Leave "keep praying" mode. The card on screen has not been prayed, so drop it.
  async function stop() {
    if (!session) return;
    const cards = index >= 0 ? session.cards.filter((_, j) => j !== index) : session.cards;
    await update({ ...pauseTimer(session, Date.now()), keepGoing: false, cards, cardMs: 0 });
  }

  // Save a change to the point on screen (used by the Urgent control).
  async function saveCurrent(changes: Partial<Point>) {
    if (!current) return;
    await savePoint({ ...current, ...changes });
    await reloadPoints();
  }

  async function saveNote() {
    if (!current || !note.trim()) return;
    const u = await addUpdate(current.id, note.trim());
    setUpdates((list) => [u, ...list]);
    setNote("");
    setAdding(false);
  }

  // Updates stay on the card until you remove them: mark answered (kept) or delete (gone).
  async function answerUpdate(u: PointUpdate) {
    await setUpdateAnswered(u.id, Date.now());
    setUpdates((list) => list.filter((x) => x.id !== u.id));
  }
  async function deleteOne(u: PointUpdate) {
    await deleteUpdate(u.id);
    setUpdates((list) => list.filter((x) => x.id !== u.id));
  }

  async function restored() {
    await load(true);
  }

  if (!session) return <p class="muted">Loading…</p>;

  const prayedToday = session.cards.filter((c) => c.result === "prayed").length;
  const minutes = minutesToday(logs, Date.now()) + (current ? elapsedSeconds() / 60 : 0);
  const shownMin = Math.floor(minutes);
  const progress = (
    <div class="progress" aria-label={`${shownMin} of ${settings.targetMinutes} minutes today`}>
      <span class="small muted">
        {shownMin} of {formatMinutes(settings.targetMinutes)} today
        {session.keepGoing ? " · keep praying" : ""}
      </span>
      <div class="bar"><div class="fill" style={{ width: `${Math.min(100, (minutes / settings.targetMinutes) * 100)}%` }} /></div>
      {current && (
        <button class={running ? "timer-btn on" : "timer-btn"} onClick={toggleTimer}>
          {running ? "❚❚ Pause" : "▶ Start praying"}
        </button>
      )}
    </div>
  );
  const cat = cats.find((c) => c.id === current?.categoryId);
  const streak = streaks(logs, Date.now());
  const verse = verseForDay(Date.now());
  const header = (
    <>
    <div class="row between">
      <h1>Today</h1>
      {streak.current > 0 && (
        <span class={streak.prayedToday ? "streak" : "streak at-risk"} title="Days in a row with at least one prayer">
          🔥 {streak.current} {streak.current === 1 ? "day" : "days"}
        </span>
      )}
    </div>
    <figure class="verse">
      <blockquote>“{verse.text}”</blockquote>
      <figcaption>— {verse.ref} ESV</figcaption>
    </figure>
    </>
  );

  if (!current) {
    const reached = targetReached(minutesToday(logs, Date.now()), settings);
    const noPoints = points.size === 0;
    return (
      <section>
        {header}
        <BackupBanner onRestored={restored} />
        {noPoints ? (
          <div class="card center">
            <p>You have no points to pray for yet.</p>
            <button class="primary" onClick={() => go({ page: "form", from: "today" })}>Add your first point</button>
          </div>
        ) : (
          <div class="card center stack">
            {progress}
            {reached ? (
              <>
                <p class="big">🙏 You reached today's {formatMinutes(settings.targetMinutes)}</p>
                <p class="muted">{prayedToday === 1 ? "1 prayer" : `${prayedToday} prayers`} today.</p>
              </>
            ) : (
              <>
                <p class="big">🙏 You prayed for every point today</p>
                <p class="muted">Add more points, or come back tomorrow.</p>
              </>
            )}
            {streak.current > 0 && (
              <p class="muted small">
                🔥 {streak.current}-day streak{streak.prayedToday ? "" : " (pray for one point today to keep it)"}
              </p>
            )}
            {reached && (
              <>
                <button class="primary" onClick={keepPraying}>Keep praying</button>
                <p class="muted small">“Keep praying” brings one more point at a time, until you stop.</p>
              </>
            )}
          </div>
        )}
      </section>
    );
  }

  const urgent = urgentLabel(current, Date.now());
  const item = currentItem(current);

  return (
    <section>
      {header}
      <BackupBanner onRestored={restored} />
      {progress}
      <div class="card">
        <div class="chips">
          {current.daily && <span class="chip">Daily</span>}
          {cat && <span class="chip">{cat.name}</span>}
          {urgent && <span class="chip urgent">{urgent}</span>}
        </div>
        <h2 class="point-title">{current.title}</h2>
        {!running && <p class="small muted timer-hint">Timer paused. Tap Start praying to count your prayer time.</p>}
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
              <UpdateEntry key={u.id} update={u} onAnswered={() => answerUpdate(u)} onReopen={() => {}} onDelete={() => deleteOne(u)} />
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
            <UrgentControl point={current} save={saveCurrent} />
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
