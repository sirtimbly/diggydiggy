import { activeCrew, placementLimit } from "../project/crew.js";
import { PlacementSlots } from "./PlacementSlots.jsx";
import { Icon, Sprite } from "./Icon.jsx";
import { useLayoutEffect, useRef } from "react";
import { installCrewPaletteDrag } from "../../crew-palette-drag.js";

export function CrewPalette({ view, actions }) {
  const limit = placementLimit(view.state);
  const panel = useRef(null), header = useRef(null), handle = useRef(null);
  useLayoutEffect(() => installCrewPaletteDrag(panel.current, header.current, handle.current, {
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
    removeItem: (key) => localStorage.removeItem(key),
  }), []);
  return (
    <aside
      ref={panel}
      className={`crew-panel ${view.crewCollapsed ? "is-collapsed" : ""}`}
      aria-label="Digging crew"
    >
      <div ref={header} className="crew-tray-header">
        <h2><button ref={handle} className="crew-drag-handle" type="button" aria-label="Move crew palette"
          aria-describedby="crew-move-hint" title="Drag to move · Arrow keys adjust · Home resets">
          <Icon name="move" /><span>Crew</span>
        </button></h2>
        <span className="sr-only" id="crew-move-hint">Drag the header to move the crew palette. Arrow keys move it; hold Shift for larger steps. Home resets its position. Escape cancels a drag.</span>
        <button id="manage-crew" className="icon-button" aria-label="Manage crew" title={view.canEdit ? "Manage crew" : "Sign in to manage crew"} disabled={!view.canEdit} onClick={actions.openCrew}>
          <Icon name="crew" />
        </button>
        <button
          id="crew-toggle"
          className="icon-button"
          aria-label={view.crewCollapsed ? "Show crew" : "Hide crew"}
          aria-expanded={!view.crewCollapsed}
          aria-controls="crew-list"
          title={
            view.crewCollapsed ? "Show crew palette" : "Collapse crew palette"
          }
          onClick={actions.toggleCrew}
        >
          <Icon name={view.crewCollapsed ? "plus" : "minus"} />
        </button>
      </div>
      <div id="crew-list" hidden={view.crewCollapsed}>
        {!activeCrew(view.state).length && <button className="crew-empty" disabled={!view.canEdit} onClick={actions.openCrew}>Add your first digger</button>}
        {activeCrew(view.state).map((person) => {
          const tasks = view.state.blocks.filter(
            (b) => !b.done && b.people.includes(person.id),
          );
          const focus = tasks.length
            ? tasks.map((b) => b.title).join(" + ")
            : "Ready for a new dig";
          return (
            <div className="crew-person" key={person.id}>
              <button
                className={`crew-button ${view.selectedDigger === person.id ? "selected-digger" : ""}`}
                data-digger={person.id}
                disabled={!view.canEdit}
                title={`${person.name}: ${focus}. Drag onto a block.`}
                aria-pressed={view.selectedDigger === person.id}
                aria-label={`Assign ${person.name}. ${tasks.length} of ${limit} placement slots used. ${focus}`}
              >
                <Sprite person={person} />
                <span className="crew-copy">
                  <span className="crew-name">{person.name}</span>
                  <span className="crew-focus" title={focus}>
                    {focus}
                  </span>
                </span>
                <PlacementSlots used={tasks.length} limit={limit} decorative />
              </button>
              <i className="crew-color" style={{ background: person.shirt }} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
