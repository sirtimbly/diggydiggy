import { useEffect, useRef, useState } from "react";
import { BlockColorPicker } from "./BlockColorPicker.jsx";
import { Icon } from "./Icon.jsx";

export function BlockForm({ block, initialColor, actions, project }) {
  const [color, setColor] = useState(block?.color ?? initialColor ?? "amber");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleInput = useRef(null);
  useEffect(() => {
    titleInput.current?.focus({ preventScroll: true });
  }, []);
  function submit(event) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!data.get("title").trim()) {
      titleInput.current.setCustomValidity("Give the work a name.");
      titleInput.current.reportValidity();
      return;
    }
    actions.saveBlock(block?.id, {
      title: data.get("title").trim(),
      note: data.get("note").trim(),
      color,
    });
  }
  return (
    <>
      <div className="inspector-header">
        <span>{block ? "RESHAPE THE WORK" : "SOMETHING TO UNCOVER"}</span>
        <button
          className="icon-button"
          id="cancel-form"
          aria-label="Cancel editing"
          onClick={actions.cancelForm}
        >
          <Icon name="close" />
        </button>
      </div>
      <BlockColorPicker project={project} color={color} onChange={(next) => { setColor(next); actions.rememberBlockColor(next); }} />
      <h2>{block ? "A clearer picture." : "Plant a new block."}</h2>
      <p className="task-note">
        Start with what you know. Leave some room for what you don’t.
      </p>
      <form id="block-form" onSubmit={submit}>
        <label className="field-label" htmlFor="block-title">
          What’s the work?
        </label>
        <input
          ref={titleInput}
          autoFocus
          className="field-input"
          id="block-title"
          name="title"
          maxLength="65"
          required
          placeholder="Give this block a name"
          defaultValue={block?.title ?? ""}
          onInput={(event) => event.currentTarget.setCustomValidity("")}
        />
        <label className="field-label" htmlFor="block-note">
          A little context
        </label>
        <textarea
          className="field-input"
          id="block-note"
          name="note"
          maxLength="600"
          placeholder="What do we know so far?"
          defaultValue={block?.note ?? ""}
        />
        <input type="hidden" name="color" value={color} />
        <button className="button primary" type="submit">
          <Icon name={block ? "check" : "plus"} />
          {block ? "Save changes" : "Add to the ground"}
        </button>
        {block && (
          <div>
            <button
              type="button"
              className="text-button delete-button"
              id="delete-block"
              onClick={() =>
                confirmDelete
                  ? actions.deleteBlock(block.id)
                  : setConfirmDelete(true)
              }
            >
              {confirmDelete
                ? "Remove it? Click again to confirm"
                : "Remove this block"}
            </button>
          </div>
        )}
      </form>
    </>
  );
}
