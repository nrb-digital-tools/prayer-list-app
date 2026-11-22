import { render } from "preact";
import { App } from "./App";
import { requestPersistentStorage } from "./lib/backup";
import { getSettings } from "./lib/db";
import { applyTheme, initTheme } from "./lib/theme";
import "./styles.css";

initTheme();
// Keep the saved choice (also restored from a backup) in step with the fast-start copy.
getSettings().then((s) => applyTheme(s.theme));
requestPersistentStorage();
render(<App />, document.getElementById("app")!);
