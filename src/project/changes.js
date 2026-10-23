// Shared project data has entity IDs and field-level changes. Selection, camera,
// popup state, and character timelines belong to each client, never to a write.
export const equal = (a, b) => {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  const keys = Object.keys(a),
    other = Object.keys(b);
  return (
    Array.isArray(a) === Array.isArray(b) &&
    keys.length === other.length &&
    keys.every((key) => Object.hasOwn(b, key) && equal(a[key], b[key]))
  );
};
const copy = (value) => structuredClone(value);
const cell = (object, key) =>
  Object.hasOwn(object, key) ? { value: copy(object[key]) } : null;

export function projectDocument(project) {
  return {
    version: project.version,
    layoutVersion: project.layoutVersion,
    order: project.blocks.map((block) => block.id),
    blocks: Object.fromEntries(
      project.blocks.map((block) => [block.id, copy(block)]),
    ),
    excavations: Object.fromEntries(
      (project.excavations ?? []).map((hole) => [
        hole.blockId ??
          `ground:${hole.x}:${hole.y}:${hole.width}:${hole.height}`,
        copy(hole),
      ]),
    ),
  };
}

export function materializeProject(document, selected = null) {
  const order = [
    ...new Set([...document.order, ...Object.keys(document.blocks)]),
  ];
  return {
    version: document.version,
    layoutVersion: document.layoutVersion,
    selected,
    blocks: order
      .filter((id) => Object.hasOwn(document.blocks, id))
      .map((id) => copy(document.blocks[id])),
    excavations: Object.values(document.excavations).map(copy),
  };
}

export function diffDocuments(before, after) {
  const changes = [];
  function field(a, b, key, path) {
    if (!equal(cell(a, key), cell(b, key)))
      changes.push({
        path: [...path, key],
        before: cell(a, key),
        after: cell(b, key),
      });
  }
  for (const key of ["version", "layoutVersion", "order"])
    field(before, after, key, []);
  for (const collection of ["blocks", "excavations"]) {
    const a = before[collection],
      b = after[collection];
    for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
      if (!Object.hasOwn(a, id) || !Object.hasOwn(b, id))
        field(a, b, id, [collection]);
      else
        for (const key of new Set([
          ...Object.keys(a[id]),
          ...Object.keys(b[id]),
        ]))
          field(a[id], b[id], key, [collection, id]);
    }
  }
  return changes;
}

export const invertChanges = (changes) =>
  changes.map(({ path, before, after }) => ({
    path: [...path],
    before: copy(after),
    after: copy(before),
  }));

export function applyChanges(document, changes) {
  const next = copy(document),
    skipped = [];
  for (const change of changes) {
    const { path, before, after } = change;
    let parent = next;
    for (const key of path.slice(0, -1))
      parent = parent && Object.hasOwn(parent, key) ? parent[key] : null;
    const key = path.at(-1);
    // Undo changes only the fields still equal to this user's edit. A remote
    // edit to another field survives; a conflicting field is left alone.
    if (!parent || !equal(cell(parent, key), before)) {
      skipped.push(change);
      continue;
    }
    if (after === null) delete parent[key];
    else
      Object.defineProperty(parent, key, {
        value: copy(after.value),
        writable: true,
        enumerable: true,
        configurable: true,
      });
  }
  return { document: next, skipped, changes: diffDocuments(document, next) };
}
