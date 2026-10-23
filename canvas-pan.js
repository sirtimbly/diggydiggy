// A temporary navigation gesture that never edits the project underneath it.
export function installCanvasPanning(
  view,
  { onMove, onEnd = () => {}, canStart = () => true },
) {
  const doc = view.ownerDocument,
    win = doc.defaultView;
  let pan = null,
    space = false;
  const listeners = [];
  function listen(target, type, handler, capture = false) {
    target.addEventListener(type, handler, capture);
    listeners.push(() => target.removeEventListener(type, handler, capture));
  }
  const consume = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };
  function cursor() {
    view.classList.toggle("pan-ready", space);
    view.classList.toggle("is-panning", !!pan);
  }
  function finish() {
    if (!pan) return;
    const { id } = pan;
    pan = null;
    if (view.hasPointerCapture(id)) view.releasePointerCapture(id);
    onEnd();
    cursor();
  }
  function reset() {
    space = false;
    finish();
    cursor();
  }
  listen(
    doc,
    "keydown",
    (e) => {
      if (e.key === "Escape" && pan) {
        consume(e);
        reset();
        return;
      }
      if (e.code !== "Space" || e.altKey || e.ctrlKey || e.metaKey) return;
      const editable = e.target.closest(
        'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[role="textbox"]',
      );
      const outsideControl =
        e.target.closest('button,a,[role="button"]') &&
        !view.contains(e.target);
      if (
        editable ||
        outsideControl ||
        e.target.closest('[role="dialog"]') ||
        doc.querySelector("dialog[open]")
      )
        return;
      consume(e);
      space = true;
      cursor();
    },
    true,
  );
  listen(
    doc,
    "keyup",
    (e) => {
      if (e.code !== "Space" || !space) return;
      consume(e);
      space = false;
      if (pan?.button === 0) finish();
      cursor();
    },
    true,
  );
  listen(
    doc,
    "pointerdown",
    (e) => {
      if (
        !view.contains(e.target) ||
        (e.button !== 1 && !(e.button === 0 && space))
      )
        return;
      consume(e);
      if (pan || !canStart()) return;
      pan = { id: e.pointerId, button: e.button, x: e.clientX, y: e.clientY };
      view.setPointerCapture(e.pointerId);
      cursor();
    },
    true,
  );
  listen(
    doc,
    "pointermove",
    (e) => {
      if (!pan || e.pointerId !== pan.id) return;
      consume(e);
      const dx = e.clientX - pan.x,
        dy = e.clientY - pan.y;
      pan.x = e.clientX;
      pan.y = e.clientY;
      onMove(dx, dy);
    },
    true,
  );
  listen(
    doc,
    "pointerup",
    (e) => {
      if (pan?.id !== e.pointerId || pan.button !== e.button) return;
      consume(e);
      finish();
    },
    true,
  );
  listen(
    doc,
    "pointercancel",
    (e) => {
      if (pan?.id === e.pointerId) {
        consume(e);
        finish();
      }
    },
    true,
  );
  listen(view, "lostpointercapture", (e) => {
    if (pan?.id === e.pointerId) finish();
  });
  listen(view, "auxclick", (e) => {
    if (e.button === 1) consume(e);
  });
  listen(win, "blur", reset);
  listen(doc, "visibilitychange", () => {
    if (doc.hidden) reset();
  });
  return {
    get active() {
      return !!pan;
    },
    get ready() {
      return space;
    },
    dispose() {
      reset();
      listeners.splice(0).forEach((remove) => remove());
    },
  };
}
