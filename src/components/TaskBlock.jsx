import { blockDimensions } from "../../masonry.js";
import { PALETTE, PEOPLE } from "../project/project.js";
import { Icon, Sprite } from "./Icon.jsx";

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

export function TaskBlock({ block: b, view }) {
  const [width, height] = blockDimensions(b);
  const diggers = view.placedDiggers(b);
  const blocked = view.isBlocked(b),
    waiting = view.waitingDependencies(b);
  const status = blocked
    ? waiting.length
      ? "Waiting to uncover"
      : "Buried surface"
    : b.people.length
      ? b.people.length === 1
        ? "Digging in"
        : "Digging together"
      : "Ready to explore";
  const accessibleStatus = blocked
    ? waiting.length
      ? `Waiting on ${waiting.map((id) => view.getBlock(id)?.title ?? "").join(", ")}`
      : "Buried beneath overhead work"
    : "Ready";
  return (
    <div
      className={`task-block ${diggers.length ? "" : "is-idle"} ${b.uncertainty ? "has-unknown" : ""} ${view.state.selected === b.id ? "is-selected" : ""}`}
      data-block={b.id}
      style={{
        left: b.x - view.world.left,
        top: b.y,
        width,
        height,
        "--block": PALETTE[b.color].fill,
        "--shade": PALETTE[b.color].shade,
      }}
    >
      <div className="block-surface">
        <div className="block-decoration" />
        <canvas className="crack-canvas" aria-hidden="true" />
      </div>
      <button
        className="block-hit"
        aria-label={`${b.code}: ${b.title}. ${b.progress}% complete. ${Math.round((b.uncertainty / 48) * 100)}% unknown. ${accessibleStatus}.`}
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
        <span className="block-id">{b.code}</span>
        <span className="block-name">{b.title}</span>
        <span className="block-status">
          {blocked ? (
            <Icon name="lock" />
          ) : b.people.length ? (
            <Icon name="pick" />
          ) : null}
          {status}
        </span>
      </div>
      {b.progress > 0 && <span className="block-progress">{b.progress}%</span>}
      <div className="block-diggers">
        {diggers.map(({ id, x, min, max }) => {
          const person = PEOPLE.find((p) => p.id === id);
          return (
            <button
              key={id}
              className="block-digger"
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
      {Object.entries(edges).map(([edge, name]) => (
        <button
          key={edge}
          className={`resize-handle resize-${edge}`}
          data-resize={edge}
          aria-label={`Resize ${name} of ${b.title}`}
          title={`Drag to resize ${name}. Arrow keys resize; Shift takes bigger steps.`}
        />
      ))}
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
    </div>
  );
}
