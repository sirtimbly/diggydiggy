import { ColorLegend } from "./components/ColorLegend.jsx";
import { CrewDialog } from "./components/CrewDialog.jsx";
import { DividerEditor } from "./components/PhaseDividers.jsx";
import { ShareDialog } from "./components/ShareDialog.jsx";
import { useProjectShortcuts } from "./hooks/useProjectShortcuts.js";
import { Header } from "./components/Header.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { ExcavationCanvas } from "./components/ExcavationCanvas.jsx";
import { BlockInspector } from "./components/BlockInspector.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { Icon } from "./components/Icon.jsx";
import { ProjectDetailsDialog } from "./components/ProjectDetailsDialog.jsx";

export default function App({ view, actions }) {
  useProjectShortcuts(actions);
  return (
    <>
      <Header
        project={view.state}
        storageAvailable={view.storageAvailable}
        sync={view.sync}
        presence={view.presence}
        canEdit={view.canEdit}
        accountLoading={view.accountLoading}
        actions={actions}
      />
      {!view.canEdit && !view.accountLoading && <div className="edit-access-notice" role="status">
        View only. <button type="button" onClick={actions.requireSignIn}>Sign in to make changes</button>
      </div>}
      <main>
        <div className="workbench">
          <section className="dig-panel" aria-label="Project excavation">
            <Toolbar view={view} actions={actions} />
            <ExcavationCanvas view={view} actions={actions} />
            <div className="dig-legend">
              <div className="ground-legend">
                <span>
                  <i className="legend-solid"></i>Known work
                </span>
                <span>
                  <i className="legend-padding"></i>Unknown scope
                </span>
                <span className="depth-explainer">
                  <Icon name="down" />
                  Blocks stack. Cleared ground stays open.
                </span>
              </div>
              <ColorLegend project={view.state} canEdit={view.canEdit} actions={actions} />
              <span className="canvas-pan-hint">
                <Icon name="move" />
                Pan with middle drag or Space + drag
              </span>
              <span className="mobile-pan-hint">
                <Icon name="move" />
                Swipe the soil to explore sideways
              </span>
            </div>
          </section>
        </div>
      </main>
      <BlockInspector view={view} actions={actions} />
      <div
        className={`toast ${view.toast ? "visible" : ""}`}
        id="toast"
        role="status"
        aria-live="polite"
      >
        {view.toast}
      </div>
      <HelpDialog actions={actions} canEdit={view.canEdit} />
      <ShareDialog view={view} actions={actions} />
      <CrewDialog view={view} actions={actions} />
      <DividerEditor view={view} actions={actions} />
      <ProjectDetailsDialog view={view} actions={actions} />
    </>
  );
}
