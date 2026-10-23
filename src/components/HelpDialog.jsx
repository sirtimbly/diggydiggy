import { useState } from "react";
import { Icon } from "./Icon.jsx";

export function HelpDialog({ actions }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <dialog id="help-dialog">
      <form method="dialog">
        <button className="icon-button dialog-close" aria-label="Close help">
          <Icon name="close" />
        </button>
        <span className="help-pick" data-icon="pick"></span>
        <h2>Welcome to the dig.</h2>
        <p>
          A project is ground to explore. Some work is clear; some disappears
          into an unknown middle. Depth shows what comes next, without turning
          it into a deadline.
        </p>
        <ul>
          <li>
            <strong>Change your mind.</strong> Use ⌘/Ctrl+Z to undo and ⌘/Ctrl+Y
            or Shift+⌘/Ctrl+Z to redo a project edit. The toolbar arrows do the
            same. A drag or uncertainty gesture is one edit. Text fields keep
            their normal undo history. Selecting, panning, zooming, and ambient
            animations do not enter project history.
          </li>
          <li>
            <strong>Explore the ground.</strong> Hold the middle mouse button
            and drag, or hold Space and drag with the left button, anywhere on
            the excavation. Release to return to moving blocks. You can pan
            across fresh ground sideways and downward, or use the mouse wheel to
            scroll the excavation. Space works normally while editing text.
          </li>
          <li>
            <strong>Move the work.</strong> Drag a block to reorder the contact
            stack. The outline previews where it will snap, and nearby blocks
            make room. Bounds fit the colored box exactly, and edges snap
            together. Hold near a side or the bottom of the ground to keep
            scrolling into new columns or deeper; the world expands as needed.
            The reset-view control returns to the starting ground. With a block
            focused, left/right arrows change its column; up/down arrows change
            its order. Shift takes bigger steps.
          </li>
          <li>
            <strong>Connect the work.</strong> Drag the lower link dot on a
            prerequisite onto the block that depends on it. Or select the dot,
            then select the dependent block. Arrows flow from prerequisite to
            dependent. Multiple prerequisites are supported; loops are rejected.
            Linked work always stays below its prerequisites, even while moving
            or resizing. Remove links in the inspector.
          </li>
          <li>
            <strong>Follow the focus.</strong> Use the small Crew palette at the
            top-left of the canvas. Drag a digger onto a block, or select a
            digger and click a block. The minus button collapses the palette.
            Each person can work in two places. Drag a placed digger to move
            that work site.
          </li>
          <li>
            <strong>Reshape the work.</strong> Drag any edge or corner to resize
            a block. Focus a handle and use arrow keys to resize with the
            keyboard; Shift takes bigger steps. The solid stack snaps around the
            new size without adding padding. Click a block to open its compact
            details window. Close it with Escape, the close button, or a click
            outside. Adjust its uncertainty there. The color fades out through
            pixel dithering, then returns at the bottom edge. Higher uncertainty
            hides more of the middle.
          </li>
          <li>
            <strong>Make a little progress.</strong> Update progress
            deliberately. Diggers show activity with independent pickaxe
            rhythms, occasional coffee or phone pauses, and short walks along
            the exposed ledge. Edge-rooted, branching cracks show reported
            progress. Extracted blocks leave permanent cavities. Adjacent
            cavities join into a larger hole. Shafts above exposed stone are
            empty. Buried assignments wait until the work above is removed;
            diggers stand on exposed top faces. Depth is sequence, not time.
          </li>
        </ul>
        <p className="help-note">
          This is a local prototype with sample people and tasks. Changes stay
          in this browser. Shared live collaboration is a future step.
        </p>
        <button className="button primary">Let’s dig</button>
      </form>
      <div id="help-reset-container">
        <button
          className="text-button"
          id="help-reset"
          onClick={() => setConfirming(true)}
        >
          Reset demo
        </button>
        {confirming && (
          <div>
            <p className="reset-question">
              Replace local changes with the demo?
            </p>
            <div className="reset-row">
              <button
                className="button"
                id="confirm-reset"
                onClick={() => {
                  actions.resetDemo();
                  setConfirming(false);
                }}
              >
                Reset
              </button>
              <button
                className="text-button"
                id="cancel-reset"
                onClick={() => setConfirming(false)}
              >
                Keep digging
              </button>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
