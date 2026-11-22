import { useState } from "preact/hooks";
import { Today } from "./pages/Today";
import { Points } from "./pages/Points";
import { PointDetail } from "./pages/PointDetail";
import { PointForm } from "./pages/PointForm";
import { Answered } from "./pages/Answered";
import { SettingsPage } from "./pages/SettingsPage";
import { Stats } from "./pages/Stats";

export type Tab = "today" | "points" | "answered" | "stats" | "settings";
export type Route =
  | { page: "tab"; tab: Tab }
  | { page: "detail"; id: string; from: Tab }
  | { page: "form"; id?: string; from: Tab };

export type Go = (r: Route) => void;

const TABS: { tab: Tab; label: string; icon: string }[] = [
  { tab: "today", label: "Today", icon: "🙏" },
  { tab: "points", label: "Points", icon: "📋" },
  { tab: "answered", label: "Answered", icon: "✅" },
  { tab: "stats", label: "Stats", icon: "📊" },
  { tab: "settings", label: "Settings", icon: "⚙️" },
];

export function App() {
  const [route, setRoute] = useState<Route>({ page: "tab", tab: "today" });
  const activeTab: Tab = route.page === "tab" ? route.tab : route.from;

  let body;
  if (route.page === "detail") body = <PointDetail id={route.id} back={() => setRoute({ page: "tab", tab: route.from })} go={setRoute} from={route.from} />;
  else if (route.page === "form") body = <PointForm id={route.id} done={(id) => setRoute(id ? { page: "detail", id, from: route.from } : { page: "tab", tab: route.from })} />;
  else if (route.tab === "today") body = <Today go={setRoute} />;
  else if (route.tab === "points") body = <Points go={setRoute} />;
  else if (route.tab === "answered") body = <Answered go={setRoute} />;
  else if (route.tab === "stats") body = <Stats />;
  else body = <SettingsPage />;

  return (
    <div class="shell">
      <main class="main">{body}</main>
      <nav class="tabbar">
        {TABS.map((t) => (
          <button
            key={t.tab}
            class={activeTab === t.tab ? "tab active" : "tab"}
            onClick={() => setRoute({ page: "tab", tab: t.tab })}
          >
            <span class="tab-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
