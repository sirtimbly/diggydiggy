import { Icon } from "./Icon.jsx";

export function Toolbar({ view, actions }) {
  const done = view.state.blocks.filter((b) => b.done);
  return (
    <div className="dig-toolbar">
      <div className="excavation-tools">
        <h2>The next release</h2>
        <span className="project-presence">
          <span className="status-dot" />
          <span id="active-count">{view.activeCount}</span> at work
        </span>
        <details className="cleared-menu">
          <summary>
            Cleared <span id="cleared-count">{done.length}</span>
          </summary>
          <div id="cleared-list">
            {done.length ? (
              done.map((b) => (
                <button
                  key={b.id}
                  className="cleared-entry"
                  data-cleared={b.id}
                >
                  <Icon name="check" />
                  <span>{b.title}</span>
                </button>
              ))
            ) : (
              <p className="cleared-empty">The first breakthrough is ahead.</p>
            )}
          </div>
        </details>
      </div>
      <div className="view-actions">
        <button
          className="icon-button"
          id="undo-edit"
          aria-label="Undo last edit"
          title={
            view.history.canUndo
              ? `Undo: ${view.history.undoLabel} (⌘/Ctrl+Z)`
              : "Undo (⌘/Ctrl+Z)"
          }
          disabled={!view.history.canUndo || view.mode !== "inspect"}
          onClick={actions.undo}
        >
          <Icon name="undo" />
        </button>
        <button
          className="icon-button"
          id="redo-edit"
          aria-label="Redo last edit"
          title={
            view.history.canRedo
              ? `Redo: ${view.history.redoLabel} (⌘/Ctrl+Y)`
              : "Redo (⌘/Ctrl+Y or ⇧⌘/Ctrl+Z)"
          }
          disabled={!view.history.canRedo || view.mode !== "inspect"}
          onClick={actions.redo}
        >
          <Icon name="redo" />
        </button>
        <span className="toolbar-divider" />
        <button
          className="icon-button"
          id="zoom-out"
          disabled={view.zoom <= 0.6}
          aria-label="Zoom out"
          onClick={actions.zoomOut}
        >
          <Icon name="minus" />
        </button>
        <output id="zoom-level">{Math.round(view.zoom * 100)}%</output>
        <button
          className="icon-button"
          id="zoom-in"
          disabled={view.zoom >= 1.35}
          aria-label="Zoom in"
          onClick={actions.zoomIn}
        >
          <Icon name="plus" />
        </button>
        <span className="toolbar-divider" />
        <button
          className="icon-button"
          id="fit-view"
          aria-label="Return to starting ground"
          title="Return to starting ground"
          onClick={actions.resetView}
        >
          <Icon name="fit" />
        </button>
      </div>
    </div>
  );
}
