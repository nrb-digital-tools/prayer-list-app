const DAY = 86_400_000;

// "today", "1 day ago", "12 days ago", "3 months ago"
export function ago(ms: number, now = Date.now()): string {
  const days = Math.floor(Math.max(0, now - ms) / DAY);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 60) return `${days} days ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export function dateLabel(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function sameLocalDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export const CADENCE_PRESETS: { days: number; label: string }[] = [
  { days: 1, label: "Every day" },
  { days: 3, label: "Every 3 days" },
  { days: 7, label: "Every week" },
  { days: 14, label: "Every 2 weeks" },
  { days: 30, label: "Every month" },
  { days: 90, label: "Every 3 months" },
];

export function cadenceLabel(days: number): string {
  return CADENCE_PRESETS.find((c) => c.days === days)?.label ?? `Every ${days} days`;
}

export function lastPrayedLabel(lastPrayedAt: number | undefined): string {
  return lastPrayedAt === undefined ? "Never prayed yet" : `Last prayed ${ago(lastPrayedAt)}`;
}

