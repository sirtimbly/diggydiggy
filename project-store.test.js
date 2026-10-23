import test from "node:test";
import assert from "node:assert/strict";
import { createProjectStore } from "./src/project/store.js";
import { demo, STORAGE } from "./src/project/project.js";
import {
  projectDocument,
  materializeProject,
  diffDocuments,
  applyChanges,
} from "./src/project/changes.js";
import { historyShortcut } from "./src/project/shortcuts.js";

function setup(saved = null) {
  const values = new Map(saved ? [[STORAGE, JSON.stringify(saved)]] : []);
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  let sequence = 0;
  const create = () =>
    createProjectStore({ storage, id: () => `id-${++sequence}` });
  return { store: create(), create, storage };
}
function edit(store, fn, options) {
  const p = store.getProject();
  fn(p);
  store.commit(p, options);
  return p;
}
const block = (store, id = "b1") =>
  store.getProject().blocks.find((b) => b.id === id);

test("selection, no-ops, and initial layout do not enter history; edits undo and redo", () => {
  const { store } = setup();
  edit(store, (p) => (p.selected = "b2"));
  assert.equal(store.getStatus().canUndo, false);
  edit(
    store,
    (p) => (p.blocks.find((b) => b.id === "b1").title = "New title"),
    { label: "Rename block" },
  );
  assert.equal(store.getStatus().undoLabel, "Rename block");
  store.undo();
  assert.equal(block(store).title, "Authentication");
  store.redo();
  assert.equal(block(store).title, "New title");
  assert.equal(
    store.getStatus().pendingCount,
    0,
    "local-only editing does not build an unsendable queue",
  );
  store.undo();
  edit(store, (p) => (p.blocks[0].note = "New direction"));
  assert.equal(store.getStatus().canRedo, false);
});

test("an uncertainty gesture coalesces and a later gesture is a separate edit", () => {
  const { store } = setup();
  for (const value of [28, 32, 36, 40])
    edit(
      store,
      (p) => (p.blocks.find((b) => b.id === "b1").uncertainty = value),
      { group: "gesture-1" },
    );
  store.endGroup();
  edit(store, (p) => (p.blocks.find((b) => b.id === "b1").uncertainty = 44), {
    group: "gesture-2",
  });
  store.undo();
  assert.equal(block(store).uncertainty, 40);
  store.undo();
  assert.equal(block(store).uncertainty, 24);
  assert.equal(store.getStatus().canUndo, false);
  store.redo();
  assert.equal(block(store).uncertainty, 40);
  store.redo();
  assert.equal(block(store).uncertainty, 44);
});

test("undo extraction restores the body, assignments, progress, and exact cavity; redo extracts again", () => {
  const { store } = setup();
  const before = block(store);
  edit(store, (p) => {
    const b = p.blocks.find((b) => b.id === "b1");
    p.excavations.push({ blockId: b.id, ...b.slot });
    b.done = true;
    b.progress = 100;
    b.people = [];
  });
  assert.equal(store.getProject().excavations.length, 1);
  store.undo();
  assert.deepEqual(block(store), before);
  assert.equal(store.getProject().excavations.length, 0);
  store.redo();
  assert.equal(block(store).done, true);
  assert.equal(store.getProject().excavations.length, 1);
});

test("delete/create/reorder and optional dimensions are reversible in one command", () => {
  const { store } = setup();
  const before = store.getProject();
  edit(store, (p) => {
    p.blocks = p.blocks.filter((b) => b.id !== "b1");
    p.blocks.forEach((b) => {
      if (b.dependency === "b1") b.dependency = "";
    });
    p.blocks[0].width = 400;
    p.blocks.reverse();
  });
  store.undo();
  assert.deepEqual(store.getProject().blocks, before.blocks);
  store.redo();
  assert.equal(block(store), undefined);
  assert.equal(store.getProject().blocks.at(-1).width, 400);
});

test("remote edits do not enter local history; undo and redo preserve remote fields", () => {
  const { store } = setup();
  edit(store, (p) => (p.blocks.find((b) => b.id === "b1").title = "My title"));
  const remote = store.getProject();
  remote.blocks.find((b) => b.id === "b1").note = "A teammate’s context";
  assert.equal(
    store.receive({
      projectId: store.getStatus().projectId,
      revision: 1,
      project: remote,
    }).applied,
    true,
  );
  store.undo();
  assert.equal(block(store).title, "Authentication");
  assert.equal(block(store).note, "A teammate’s context");
  assert.equal(store.getStatus().canUndo, false);
  store.redo();
  assert.equal(block(store).title, "My title");
  assert.equal(block(store).note, "A teammate’s context");
});

