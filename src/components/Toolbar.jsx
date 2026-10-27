import { Icon } from "./Icon.jsx";
import { DIVIDER_COLORS, DIVIDER_LIMIT } from "../project/dividers.js";
import { ClearedMenu } from "./ClearedMenu.jsx";
import { ProjectTitle } from "./ProjectTitle.jsx";

export function Toolbar({ view, actions }) {
  return (
    <div className="dig-toolbar">
      <div className="excavation-tools">
        <h1 className="board-project-title"><ProjectTitle project={view.state} canEdit={view.canEdit} actions={actions} /></h1>
        {!view.isShared && <span className="demo-label">DEMO PROJECT</span>}
        <span className="project-presence">
          <span className="status-dot" />
          <span id="active-count">{view.activeCount}</span> at work
        </span>
        <ClearedMenu view={view} actions={actions} />
        <details className="dividers-menu">
          <summary><Icon name="divider" /><span>Phases</span><span className="phase-count">{view.state.dividers?.length || ""}</span></summary>
          <div className="dividers-list">
            <p>Rough boundaries, no deadlines.</p>
            {(view.state.dividers ?? []).slice().sort((a,b) => a.y-b.y).map((divider) => <button key={divider.id} type="button" className="divider-entry" disabled={!view.canEdit} onClick={(event) => actions.openDivider(divider.id,event.currentTarget)}>
              <i style={{background:DIVIDER_COLORS[divider.color].ink}} /><span>{divider.label}</span><Icon name="edit" />
            </button>)}
            <button id="new-divider" type="button" className="divider-add" disabled={!view.canEdit || (view.state.dividers?.length ?? 0)>=DIVIDER_LIMIT} onClick={actions.openNewDivider}><Icon name="plus" />Add a divider</button>
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
          disabled={!view.canEdit || !view.history.canUndo || view.mode !== "inspect" || Boolean(view.dividerEditor)}
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
          disabled={!view.canEdit || !view.history.canRedo || view.mode !== "inspect" || Boolean(view.dividerEditor)}
          onClick={actions.redo}
        >
          <Icon name="redo" />
        </button>
        <button id="new-block" className="button primary toolbar-add" aria-label="Add a block" disabled={!view.canEdit} title={view.canEdit ? "Add a block" : "Sign in to add blocks"} onClick={actions.openNew}>
          <Icon name="plus" />Add block
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
        <output id="zoom-level" title="Hold ⌘ or Ctrl and scroll over the excavation to zoom">{Math.round(view.zoom * 100)}%</output>
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
