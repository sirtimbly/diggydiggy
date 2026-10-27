import { applyChanges, equal } from "../project/changes.js";

// These fields are packing results. Width/height, pins, order, and prerequisites
// express the edit; every client and the server derive the resulting placements.
const placementFields = new Set(["x", "y", "column", "slot"]);
export function sharedChanges(changes) {
  return changes.filter(({ path }) => !(path.length === 3 && path[0] === "blocks" && placementFields.has(path[2])));
}

export function applySharedChanges(document, changes) {
  const edits = sharedChanges(changes).filter(({ path, after }) => {
    let parent = document;
    for (const key of path.slice(0, -1)) parent = parent && Object.hasOwn(parent, key) ? parent[key] : null;
    if (!parent) return true;
    const key = path.at(-1), current = Object.hasOwn(parent, key) ? { value: parent[key] } : null;
    // A lost acknowledgement or identical concurrent edit is already satisfied.
    return !equal(current, after);
  });
  return applyChanges(document, edits);
}