test("undo leaves a newer conflicting field intact and does not redo skipped changes", () => {
  const { store } = setup();
  edit(store, (p) => (p.blocks.find((b) => b.id === "b1").title = "My title"));
  const remote = store.getProject();
  remote.blocks.find((b) => b.id === "b1").title = "Their title";
  store.receive({
    projectId: store.getStatus().projectId,
    revision: 1,
    project: remote,
  });
  assert.ok(store.undo().skipped.length);
  assert.equal(block(store).title, "Their title");
  assert.equal(store.getStatus().canRedo, false);
});

test("sync mode persists idempotent edits and inverse edits across reload; only confirmed echoes acknowledge them", () => {
  const { store, create, storage } = setup();
  store.enableSync({ projectId: "shared-project", revision: 1 });
  edit(
    store,
    (p) => (p.blocks.find((b) => b.id === "b1").title = "Saved offline"),
  );
  store.undo();
  const commands = store.getPendingMutations();
  assert.equal(commands.length, 2);
  assert.equal(commands[1].kind, "undo");
  assert.notEqual(commands[0].id, commands[1].id);
  const reload = create();
  assert.deepEqual(reload.getPendingMutations(), commands);
  assert.equal(
    reload.getStatus().canUndo,
    false,
    "history is scoped to this session",
  );
  assert.notEqual(reload.getStatus().clientId, store.getStatus().clientId);
  const snapshot = store.getProject();
  assert.equal(
    reload.receive({
      projectId: "other",
      revision: 3,
      project: snapshot,
      acknowledgedIds: commands.map((c) => c.id),
    }).applied,
    false,
  );
  assert.equal(reload.getStatus().pendingCount, 2);
  assert.equal(
    reload.receive({
      projectId: "shared-project",
      revision: 3,
      project: snapshot,
      acknowledgedIds: commands.map((c) => c.id),
    }).applied,
    true,
  );
  assert.equal(reload.getStatus().pendingCount, 0);
  assert.equal(JSON.parse(storage.getItem(STORAGE))._sync.pending.length, 0);
  assert.equal(
    reload.receive({
      projectId: "shared-project",
      revision: 2,
      project: snapshot,
    }).applied,
    false,
  );
});

test("pending changes rebase onto independent remote edits; conflicts keep the durable queue intact", () => {
  const { store } = setup();
  store.enableSync({ projectId: "shared", revision: 1 });
  const server = store.getProject();
  edit(store, (p) => (p.blocks.find((b) => b.id === "b1").title = "Local"));
  server.blocks.find((b) => b.id === "b1").note = "Remote";
  assert.equal(
    store.receive({ projectId: "shared", revision: 2, project: server })
      .applied,
    true,
  );
  assert.equal(block(store).title, "Local");
  assert.equal(block(store).note, "Remote");
  server.blocks.find((b) => b.id === "b1").title = "Conflicting";
  const result = store.receive({
    projectId: "shared",
    revision: 3,
    project: server,
  });
  assert.ok(result.conflict);
  assert.equal(store.getStatus().pendingCount, 1);
  assert.equal(block(store).title, "Local");
  assert.equal(store.getStatus().revision, 2);
});

test("whole-document patches exclude local UI and round trip safely, including unowned holes", () => {
  const { store } = setup();
  const before = store.getProject();
  before.excavations = [
    { x: 0, y: 96, width: 8, height: 8 },
    { x: 10, y: 96, width: 8, height: 8 },
  ];
  const doc = projectDocument(before);
  assert.equal(Object.keys(doc.excavations).length, 2);
  assert.equal("selected" in doc, false);
  const after = structuredClone(before);
  after.blocks[0].width = 320;
  after.selected = "b8";
  const result = applyChanges(doc, diffDocuments(doc, projectDocument(after)));
  assert.equal(result.skipped.length, 0);
  assert.deepEqual(materializeProject(result.document).blocks, after.blocks);
});

