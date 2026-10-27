import { blockNumber } from "./project.js";
import { belowBlockTarget } from "./creation.js";

export function blockByNumber(project, value) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text) || !Number.isSafeInteger(Number(text))) return null;
  return project.blocks.find((block) => Number(blockNumber(block)) === Number(text)) ?? null;
}

export function nextBlockTarget(project, lastCreatedId) {
  const block = [lastCreatedId, project.selected].map((id) => project.blocks.find((b) => b.id === id && !b.done)).find(Boolean);
  return block ? belowBlockTarget(block) : null;
}

// World coordinates in, viewport coordinates out. This also works for holes,
// dividers, and future search results without depending on their DOM shape.
export function canvasTargetPlan(target, { width, height, worldLeft, zoom, fit = false, padding = 32 }) {
  const fittingZoom = Math.min((width - padding * 2) / target.width, (height - padding * 2) / target.height);
  const nextZoom = Math.max(0.6, Math.min(1.35, fit ? Math.min(1, fittingZoom) : Math.min(zoom, fittingZoom)));
  return {
    zoom: nextZoom,
    left: Math.max(0, (target.x - worldLeft + target.width / 2) * nextZoom - width / 2),
    top: Math.max(0, (target.y + target.height / 2) * nextZoom - height / 2),
  };
}
