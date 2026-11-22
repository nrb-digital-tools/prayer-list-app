import type { Theme } from "./types";

const KEY = "prayer-theme";

export function storedTheme(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    if (t === "light" || t === "dark") return t;
  } catch {
    /* storage can be blocked */
  }
  return "system";
}

// "system" removes the override, so the CSS follows the phone setting.
export function applyTheme(t: Theme): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (t === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    /* ignore */
  }
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#14181d" : "#3b5b7a");
}

// Call once at start. Also updates the browser bar colour when the phone switches light/dark.
export function initTheme(): void {
  applyTheme(storedTheme());
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyTheme(storedTheme()));
}
