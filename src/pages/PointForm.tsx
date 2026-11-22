import { useEffect, useState } from "preact/hooks";
import { addCategory, createPoint, getPoint, listCategories, savePoint } from "../lib/db";
import { CADENCE_PRESETS, PRIORITY_LABELS } from "../lib/format";
import { parseItems, reindex } from "../lib/items";
import type { Category, Priority } from "../lib/types";

const CUSTOM = "custom";

export function PointForm({ id, done }: { id?: string; done: (id?: string) => void }) {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<Priority>(2);
  const [cadence, setCadence] = useState<string>("7");
  const [custom, setCustom] = useState("10");
  const [categoryId, setCategoryId] = useState("");
  const [newCat, setNewCat] = useState("");
  const [itemsText, setItemsText] = useState("");
  const [daily, setDaily] = useState(false);
  const [cats, setCats] = useState<Category[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    listCategories().then(setCats);
    if (!id) return;
    getPoint(id).then((p) => {
      if (!p) return;
      setTitle(p.title);
      setDetails(p.details ?? "");
      setPriority(p.priority);
      setCategoryId(p.categoryId ?? "");
      setItemsText((p.items ?? []).join("\n"));
      setDaily(!!p.daily);
      if (CADENCE_PRESETS.some((c) => c.days === p.cadenceDays)) setCadence(String(p.cadenceDays));
      else {
        setCadence(CUSTOM);
        setCustom(String(p.cadenceDays));
      }
    });
  }, [id]);

  async function submit(e: Event) {
    e.preventDefault();
    const cadenceDays = daily ? 1 : cadence === CUSTOM ? Number(custom) : Number(cadence);
    if (!title.trim()) return setError("Please enter a title.");
    if (!Number.isFinite(cadenceDays) || cadenceDays < 1) return setError("Enter a number of days (1 or more).");

    let catId = categoryId || undefined;
    if (newCat.trim()) catId = (await addCategory(newCat.trim())).id;

    const items = parseItems(itemsText);
    const existing = id ? await getPoint(id) : undefined;
    const fields = {
      title: title.trim(),
      details: details.trim() || undefined,
      priority,
      cadenceDays: Math.round(cadenceDays),
      categoryId: catId,
      daily: daily || undefined,
      items: items.length ? items : undefined,
      itemIndex: items.length ? reindex(existing, items) : undefined,
    };
    if (id) {
      if (existing) await savePoint({ ...existing, ...fields });
      done(id);
    } else {
      done((await createPoint(fields)).id);
    }
  }

  return (
    <form class="stack" onSubmit={submit}>
      <h1>{id ? "Edit point" : "New point"}</h1>
      <label>
        Title
        <input value={title} onInput={(e) => setTitle((e.target as HTMLInputElement).value)} placeholder="For example: Sam and Ana, missionaries in Peru" />
      </label>
      <label>
        Details (optional)
        <textarea rows={3} value={details} onInput={(e) => setDetails((e.target as HTMLTextAreaElement).value)} />
      </label>
      <label>
        Work through a list (optional)
        <textarea
          rows={5}
          value={itemsText}
          onInput={(e) => setItemsText((e.target as HTMLTextAreaElement).value)}
          placeholder={"One item per line, for example:\nSpringfield\nRiverton\nLakeside"}
        />
        <span class="small muted">Each time you pray for this point, the next item shows. After the last item, it starts again.</span>
      </label>
      <label>
        Category
        <select value={categoryId} onChange={(e) => setCategoryId((e.target as HTMLSelectElement).value)}>
          <option value="">None</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <label>
        …or make a new category
        <input value={newCat} onInput={(e) => setNewCat((e.target as HTMLInputElement).value)} placeholder="New category name" />
      </label>
      <label class="check box">
        <input type="checkbox" checked={daily} onChange={(e) => setDaily((e.target as HTMLInputElement).checked)} />
        <span>
          Guaranteed daily
          <span class="small muted block">Shows up every day. It is not part of the rotation and does not use up your points per day.</span>
        </span>
      </label>
      {!daily && (
        <>
      <label>
        Priority
        <select value={priority} onChange={(e) => setPriority(Number((e.target as HTMLSelectElement).value) as Priority)}>
          {([1, 2, 3] as const).map((p) => (
            <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
          ))}
        </select>
      </label>
      <label>
        How often?
        <select value={cadence} onChange={(e) => setCadence((e.target as HTMLSelectElement).value)}>
          {CADENCE_PRESETS.map((c) => (
            <option key={c.days} value={c.days}>{c.label}</option>
          ))}
          <option value={CUSTOM}>Custom…</option>
        </select>
      </label>
      {cadence === CUSTOM && (
        <label>
          Every how many days?
          <input type="number" min={1} value={custom} onInput={(e) => setCustom((e.target as HTMLInputElement).value)} />
        </label>
      )}
        </>
      )}
      {error && <p class="error">{error}</p>}
      <div class="row">
        <button class="primary" type="submit">Save</button>
        <button type="button" onClick={() => done(id)}>Cancel</button>
      </div>
    </form>
  );
}
