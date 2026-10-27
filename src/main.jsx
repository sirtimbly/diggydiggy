import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import App from "./App.jsx";
import { LoadingIntro } from "./components/LoadingIntro.jsx";
import { createProjectController } from "./project/controller.js";
import { loadSharedProject, connectCollaboration } from "./sync/client.js";
import { loadLocalProject, connectLocalPersistence } from "./local/client.js";
import "../styles.css";
import "./local/local.css";

const root = createRoot(document.getElementById("root"));
let controller, disconnect, disposed = false, introDone = false, loadError = null;
function render(view = null) {
  flushSync(() => root.render(<>
    <div key="workspace" className="workspace-entry" inert={!introDone}>
      {view && <App view={view} actions={controller.actions} />}
    </div>
    {!introDone && <LoadingIntro key="intro" view={view} error={loadError} onComplete={() => {
      introDone = true;
      render(controller.getView());
    }} />}
  </>));
}
async function start() {
  render();
  let shared, local;
  try {
    if (import.meta.env.VITE_LOCAL_DOLT) local = await loadLocalProject();
    else shared = await loadSharedProject();
  } catch (error) {
    if (disposed) return;
    loadError = error.message;
    render();
    return;
  }
  if (disposed) return;
  controller = createProjectController(render, {
    storageKey: local ? "diggy-dolt-recovery" : shared?.storageKey,
    initial: local ? () => local.project : shared ? () => shared.snapshot.project : undefined,
    preferInitial: Boolean(local),
    isShared: Boolean(shared),
  });
  render(controller.getView());
  controller.start();
  disconnect = local ? connectLocalPersistence(controller, local) : connectCollaboration(controller, shared);
}
start();
if (import.meta.hot)
  import.meta.hot.dispose(() => {
    disposed = true;
    disconnect?.();
    controller?.dispose();
    root.unmount();
  });
