import { applyChanges, diffDocuments, invertChanges } from "./changes.js";

export function createProjectHistory({
  limit = 100,
  validate = () => true,
} = {}) {
  const past = [],
    future = [];
  let group = null;
  function record(before, after, label = "Edit project", groupId = null) {
    const changes = diffDocuments(before, after);
    if (!changes.length) return false;
    future.length = 0;
    if (groupId && group === groupId && past.at(-1)?.groupId === groupId) {
      const entry = past.at(-1);
      entry.changes = diffDocuments(entry.before, after);
      if (!entry.changes.length) past.pop();
    } else {
      past.push({ changes, before: structuredClone(before), label, groupId });
      if (past.length > limit) past.shift();
    }
    group = groupId;
    return true;
  }
  function travel(document, from, to) {
    group = null;
    const entry = from.pop();
    if (!entry) return null;
    const result = applyChanges(document, invertChanges(entry.changes));
    if (!validate(result.document))
      return {
        document,
        changes: [],
        skipped: entry.changes,
        label: entry.label,
      };
    if (result.changes.length)
      to.push({ changes: result.changes, label: entry.label });
    return { ...result, label: entry.label };
  }
  return {
    record,
    clear() {
      past.length = 0;
      future.length = 0;
      group = null;
    },
    undo: (document) => travel(document, past, future),
    redo: (document) => travel(document, future, past),
    endGroup() {
      group = null;
    },
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    get undoLabel() {
      return past.at(-1)?.label ?? "";
    },
    get redoLabel() {
      return future.at(-1)?.label ?? "";
    },
  };
}
