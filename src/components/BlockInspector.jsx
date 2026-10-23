import { SIZES, dependenciesOf, canAddDependency } from "../../masonry.js";
import { PEOPLE } from "../project/project.js";
import { Icon, Sprite } from "./Icon.jsx";
import { BlockForm } from "./BlockForm.jsx";

const uncertaintyName = (value) => `${Math.round((value / 48) * 100)}% unknown`;

export function BlockInspector({ view, actions }) {
  const b = view.getBlock(view.state.selected);
  return (
    <section
      id="inspector-popup"
      className="inspector-popup"
      popover="auto"
      role="dialog"
      aria-label="Block details"
      tabIndex="-1"
    >
      <div className="popup-chrome">
        <span>Block details</span>
        <button
          id="inspector-close"
          className="icon-button"
          aria-label="Close block details"
          onClick={() => actions.closeInspector(true)}
        >
          <Icon name="close" />
        </button>
      </div>
      <div id="inspector" className="inspector" aria-label="Selected block">
        {view.mode === "new" || view.mode === "edit" ? (
          <BlockForm
            key={`${view.mode}:${b?.id ?? ""}`}
            block={view.mode === "edit" ? b : null}
            actions={actions}
          />
        ) : b ? (
          <BlockDetails block={b} view={view} actions={actions} />
        ) : (
          <div className="inspector-empty">
            <Icon name="rock" />
            <h2>What’s under here?</h2>
            <p>
              Select a block to explore its scope,
              <br />
              progress, and people.
            </p>
            <button className="button" onClick={actions.openNew}>
              <Icon name="plus" />
              Add a block
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

function BlockDetails({ block: b, view, actions }) {
  const blocked = view.isBlocked(b);
  return (
    <>
      <div className="inspector-header">
        <span>
          {b.code} /{" "}
          {b.done
            ? "CLEARED"
            : blocked
              ? "WAITING"
              : b.people.length
                ? "IN THE WORKS"
                : "UNEXPLORED"}
        </span>
        <button
          className="icon-button"
          id="edit-block"
          aria-label="Edit block"
          onClick={actions.editBlock}
        >
          <Icon name="edit" />
        </button>
      </div>
      <h2>{b.title}</h2>
      <p className="task-note">{b.note}</p>
      <section className="inspector-section">
        <div className="field-label">
          <span>A little progress</span>
          <output>{b.progress}%</output>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-label="Reported progress"
          aria-valuenow={b.progress}
          aria-valuemin="0"
          aria-valuemax="100"
        >
          <div style={{ width: `${b.progress}%` }} />
        </div>
        <div className="progress-label">
          <span>
            {b.done
              ? "Out of the ground."
              : blocked
                ? view.blockedReason(b)
                : "Every chip counts."}
          </span>
          <Icon name={b.done ? "check" : "pick"} />
        </div>
        <div className="progress-actions">
          <button
            className="button primary"
            id="chip-block"
            disabled={b.done || blocked}
            onClick={() => actions.changeProgress(b, 10)}
          >
            <Icon name="pick" />
            Chip away +10%
          </button>
          <button
            className="button"
            id="undo-chip"
            aria-label="Reduce progress by 10 percent"
            disabled={!b.progress || b.done}
            onClick={() => actions.changeProgress(b, -10)}
          >
            <Icon name="undo" />
          </button>
        </div>
        {b.done ? (
          <button
            className="text-button"
            id="reopen-block"
            style={{ marginTop: 12 }}
            onClick={() => actions.reopenBlock(b)}
          >
            Put back in the ground
          </button>
        ) : (
          <p className="section-caption">
            You set the progress. The pickaxe just shows someone is here.
          </p>
        )}
      </section>
      <section className="inspector-section">
        <div className="field-label">
          <label htmlFor="uncertainty">Room for the unknown</label>
          <output id="uncertainty-value">
            {uncertaintyName(b.uncertainty)}
          </output>
        </div>
        <input
          type="range"
          id="uncertainty"
          onPointerDown={actions.beginEdit}
          onPointerUp={actions.endEdit}
          onPointerCancel={actions.endEdit}
          onKeyDown={(event) => {
            if (
              [
                "ArrowLeft",
                "ArrowRight",
                "ArrowUp",
                "ArrowDown",
                "Home",
                "End",
                "PageUp",
                "PageDown",
              ].includes(event.key)
            )
              actions.beginEdit();
          }}
          onKeyUp={actions.endEdit}
          onBlur={actions.endEdit}
          min="0"
          max="48"
          step="4"
          aria-valuetext={uncertaintyName(b.uncertainty)}
          value={b.uncertainty}
          disabled={b.done}
          onChange={(event) =>
            actions.setUncertainty(b, +event.currentTarget.value)
          }
        />
        <div className="range-ends">
          <span>Well understood</span>
          <span>Still a mystery</span>
        </div>
        <p className="section-caption">
          The dithered gap is scope we haven’t uncovered. More uncertainty hides
          more of the block.
        </p>
      </section>
      <section className="inspector-section">
        <div className="field-label">
          Digging here{" "}
          <span>
            {b.people.length} {b.people.length === 1 ? "person" : "people"}
          </span>
        </div>
        {b.people.length ? (
          b.people.map((id) => {
            const person = PEOPLE.find((p) => p.id === id);
            return (
              <div className="assigned-person" key={id}>
                <Sprite person={person} />
                <span>{person.name}</span>
                <button
                  className="icon-button"
                  data-unassign={id}
                  aria-label={`Remove ${person.name} from this block`}
                  onClick={() => actions.unassign(b, id)}
                >
                  <Icon name="close" />
                </button>
              </div>
            );
          })
        ) : (
          <p className="assignment-empty">
            {b.done ? "A job well dug." : "A quiet spot. Bring a digger over."}
          </p>
        )}
        {!b.done && (
          <select
            className="assign-select"
            id="assign-person"
            aria-label="Assign a digger"
            value=""
            onChange={(event) =>
              event.currentTarget.value &&
              actions.assignPerson(event.currentTarget.value, b.id)
            }
          >
            <option value="">+ Add a digger</option>
            {PEOPLE.filter((p) => !b.people.includes(p.id)).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
      </section>
      <details
        className="inspector-more"
        open={view.inspectorMoreOpen}
        onToggle={(event) => actions.setInspectorMore(event.currentTarget.open)}
      >
        <summary>
          Size &amp; prerequisites{" "}
          <span>
            <Icon name="plus" />
          </span>
        </summary>
        <section className="inspector-section">
          <div className="field-label">
            The part we know{" "}
            <output id="size-kind">
              {b.width !== undefined || b.height !== undefined ? "Custom" : ""}
            </output>
          </div>
          <div
            className="size-options"
            role="group"
            aria-label="Known block size"
          >
            {Object.keys(SIZES).map((size) => {
              const selected =
                b.width === undefined &&
                b.height === undefined &&
                b.size === size;
              return (
                <button
                  key={size}
                  className={`size-option ${selected ? "active" : ""}`}
                  data-size={size}
                  aria-pressed={selected}
                  disabled={b.done}
                  onClick={() => actions.setSize(b, size)}
                >
                  {size[0].toUpperCase() + size.slice(1)}
                </button>
              );
            })}
          </div>
          <p className="section-caption">
            Drag any edge or corner to reshape the block.
          </p>
        </section>
        <section className="inspector-section">
          <div className="field-label">
            Prerequisites <span>{dependenciesOf(b).length}</span>
          </div>
          <div className="dependency-list">
            {dependenciesOf(b).length ? (
              dependenciesOf(b).map((id) => (
                <div className="dependency-row" key={id}>
                  <span>
                    {view.getBlock(id)?.title ?? "Removed work"}
                    {view.getBlock(id)?.done ? " · cleared" : ""}
                  </span>
                  <button
                    className="icon-button"
                    data-remove-dependency={id}
                    aria-label={`Remove dependency on ${view.getBlock(id)?.title ?? "removed work"}`}
                    disabled={b.done}
                    onClick={() => actions.removeDependency(b, id)}
                  >
                    <Icon name="close" />
                  </button>
                </div>
              ))
            ) : (
              <p className="assignment-empty">
                This work can start independently.
              </p>
            )}
          </div>
          <label
            htmlFor="dependency"
            className="field-label dependency-add-label"
          >
            Add a prerequisite
          </label>
          <select
            className="assign-select dependency-select"
            id="dependency"
            disabled={b.done}
            value=""
            onChange={(event) =>
              event.currentTarget.value &&
              actions.addDependency(event.currentTarget.value, b.id)
            }
          >
            <option value="">+ Link a block</option>
            {view.state.blocks
              .filter((a) => canAddDependency(view.state.blocks, a.id, b.id).ok)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.done ? " (cleared)" : ""}
                </option>
              ))}
          </select>
          <p className="section-caption">
            Or drag a block’s lower link dot onto the work that depends on it.
            Prerequisites always stay above.
          </p>
        </section>
      </details>
      <div className="inspector-bottom">
        <p className="inspector-footnote">
          A block has a shape, not a schedule.
          <br />
          Move it as your understanding changes.
        </p>
      </div>
    </>
  );
}
