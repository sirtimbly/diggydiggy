import { PEOPLE } from "../project/project.js";
import { Icon, Sprite } from "./Icon.jsx";

export function CrewPalette({ view, actions }) {
  return (
    <aside
      className={`crew-panel ${view.crewCollapsed ? "is-collapsed" : ""}`}
      aria-label="Digging crew"
    >
      <div className="crew-tray-header">
        <h2>Crew</h2>
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
        {PEOPLE.map((person) => {
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
                title={`${person.name}: ${focus}. Drag onto a block.`}
                aria-pressed={view.selectedDigger === person.id}
                aria-label={`Assign ${person.name}. ${tasks.length} of 2 work sites. ${focus}`}
              >
                <Sprite person={person} />
                <span className="crew-copy">
                  <span className="crew-name">{person.name}</span>
                  <span className="crew-focus" title={focus}>
                    {focus}
                  </span>
                </span>
                <span className="crew-sites" aria-hidden="true">
                  {tasks.length}/2
                </span>
              </button>
              <i className="crew-color" style={{ background: person.shirt }} />
            </div>
          );
        })}
      </div>
    </aside>
  );
}
