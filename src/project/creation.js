import { MASONRY, SIZES, RESIZE_LIMITS, blockDimensions, dependencyOrder } from "../../masonry.js";

const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x;
const bodies = (project) => [
  ...project.blocks.filter((b) => !b.done).map((b) => {
    const [width, height] = blockDimensions(b);
    return { x: b.x, y: b.y, width, height };
  }),
  ...(project.excavations ?? []),
];

export function belowBlockTarget(block) {
  const [width, height] = blockDimensions(block);
  return { x: block.x, y: block.y + height, width, color: block.color, afterId: block.id };
}

// Follow the stone under the pointer, or the clear horizontal gap beside it.
// Completed footprints still reserve their ground.
export function dirtColumnTarget(project, x) {
  if (!Number.isFinite(x)) return null;
  const occupied = bodies(project);
  const support = occupied.filter((b) => b.x <= x && x < b.x + b.width)
    .sort((a, b) => b.y + b.height - a.y - a.height)[0];
  let left, width;
  if (support) { left = support.x; width = support.width; }
  else {
    const start = Math.max(-Infinity, ...occupied.filter((b) => b.x + b.width <= x).map((b) => b.x + b.width));
    const end = Math.min(Infinity, ...occupied.filter((b) => b.x > x).map((b) => b.x));
    width = Math.min(SIZES.medium[0], end - start);
    if (width < RESIZE_LIMITS.minWidth) return null;
    left = Math.max(start, Math.min(end - width,
      MASONRY.left + Math.floor((x - MASONRY.left) / width) * width));
  }
  if (width < RESIZE_LIMITS.minWidth) return null;
  const span = { x: left, width };
  return { ...span, y: Math.max(MASONRY.top, ...occupied.filter((b) => overlaps(span, b)).map((b) => b.y + b.height)) };
}

export function creationPlacement(target) {
  return target ? { pinnedX: target.x, pinnedY: target.y, width: target.width } : {};
}

export function insertCreatedBlock(project, block, target) {
  if (!target?.afterId) return [...project.blocks, block];
  // Use the current layout order so prerequisites are already placed before
  // inserting at the source's lower edge. Later work reflows around the new body.
  const blocks = dependencyOrder(project.blocks);
  const index = blocks.findIndex((b) => b.id === target.afterId);
  if (index < 0) return [...blocks, block];
  return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
}
