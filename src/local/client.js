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
  let etag = snapshot.etag, pending = null, saving = false, stopped = false, timer;
  const update = (status, error = "") => controller.setSyncState({ mode: "dolt", status, error, retryable: !stopped });
  async function flush() {
    if (saving || stopped || !pending) return;
    const project = pending;
    pending = null;
    saving = true;
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
      update(pending ? "saving" : "saved");
    } catch (error) {
      pending ??= project;
      update("error", error.message);
      return;
    } finally { saving = false; }
    if (pending) void flush();
  }
  const unsubscribe = controller.store.subscribe((event) => {
    if (event.source === "remote") return;
    pending = persistedProject(controller.store.getProject());
    if (stopped) return;
    update("saving");
    cancel(timer);
    timer = schedule(flush, 200);
  });
  controller.setSyncHandlers({ retry: () => { if (!stopped) void flush(); } });
  update("saved");
  controller.actions.setAccount({ name: "Local user" });
  return () => { stopped = true; cancel(timer); unsubscribe(); };
}
