import { useEffect, useState } from "preact/hooks";
import { addCategory, deleteCategory, getSettings, listCategories, saveSession, saveSettings } from "../lib/db";
import { applyTheme } from "../lib/theme";
import { importBackup, shareBackup } from "../lib/backup";
import { PRIORITY_LABELS } from "../lib/format";
import { DEFAULT_SETTINGS, type Category, type Priority, type Settings, type Theme } from "../lib/types";

export function SettingsPage() {
  const [s, setS] = useState<Settings>(DEFAULT_SETTINGS);
  const [cats, setCats] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState("");
  const [msg, setMsg] = useState("");
  const [persisted, setPersisted] = useState<boolean>();

  useEffect(() => {
    getSettings().then(setS);
    listCategories().then(setCats);
    navigator.storage?.persisted?.().then(setPersisted).catch(() => {});
  }, []);

  async function change(next: Settings) {
    setS(next);
    await saveSettings(next);
    // Daily-list settings apply to today's list at once: it is rebuilt the next time you open Today.
    if (next.theme === s.theme) await saveSession(undefined);
  }

  async function pickTheme(theme: Theme) {
    applyTheme(theme);
    setS({ ...s, theme });
    await saveSettings({ ...s, theme });
  }

  const num = (v: string, min: number, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n >= min ? n : fallback;
  };

  async function doExport() {
    const r = await shareBackup();
    setMsg(r === "cancelled" ? "Backup cancelled." : "Backup saved.");
  }

  async function doImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!confirm("This replaces ALL points on this device with the backup. Continue?")) return;
      await importBackup(data);
      setMsg("Backup restored.");
      setS(await getSettings());
      setCats(await listCategories());
    } catch (err) {
      setMsg(`Could not restore: ${(err as Error).message}`);
    }
  }

  return (
    <section class="stack">
      <h1>Settings</h1>

      <div class="card stack">
        <h2>Appearance</h2>
        <div class="seg" role="group" aria-label="Theme">
          {(["system", "light", "dark"] as Theme[]).map((t) => (
            <button key={t} class={s.theme === t ? "on" : ""} aria-pressed={s.theme === t} onClick={() => pickTheme(t)}>
              {t === "system" ? "Match phone" : t === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </div>

      <div class="card stack">
        <h2>Daily session</h2>
        <p class="small muted">Changes apply to today's list right away. Guaranteed daily points are extra and do not count here.</p>
        <label>
          Points per day (from the rotation)
          <input type="number" min={1} value={s.sessionSize} onChange={(e) => change({ ...s, sessionSize: Math.round(num((e.target as HTMLInputElement).value, 1, s.sessionSize)) })} />
        </label>
        <label>
          Neglect slots (cards picked by time since prayed, ignoring priority)
          <input type="number" min={0} value={s.neglectSlots} onChange={(e) => change({ ...s, neglectSlots: Math.round(num((e.target as HTMLInputElement).value, 0, s.neglectSlots)) })} />
        </label>
        <label>
          Hard limit: always include a point not prayed for this many days
          <input type="number" min={1} value={s.maxGapDays} onChange={(e) => change({ ...s, maxGapDays: Math.round(num((e.target as HTMLInputElement).value, 1, s.maxGapDays)) })} />
        </label>
        <h3>Priority weights</h3>
        <div class="row wrap">
          {([1, 2, 3] as Priority[]).map((p) => (
            <label key={p} class="grow">
              {PRIORITY_LABELS[p]}
              <input type="number" step="0.1" min={0.1} value={s.priorityWeights[p]} onChange={(e) => change({ ...s, priorityWeights: { ...s.priorityWeights, [p]: num((e.target as HTMLInputElement).value, 0.1, s.priorityWeights[p]) } })} />
            </label>
          ))}
        </div>
        <button onClick={() => change({ ...DEFAULT_SETTINGS, theme: s.theme })}>Reset to defaults</button>
      </div>

      <div class="card stack">
        <h2>Categories</h2>
        {cats.map((c) => (
          <div key={c.id} class="row between">
            <span>{c.name}</span>
            <button class="link" onClick={async () => { if (confirm(`Delete category "${c.name}"? Its points are kept.`)) { await deleteCategory(c.id); setCats(await listCategories()); } }}>Delete</button>
          </div>
        ))}
        <div class="row">
          <input class="grow" placeholder="New category" value={newCat} onInput={(e) => setNewCat((e.target as HTMLInputElement).value)} />
          <button onClick={async () => { if (newCat.trim()) { await addCategory(newCat.trim()); setNewCat(""); setCats(await listCategories()); } }}>Add</button>
        </div>
      </div>

      <div class="card stack">
        <h2>Backup</h2>
        <p class="small muted">Your data lives only on this device. Export a backup now and then. This matters most on iPhone, where Safari can erase data.</p>
        <button class="primary" onClick={doExport}>Export backup</button>
        <label class="file-btn">
          Restore from backup
          <input type="file" accept="application/json,.json" onChange={doImport} />
        </label>
        {msg && <p class="small">{msg}</p>}
        {persisted !== undefined && (
          <p class="small muted">Protected storage: {persisted ? "on" : "off (the browser may erase data if the device is low on space)"}.</p>
        )}
      </div>
    </section>
  );
}
