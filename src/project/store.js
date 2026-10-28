import { applyMasonry } from "../../masonry.js";
import { STORAGE, demo, validProject } from "./project.js";
import {
  projectDocument,
  materializeProject,
  diffDocuments,
  applyChanges,
} from "./changes.js";
import { createProjectHistory } from "./history.js";
import { applySharedChanges, sharedChanges } from "../sync/changes.js";

// Persistence and collaboration boundary. Project rooms feed
// confirmed snapshots here and submits pending commands through a write API.
// Local-only mode does not accumulate an unbounded queue of unsendable writes.
export function createProjectStore({
  storage,
  key = STORAGE,
  initial = demo,
  id = () => crypto.randomUUID(),
  canEdit = () => true,
  preferInitial = false,
} = {}) {
  let project,
    metadata,
    storageAvailable = true;
  try {
    const saved = preferInitial ? null : JSON.parse(storage?.getItem(key) ?? "null");
    if (validProject(saved)) {
      project = saved;
      metadata = saved._sync;
      delete project._sync;
    }
  } catch {
    /* Keep the original key if a browser blocks storage. */
  }
  project ??= initial();
  applyMasonry(project);
  let document = projectDocument(project);
  let projectId =
    typeof metadata?.projectId === "string" ? metadata.projectId : id();
  const clientId = id(); // A fresh editing session, distinct from other open tabs.
  let revision = Number.isSafeInteger(metadata?.revision)
    ? metadata.revision
    : 0;
  let syncEnabled = metadata?.version === 1 && metadata?.enabled === true;
  let pending =
    syncEnabled && Array.isArray(metadata?.pending) ? metadata.pending : [];
  const listeners = new Set();
  const validate = (doc) => validProject(materializeProject(doc));
  const history = createProjectHistory({ validate });
  function persist(selected = project.selected) {
    project = materializeProject(
      document,
      Object.hasOwn(document.blocks, selected) ? selected : null,
    );
    try {
      storage.setItem(
        key,
        JSON.stringify({
          ...project,
          _sync: {
            version: 1,
            projectId,
            revision,
            enabled: syncEnabled,
            pending,
          },
        }),
      );
      storageAvailable = true;
    } catch {
      storageAvailable = false;
    }
  }
  function emit(event) {
    for (const listener of listeners) listener(structuredClone(event));
  }
  function enqueue(changes, label, kind = "edit") {
    const mutation = {
      version: 1,
      id: id(),
      projectId,
      clientId,
      baseRevision: revision,
      kind,
      label,
      changes: structuredClone(sharedChanges(changes)),
    };
    if (syncEnabled && mutation.changes.length) pending.push(mutation);
    return mutation;
  }
  function commit(next, { label = "Edit project", group = null } = {}) {
    const after = projectDocument(next),
      before = document;
    const changes = diffDocuments(before, after);
    if (!changes.length) {
      persist(next.selected);
      return false;
    }
    if (!canEdit()) throw new Error("Sign in to make changes to this project.");
    if (!validate(after))
      throw new Error("The edit would make an invalid project.");
    history.record(before, after, label, group);
    document = after;
    const mutation = enqueue(changes, label);
    persist(next.selected);
    emit({ source: "local", mutation });
    return true;
  }
  function travel(kind) {
    if (!canEdit()) return null;
    const result = history[kind](document);
    if (!result) return null;
    document = result.document;
    const mutation = result.changes.length
      ? enqueue(result.changes, result.label, kind)
      : null;
    persist(project.selected);
    emit({ source: kind, mutation });
    return {
      ...result,
      project: materializeProject(document, project.selected),
    };
  }
  function receive({
    projectId: incomingId,
    revision: incomingRevision,
    project: incoming,
    acknowledgedIds = [],
  }) {
    if (
      incomingId !== projectId ||
      !Number.isSafeInteger(incomingRevision) ||
      incomingRevision < revision
    )
      return { applied: false };
    const candidate = structuredClone(incoming);
    if (!validProject(candidate)) throw new Error("Invalid remote project.");
    applyMasonry(candidate);
    let next = projectDocument(candidate);
    const remaining = pending.filter(
      (command) =>
        !(
          acknowledgedIds.includes(command.id) &&
          incomingRevision > command.baseRevision
        ),
    );
    // Rebase atomically. Never drop durable edits or partially apply a command
    // when the server and this client have changed the same field.
    for (const command of remaining) {
      const result = applySharedChanges(next, command.changes);
      if (result.skipped.length || !validate(result.document))
        return { applied: false, conflict: command.id };
      next = result.document;
      const packed = materializeProject(next);
      applyMasonry(packed);
      next = projectDocument(packed);
    }
    if (!validate(next)) throw new Error("Invalid merged project.");
    document = next;
    revision = incomingRevision;
    pending = remaining;
    history.endGroup();
    persist(project.selected);
    emit({ source: "remote", revision });
    return {
      applied: true,
      project: materializeProject(document, project.selected),
    };
  }
  return {
    replaceLocalProject(incoming) {
      if (syncEnabled) throw new Error("Cannot replace a shared project through local storage.");
      const candidate = structuredClone(incoming);
      if (!validProject(candidate)) throw new Error("The synced project is invalid.");
      applyMasonry(candidate);
      document = projectDocument(candidate);
      history.clear();
      persist(project.selected);
      emit({ source: "remote" });
      return materializeProject(document, project.selected);
    },
    commit,
    undo: () => travel("undo"),
    redo: () => travel("redo"),
    receive,
    endGroup: () => history.endGroup(),
    getProject: () => materializeProject(document, project.selected),
    resolveRemote(snapshot, keepLocal) {
      if (!canEdit()) throw new Error("Sign in to resolve project changes.");
      if (snapshot.projectId !== projectId || snapshot.revision < revision)
        throw new Error("The shared snapshot is stale.");
      const shared = structuredClone(snapshot.project);
      if (!validProject(shared)) throw new Error("Invalid shared project.");
      applyMasonry(shared);
      const base = projectDocument(shared);
      let desired = structuredClone(base);
      if (keepLocal) {
        for (const command of pending.filter(
          (c) => !snapshot.acknowledgedIds?.includes(c.id),
        )) {
          const changes = sharedChanges(command.changes).map((change) => {
            let parent = desired;
            for (const key of change.path.slice(0, -1))
              parent =
                parent && Object.hasOwn(parent, key) ? parent[key] : null;
            if (!parent)
              throw new Error(
                "Some work was removed. Keep the shared version or save your local copy before continuing.",
              );
            const key = change.path.at(-1);
            return {
              ...change,
              before: Object.hasOwn(parent, key)
                ? { value: structuredClone(parent[key]) }
                : null,
            };
          });
          desired = applyChanges(desired, changes).document;
        }
        if (!validate(desired))
          throw new Error(
            "Your pending edits conflict with shared prerequisites or assignments.",
          );
        const normalized = materializeProject(desired);
        applyMasonry(normalized);
        desired = projectDocument(normalized);
      }
      // Keep the pre-resolution project and durable queue before replacing either.
      storage.setItem(
        `${key}:conflict-backup`,
        JSON.stringify({
          project: materializeProject(document, project.selected),
          pending,
        }),
      );
      document = desired;
      revision = snapshot.revision;
      pending = [];
      history.clear();
      const changes = diffDocuments(base, desired);
      let mutation = null;
      if (changes.length) {
        history.record(base, desired, "Resolve shared edits");
        mutation = enqueue(changes, "Resolve shared edits", "resolve");
      }
      persist(project.selected);
      emit({ source: "resolve", mutation });
      return materializeProject(document, project.selected);
    },
    getStatus: () => ({
      storageAvailable,
      syncEnabled,
      projectId,
      clientId,
      revision,
      pendingCount: pending.length,
      canUndo: history.canUndo,
      canRedo: history.canRedo,
      undoLabel: history.undoLabel,
      redoLabel: history.redoLabel,
    }),
    getPendingMutations: () => structuredClone(pending),
    // The backend must first seed/confirm this project at revision >= 1.
    // Enabling never silently uploads a local draft over existing shared data.
    enableSync({ projectId: sharedId, revision: confirmedRevision }) {
      if (syncEnabled)
        throw new Error(
          "Sync is already enabled. Confirm newer revisions through receive().",
        );
      if (
        typeof sharedId !== "string" ||
        !sharedId ||
        !Number.isSafeInteger(confirmedRevision) ||
        confirmedRevision < 1
      )
        throw new Error(
          "A confirmed shared project and revision are required.",
        );
      projectId = sharedId;
      revision = confirmedRevision;
      syncEnabled = true;
      persist();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    persistSelection: (selected) => persist(selected),
  };
}
