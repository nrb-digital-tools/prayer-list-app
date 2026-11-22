import type { Point } from "./types";

export interface CurrentItem {
  text: string;
  index: number;
  total: number;
}

// The list item to pray for the next time this point comes up (if the point has a list).
export function currentItem(p: Point): CurrentItem | undefined {
  const total = p.items?.length ?? 0;
  if (!total) return undefined;
  const index = (p.itemIndex ?? 0) % total;
  return { text: p.items![index], index, total };
}

// One item per line. Blank lines are dropped.
export function parseItems(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

// After the user edits a list, keep pointing at the same item if it is still there.
export function reindex(old: Point | undefined, items: string[]): number {
  if (!items.length) return 0;
  const cur = old && currentItem(old);
  if (!cur) return 0;
  const same = items.indexOf(cur.text);
  return same >= 0 ? same : Math.min(cur.index, items.length - 1);
}
