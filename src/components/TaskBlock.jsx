import { blockDimensions } from "../../masonry.js";
import { blockTextColor, projectPalette } from "../project/color-legend.js";
import { blockNumber } from "../project/project.js";
import { Icon, Sprite } from "./Icon.jsx";
import { RemoteSelection } from "./Collaborators.jsx";
import { BlockBarrier } from "./BlockBarrier.jsx";

const edges = {
  n: "top",
  s: "bottom",
  e: "right",
  w: "left",
  nw: "top left corner",
  ne: "top right corner",
  sw: "bottom left corner",
  se: "bottom right corner",
};

export function TaskBlock({ block: b, view, actions }) {
  const palette = projectPalette(view.state);
  const [width, height] = blockDimensions(b);
  const diggers = view.placedDiggers(b);
  const blocked = view.isBlocked(b),
    waiting = view.waitingDependencies(b);
  const accessibleStatus = b.blocked ? "Blocked. Diggers unassigned" : blocked
    ? waiting.length
      ? `Waiting on ${waiting.map((id) => view.getBlock(id)?.title ?? "").join(", ")}`
      : "Buried beneath overhead work"
    : "Ready";
  return (
    <div
      className={`task-block ${b.blocked ? "is-manually-blocked" : ""} ${blocked ? "is-unavailable" : ""} ${b.uncertainty ? "has-unknown" : ""} ${view.state.selected === b.id ? "is-selected" : ""}`}
      data-block={b.id}
      style={{
        left: b.x - view.world.left,
        top: b.y,
        width,
        height,
        color: blockTextColor(palette[b.color].fill),
        "--block": palette[b.color].fill,
        "--shade": palette[b.color].shade,
        "--add-scale": 1 / Math.min(1, view.zoom),
      }}
    >
      <RemoteSelection blockId={b.id} presence={view.presence} />
      <div className="block-surface">
        <div className="block-decoration" />
        <canvas className="crack-canvas" aria-hidden="true" />
      </div>
      <button
        className="block-hit"
        aria-label={`${blockNumber(b)}: ${b.title}. ${b.progress}% complete. ${Math.round((b.uncertainty / 48) * 100)}% unknown. ${accessibleStatus}.`}
        style={{
          position: "absolute",
          inset: 0,
          background: "none",
          border: 0,
          cursor: "inherit",
          zIndex: 3,
        }}
      />
      <div className="task-content">
        <span className="block-id">{blockNumber(b)}</span>
        <span className="block-name">{b.title}</span>
      </div>
      {b.progress > 0 && <span className="block-progress">{b.progress}%</span>}
      {b.blocked && <BlockBarrier />}
      <div className="block-diggers">
        {diggers.map(({ id, x, min, max }) => {
          const person = view.state.crew.find((p) => p.id === id);
          return (
            <button
              key={id}
              className="block-digger"
              disabled={!view.canEdit}
              style={{ left: x }}
              data-walk-min={min}
              data-walk-max={max}
              data-digger={id}
              data-source={b.id}
              aria-label={`${person.name}, working on ${b.title}. Select to assign another work site.`}
            >
              <Sprite person={person} working={!blocked} />
              <span className="digger-label">{person.name}</span>
            </button>
          );
        })}
      </div>
      {view.canEdit && Object.entries(edges).map(([edge, name]) => (
        <button
          key={edge}
          className={`resize-handle resize-${edge}`}
          data-resize={edge}
          aria-label={`Resize ${name} of ${b.title}`}
          title={`Drag to resize ${name}. Arrow keys resize; Shift takes bigger steps.${edge === "w" || edge === "e" ? " Double-click or press Enter to grow to the next block edge." : ""}`}
        />
      ))}
      {view.canEdit && <><button
        className="canvas-add block-add-below"
        type="button"
        aria-label={`Add ${palette[b.color].name.toLowerCase()} block below ${b.title}`}
        title={`Add ${palette[b.color].name.toLowerCase()} block below`}
        onPointerDown={(event) => { if (event.button === 0) event.stopPropagation(); }}
        onClick={(event) => { event.stopPropagation(); actions.addBelow(b.id); }}
      >
        <Icon name="plus" />
      </button>
      <button
        className="dependency-port dependency-in"
        data-link-in={b.id}
        aria-label={`Link a prerequisite to ${b.title}`}
        title="Drop a prerequisite line here"
      >
        <span />
      </button>
      <button
        className="dependency-port dependency-out"
        data-link-out={b.id}
        aria-label={`Draw dependency from ${b.title}`}
        title="Drag to work that depends on this block"
      >
        <Icon name="link" />
      </button>
      </>}
    </div>
  );
}
