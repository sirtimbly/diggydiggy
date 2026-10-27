export const CREW_POSITION_KEY = "diggy-crew-position-v1";
const clamp = (value, max) => Math.max(8, Math.min(Math.max(8, max), value));

// Palette position is a browser preference in screen pixels, never world data.
// Store fractions of available travel so the palette stays reachable on resize.
export function installCrewPaletteDrag(panel, header, handle, storage) {
  const stage = panel.parentElement, win = panel.ownerDocument.defaultView;
  const listeners = [];
  let preferred = null, position, drag = null, disposed = false;
  try {
    const saved = JSON.parse(storage?.getItem(CREW_POSITION_KEY) ?? "null");
    if (saved?.version === 1 && [saved.x, saved.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)) preferred = saved;
  } catch { /* The palette still moves when storage is unavailable. */ }
  const limits = () => ({ x: Math.max(0, stage.clientWidth - panel.offsetWidth - 16),
    y: Math.max(0, stage.clientHeight - panel.offsetHeight - 16) });
  function place(x, y) {
    if (disposed) return;
    position = { x: clamp(x, stage.clientWidth - panel.offsetWidth - 8),
      y: clamp(y, stage.clientHeight - panel.offsetHeight - 8) };
    panel.style.left = `${position.x}px`;
    panel.style.top = `${position.y}px`;
    panel.dispatchEvent(new win.Event("crew-palette-move"));
  }
  function refresh() {
    if (drag) finish(false);
    const range = limits();
    place(preferred ? 8 + preferred.x * range.x : win.innerWidth <= 680 ? 8 : 12,
      preferred ? 8 + preferred.y * range.y : 10);
  }
  function remember() {
    const range = limits();
    preferred = { version: 1, x: range.x ? (position.x - 8) / range.x : 0,
      y: range.y ? (position.y - 8) / range.y : 0 };
    try { storage?.setItem(CREW_POSITION_KEY, JSON.stringify(preferred)); } catch { /* Retain this tab's position in memory. */ }
  }
  function listen(target, type, fn) {
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener(type, fn));
  }
  function finish(commit, event) {
    if (!drag || (event && event.pointerId !== drag.id)) return;
    const previous = drag; drag = null;
    delete panel.dataset.moving;
    if (commit && previous.moved) remember();
    else { preferred = previous.preferred; place(previous.origin.x, previous.origin.y); }
    if (header.hasPointerCapture(previous.id)) header.releasePointerCapture(previous.id);
  }
  listen(header, "pointerdown", (event) => {
    if (drag || event.button !== 0 || event.isPrimary === false || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest("button,a,input") && !event.target.closest(".crew-drag-handle")) return;
    event.preventDefault(); event.stopPropagation();
    handle.focus({ preventScroll: true });
    drag = { id: event.pointerId, startX: event.clientX, startY: event.clientY,
      origin: { ...position }, preferred, moved: false };
    header.setPointerCapture(event.pointerId);
  });
  listen(header, "pointermove", (event) => {
    if (!drag || event.pointerId !== drag.id) return;
    const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    event.preventDefault(); event.stopPropagation();
    drag.moved = true; panel.dataset.moving = "true";
    place(drag.origin.x + dx, drag.origin.y + dy);
  });
  listen(header, "pointerup", (event) => finish(true, event));
  listen(header, "pointercancel", (event) => finish(false, event));
  listen(header, "lostpointercapture", (event) => finish(false, event));
  listen(handle, "keydown", (event) => {
    if (event.key === "Escape" && drag) {
      event.preventDefault(); event.stopPropagation(); finish(false); return;
    }
    if (drag || event.metaKey || event.ctrlKey || event.altKey) return;
    const vector = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!vector && event.key !== "Home") return;
    event.preventDefault(); event.stopPropagation();
    if (event.key === "Home") {
      preferred = null;
      try { storage?.removeItem(CREW_POSITION_KEY); } catch { /* Reset still works in memory. */ }
      refresh(); return;
    }
    const step = event.shiftKey ? 32 : 8;
    place(position.x + vector[0] * step, position.y + vector[1] * step); remember();
  });
  listen(win, "blur", () => finish(false));
  listen(panel.ownerDocument, "visibilitychange", () => { if (panel.ownerDocument.hidden) finish(false); });
  listen(win, "resize", refresh);
  const observer = new win.ResizeObserver(refresh);
  observer.observe(stage); observer.observe(panel);
  refresh();
  return () => {
    finish(false); disposed = true;
    observer.disconnect(); listeners.forEach((remove) => remove());
  };
}
