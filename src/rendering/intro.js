import { blockDimensions, excavationRects } from "../../masonry.js";
import { hash, rng } from "./random.js";

export const INTRO_PIXEL = 4;
const clamp = (value) => Math.max(0, Math.min(1, value));
export const easeOut = (value) => 1 - (1 - clamp(value)) ** 3;
export function introFrame(elapsed, readyAt, reduced = false) {
  const ready = readyAt !== null;
  const burstAt = ready ? Math.max(2150, readyAt + 180) : Infinity;
  const burstTime = Math.max(0, elapsed - burstAt);
  return {
    pan: reduced ? 0 : easeOut((elapsed - 800) / 1250),
    bursting: !reduced && ready && elapsed >= burstAt,
    burstTime,
    dissolve: reduced ? ready ? clamp((elapsed - readyAt) / 160) : 0 : clamp((burstTime - 650) / 500),
    done: ready && elapsed >= (reduced ? readyAt + 160 : burstAt + 1250),
  };
}

// Screen rectangles derive from the same live bodies, open shafts and permanent
// cavities as the excavation renderer; this animation never changes project data.
export function introRects(project, { left, top, zoom, worldLeft, viewport }) {
  const bodies = project.blocks.filter((block) => !block.done).map((block) => {
    const [width, height] = blockDimensions(block);
    return { x: block.x, y: block.y, width, height, id: block.id };
  });
  const placements = new Map(bodies.map((body) => [body.id, { slot: body, y: body.y }]));
  return [...bodies, ...excavationRects(placements, project.excavations ?? [])].flatMap((rect) => {
    const x = Math.max(viewport.left, left + (rect.x - worldLeft) * zoom);
    const y = Math.max(viewport.top, top + rect.y * zoom);
    const right = Math.min(viewport.right, left + (rect.x - worldLeft + rect.width) * zoom);
    const bottom = Math.min(viewport.bottom, top + (rect.y + rect.height) * zoom);
    return right > x && bottom > y ? [{ x, y, width: right - x, height: bottom - y }] : [];
  });
}

export function dirtParticles(rectangles, limit = 620) {
  const points = new Map(), random = rng(73);
  for (const rect of rectangles) {
    // Sampling is bounded before allocation, even for unusually large screens.
    const step = Math.max(14, Math.ceil(Math.sqrt(rect.width * rect.height / 320)));
    for (let y = rect.y; y < rect.y + rect.height; y += step)
      for (let x = rect.x; x < rect.x + rect.width; x += step) {
        const key = `${Math.floor(x / 14)}:${Math.floor(y / 14)}`;
        if (points.has(key)) continue;
        const value = rng(hash(key))();
        points.set(key, { x: x + random() * step, y: y + random() * step, size: 4 + Math.floor(random() * 3) * 4,
          vx: (random() - .5) * 400, vy: -200 - random() * 420,
          delay: value * .16, color: ["#8c7452", "#605044", "#a18459", "#473a32", "#c3a276"][Math.floor(random() * 5)] });
      }
  }
  const all = [...points.values()];
  const stride = Math.max(1, Math.ceil(all.length / limit));
  return all.filter((_, index) => index % stride === 0).slice(0, limit);
}
