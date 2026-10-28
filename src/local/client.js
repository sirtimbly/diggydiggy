import { emptyProject, validProject } from "../project/project.js";
import { projectDocument, materializeProject } from "../project/changes.js";

// Use the same normalized project representation as undo and hosted sharing.
// Personal selection and sync credentials never enter the database.
export const persistedProject = (project) => materializeProject(projectDocument(project));

export async function loadLocalProject({ request = fetch } = {}) {
  const response = await request("/api/local/project", { cache: "no-store" });
  if (!response.ok) throw new Error("Couldn’t open the local database. Restart Diggy and try again.");
  const snapshot = await response.json();
  const project = snapshot.project ?? emptyProject();
  if (!validProject(project)) throw new Error("The database contains an invalid project.");
  return { project, etag: response.headers.get("etag") };
}

export function connectLocalPersistence(controller, snapshot, {
  request = fetch, schedule = setTimeout, cancel = clearTimeout,
} = {}) {
  let etag = snapshot.etag, pending = null, stopped = false, timer, activeSave = null;
  let syncing = false, disposed = false, remoteError = "", syncMessage = "";
  const update = (status, error = "") => controller.setSyncState({
    mode: "dolt", status, error, retryable: !stopped, remoteSyncing: syncing, remoteError, syncMessage,
  });
  async function savePending() {
    while (pending && !stopped) {
      const project = pending;
      pending = null;
      update("saving");
      try {
        const response = await request("/api/local/project", {
          method: "PUT",
          headers: { "content-type": "application/json", "if-match": etag },
          body: JSON.stringify({ project }),
        });
        if (!response.ok) {
          if (response.status === 412) {
            stopped = true;
            throw new Error("Another tab changed this project. Reload to open the saved version. Your edits remain in this browser’s recovery cache.");
          }
          throw new Error("Couldn’t save to Dolt. Your edits remain in this browser; use Retry save.");
        }
        etag = response.headers.get("etag");
      } catch (error) {
        pending ??= project;
        update("error", error.message);
        return false;
      }
    }
    update("saved");
    return !stopped;
  }
  function flush() {
    if (activeSave) return activeSave;
    if (stopped || !pending) return Promise.resolve(!stopped);
    activeSave = savePending().finally(() => { activeSave = null; });
    return activeSave;
  }
  async function sync() {
    if (syncing || stopped || disposed) return;
    if (controller.hasActiveProjectEdit()) {
      remoteError = "Save or cancel your open edit before syncing.";
      update(pending ? "saving" : "saved");
      return;
    }
    syncing = true;
    remoteError = "";
    syncMessage = "";
    cancel(timer);
    // The controller's common edit guard pauses all forms, gestures, and undo.
    controller.setLocalSyncBusy(true);
    update(pending || activeSave ? "saving" : "saved");
    let saved = false;
    try {
      saved = await flush();
      if (!saved || disposed) return;
      const response = await request("/api/local/sync", {
        method: "POST", headers: { "if-match": etag },
      });
      const result = await response.json();
      if (disposed) return;
      if (response.status === 412) {
        stopped = true;
        throw new Error(result.error || "Another tab changed this project. Reload before syncing.");
      }
      const nextTag = response.headers.get("etag");
      // A pull may succeed before a push fails. Refresh to that received version
      // even on error, so later edits cannot overwrite it with an old board.
      if (nextTag && nextTag !== etag) {
        const project = result.project ?? emptyProject();
        if (!validProject(project)) {
          stopped = true;
          throw new Error("The received board is invalid. Reload after correcting the database.");
        }
        controller.replaceLocalProject(project);
        etag = nextTag;
      }
      if (!response.ok) throw new Error(result.error || "Couldn’t sync. Check your connection and try again.");
      syncMessage = "Synced with Git";
    } catch (error) {
      if (!disposed) remoteError = error.message;
    } finally {
      syncing = false;
      if (!disposed) {
        controller.setLocalSyncBusy(false);
        if (saved) update(stopped ? "error" : "saved");
        else controller.setSyncState({ remoteSyncing: false });
      }
    }
  }
  const unsubscribe = controller.store.subscribe((event) => {
    if (event.source === "remote") return;
    syncMessage = "";
    pending = persistedProject(controller.store.getProject());
    if (stopped) return;
    update("saving");
    cancel(timer);
    timer = schedule(flush, 200);
  });
  controller.setSyncHandlers({
    sync,
    dismissError: () => { remoteError = ""; controller.setSyncState({ remoteError }); },
    retry: () => { if (!stopped) void flush(); },
  });
  update("saved");
  controller.actions.setAccount({ name: "Local user" });
  return () => { disposed = true; stopped = true; cancel(timer); unsubscribe(); };
}