test("history is bounded and storage failures leave a usable in-memory project", () => {
  const { store } = setup();
  for (let i = 0; i < 110; i++)
    edit(store, (p) => (p.blocks[0].note = `Edit ${i}`));
  for (let i = 0; i < 100; i++) assert.ok(store.undo());
  assert.equal(store.getStatus().canUndo, false);
  const memory = createProjectStore({
    storage: {
      getItem() {
        throw Error("blocked");
      },
      setItem() {
        throw Error("full");
      },
    },
  });
  edit(memory, (p) => (p.blocks[0].title = "Still works"));
  assert.equal(memory.getStatus().storageAvailable, false);
  memory.undo();
  assert.notEqual(memory.getProject().blocks[0].title, "Still works");
});

test("history shortcuts support Command/Control Z, Y, and Shift-Z while preserving text undo", () => {
  const event = { key: "z", metaKey: true, target: { closest: () => null } };
  assert.equal(historyShortcut(event), "undo");
  assert.equal(historyShortcut({ ...event, shiftKey: true }), "redo");
  assert.equal(historyShortcut({ ...event, key: "y" }), "redo");
  assert.equal(
    historyShortcut({ ...event, metaKey: false, ctrlKey: true }),
    "undo",
  );
  for (const editable of [
    { tagName: "TEXTAREA" },
    { tagName: "INPUT", type: "text" },
    { tagName: "DIV", getAttribute: () => "" },
  ])
    assert.equal(
      historyShortcut({ ...event, target: { closest: () => editable } }),
      null,
    );
  assert.equal(
    historyShortcut({
      ...event,
      target: { closest: () => ({ tagName: "INPUT", type: "range" }) },
    }),
    "undo",
  );
  for (const flags of [
    { altKey: true },
    { isComposing: true },
    { defaultPrevented: true },
    { metaKey: false },
  ])
    assert.equal(historyShortcut({ ...event, ...flags }), null);
});

test("a slider returning to its start does not absorb a preceding unrelated edit", () => {
  const { store } = setup();
  edit(
    store,
    (p) => (p.blocks.find((b) => b.id === "b1").title = "Prior edit"),
  );
  for (const value of [28, 24, 32])
    edit(
      store,
      (p) => (p.blocks.find((b) => b.id === "b1").uncertainty = value),
      { group: "same-drag" },
    );
  store.undo();
  assert.equal(block(store).uncertainty, 24);
  assert.equal(block(store).title, "Prior edit");
  store.undo();
  assert.equal(block(store).title, "Authentication");
});

test("a selective inverse that would make a dependency cycle is skipped atomically", () => {
  const { store } = setup();
  edit(store, (p) => {
    const b = p.blocks.find((b) => b.id === "b3");
    b.dependency = "";
    b.dependencies = [];
  });
  const remote = store.getProject();
  const parent = remote.blocks.find((b) => b.id === "b1");
  parent.dependency = "b3";
  parent.dependencies = ["b3"];
  assert.equal(
    store.receive({
      projectId: store.getStatus().projectId,
      revision: 1,
      project: remote,
    }).applied,
    true,
  );
  const before = store.getProject();
  const result = store.undo();
  assert.equal(result.changes.length, 0);
  assert.ok(result.skipped.length);
  assert.deepEqual(store.getProject(), before);
});

test("remote events do not loop into outbound edits and subscribers receive isolated commands", () => {
  const { store } = setup();
  const events = [];
  const stop = store.subscribe((event) => events.push(event));
  edit(store, (p) => (p.blocks[0].note = "Local"));
  assert.equal(events[0].source, "local");
  const remote = store.getProject();
  remote.blocks[0].note = "Remote";
  store.receive({
    projectId: store.getStatus().projectId,
    revision: 1,
    project: remote,
  });
  assert.deepEqual(
    events.map((e) => e.source),
    ["local", "remote"],
  );
  stop();
  store.undo();
  assert.equal(events.length, 2);
});

test("outbox consumers cannot mutate queued payloads through events or returned values", () => {
  const { store } = setup();
  store.enableSync({ projectId: "shared", revision: 1 });
  store.subscribe((event) => {
    if (event.mutation) event.mutation.changes.length = 0;
  });
  edit(store, (p) => (p.blocks[0].note = "Queued edit"));
  const commands = store.getPendingMutations();
  assert.ok(commands[0].changes.length);
  commands[0].changes.length = 0;
  assert.ok(store.getPendingMutations()[0].changes.length);
});
