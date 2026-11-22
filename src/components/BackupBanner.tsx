import { useEffect, useState } from "preact/hooks";
import { importBackup, isEmpty, needsBackup, shareBackup } from "../lib/backup";

// Shown on the Today screen.
//  - Empty app: offer to restore from a backup file.
//  - Data but no recent backup: remind the user to back up.
export function BackupBanner({ onRestored }: { onRestored: () => void }) {
  const [mode, setMode] = useState<"none" | "backup" | "restore">("none");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (await isEmpty()) setMode("restore");
      else if (await needsBackup()) setMode("backup");
    })();
  }, []);

  async function backUp() {
    const r = await shareBackup();
    if (r !== "cancelled") setMode("none");
  }

  async function restore(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      await importBackup(JSON.parse(await file.text()));
      setMode("none");
      onRestored();
    } catch (err) {
      setMsg(`Could not restore: ${(err as Error).message}`);
    }
  }

  if (mode === "none") return null;

  return (
    <div class="banner">
      {mode === "backup" ? (
        <>
          <p>Your points are saved only on this phone. Back them up now (choose “Save to Files”).</p>
          <div class="row">
            <button class="primary" onClick={backUp}>Back up now</button>
            <button onClick={() => setMode("none")}>Not now</button>
          </div>
        </>
      ) : (
        <>
          <p>Starting fresh? If you have a backup file, you can restore it.</p>
          <div class="row">
            <label class="file-btn">
              Restore from backup
              <input type="file" accept="application/json,.json" onChange={restore} />
            </label>
            <button onClick={() => setMode("none")}>Dismiss</button>
          </div>
        </>
      )}
      {msg && <p class="error small">{msg}</p>}
    </div>
  );
}
