export function wheelZoomPlan(zoom, event, view) {
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? view.clientHeight : 1;
  const next = Math.max(0.6, Math.min(1.35, zoom * Math.exp(-event.deltaY * multiplier * 0.002)));
  const rect = view.getBoundingClientRect();
  const x = Math.max(0, Math.min(view.clientWidth, event.clientX - rect.left));
  const y = Math.max(0, Math.min(view.clientHeight, event.clientY - rect.top));
  return { zoom: next, left: (view.scrollLeft + x) * next / zoom - x,
    top: (view.scrollTop + y) * next / zoom - y };
}

export function installCanvasZoom(view, { getZoom, setZoom, canZoom = () => true }) {
  const wheel = (event) => {
    if (!(event.metaKey || event.ctrlKey) || !Number.isFinite(event.deltaY) || !event.deltaY) return;
    // Own modified scrolling even at the limits, so browser page zoom cannot jump in.
    event.preventDefault();
    if (!canZoom()) return;
    const plan = wheelZoomPlan(getZoom(), event, view);
    setZoom(plan.zoom);
    view.scrollLeft = plan.left;
    view.scrollTop = plan.top;
  };
  view.addEventListener("wheel", wheel, { passive: false });
  return () => view.removeEventListener("wheel", wheel);
}
