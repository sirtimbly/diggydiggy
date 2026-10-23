import { useProjectShortcuts } from "./hooks/useProjectShortcuts.js";
import { Header } from "./components/Header.jsx";
import { Toolbar } from "./components/Toolbar.jsx";
import { ExcavationCanvas } from "./components/ExcavationCanvas.jsx";
import { BlockInspector } from "./components/BlockInspector.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { Icon } from "./components/Icon.jsx";

export default function App({ view, actions }) {
  useProjectShortcuts(actions);
  return (
    <>
      <Header storageAvailable={view.storageAvailable} actions={actions} />
      <main>
        <section className="project-heading" aria-labelledby="project-name">
          <div>
            <div className="project-title-line">
              <h1 id="project-name">Good things take digging.</h1>
              <span className="demo-label">DEMO PROJECT</span>
            </div>
            <p>
              No deadlines. No false precision. Just a team finding its way
              through the work.
            </p>
          </div>
          <button
            id="new-block"
            className="button primary"
            onClick={actions.openNew}
          >
            <Icon name="plus" />
            Add a block
          </button>
        </section>
        <div className="workbench">
          <section className="dig-panel" aria-label="Project excavation">
            <Toolbar view={view} actions={actions} />
            <ExcavationCanvas view={view} actions={actions} />
            <div className="dig-legend">
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
      <HelpDialog actions={actions} />
    </>
  );
}
