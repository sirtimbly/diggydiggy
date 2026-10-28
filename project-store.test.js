import test from "node:test";
import assert from "node:assert/strict";
import { createProjectStore } from "./src/project/store.js";
import { demo, emptyProject, STORAGE } from "./src/project/project.js";
import {
  projectDocument,
  materializeProject,
  diffDocuments,
  applyChanges,
} from "./src/project/changes.js";
import { historyShortcut } from "./src/project/shortcuts.js";
import { applyCommand } from "./src/sync/protocol.js";

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

test("authoritative local SQL startup ignores a stale browser recovery cache", () => {
  const cached = { ...emptyProject(), name: "Old browser copy" };
  const database = { ...emptyProject(), name: "Current database" };
  const storage = { getItem: () => JSON.stringify(cached), setItem() {} };
  const store = createProjectStore({ storage, initial: () => database, preferInitial: true });
  assert.equal(store.getProject().name, "Current database");
  assert.equal(store.getStatus().syncEnabled, false);
});

test("received local SQL snapshots clear stale undo and do not enqueue another save", () => {
  const { store } = setup();
  edit(store, (p) => { p.name = "Local edit"; });
  assert.equal(store.getStatus().canUndo, true);
  const events = [];
  store.subscribe((event) => events.push(event));
  const received = { ...emptyProject(), name: "Received from Git" };
  store.replaceLocalProject(received);
  assert.equal(store.getProject().name, "Received from Git");
  assert.equal(store.getStatus().canUndo, false);
  assert.deepEqual(events.map((event) => event.source), ["remote"]);
  assert.equal(store.getStatus().pendingCount, 0);
});

test("an acknowledgement at the current revision clears an already-applied outbox command", () => {
  const { store } = setup();
  store.enableSync({ projectId: "shared", revision: 1 });
  edit(store, (p) => { p.name = "Already accepted"; });
  const pending = store.getPendingMutations()[0], project = store.getProject();
  assert.equal(store.receive({ projectId: "shared", revision: 2, project, acknowledgedIds: [] }).applied, true);
  assert.equal(store.getStatus().pendingCount, 1);
  assert.equal(store.receive({ projectId: "shared", revision: 2, project, acknowledgedIds: [pending.id] }).applied, true);
  assert.equal(store.getStatus().pendingCount, 0);
});
const block = (store, id = "b1") =>
  store.getProject().blocks.find((b) => b.id === id);

test("legacy project names persist, sync as one field, and support selective undo", () => {
  const legacy = demo();
  delete legacy.name;
  const { store, create } = setup(legacy);
  assert.equal(Object.hasOwn(store.getProject(), "name"), false);
  const baseline = store.getProject();
  edit(store, (p) => { p.name = "Our launch"; }, { label: "Rename project" });
  const changes = diffDocuments(projectDocument(baseline), projectDocument(store.getProject()));
  assert.deepEqual(changes, [{ path: ["name"], before: null, after: { value: "Our launch" } }]);
  assert.equal(create().getProject().name, "Our launch");
  const command = { version: 1, id: "rename", clientId: "tab", projectId: "room", baseRevision: 1, kind: "edit", label: "Rename project", changes };
  const remote = applyCommand(projectDocument(baseline), command, "room");
  assert.equal(materializeProject(remote).name, "Our launch");
  assert.deepEqual(materializeProject(remote).blocks, baseline.blocks);
  store.undo();
  assert.equal(Object.hasOwn(store.getProject(), "name"), false);
  store.redo();
  assert.equal(store.getProject().name, "Our launch");
  for (const name of ["", "  ", "x".repeat(81), 42]) {
    assert.throws(() => applyCommand(projectDocument(baseline), { ...command, changes: [{ path: ["name"], before: null, after: { value: name } }] }, "room"), /Invalid project/);
  }
});

test("a new blank project's cache preserves the original draft and keeps an empty crew on reload", () => {
  const { store: original, storage } = setup();
  edit(original, (p) => { p.blocks[0].title = "Keep my existing project"; });
  const draft = storage.getItem(STORAGE);
  const key = `${STORAGE}:new-blank-project`;
  const blank = createProjectStore({ storage, key, initial: emptyProject });
  blank.commit(blank.getProject());
  const reloaded = createProjectStore({ storage, key });
  for (const collection of ["blocks", "crew", "dividers", "excavations"])
    assert.deepEqual(reloaded.getProject()[collection], []);
  assert.equal(storage.getItem(STORAGE), draft);
  assert.equal(createProjectStore({ storage }).getProject().blocks[0].title, "Keep my existing project");
});

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

test("conflict resolution keeps a backup, preserves independent shared fields, and queues a fresh command", () => {
  const { store, storage } = setup();
  store.enableSync({ projectId: "shared", revision: 1 });
  const shared = store.getProject();
  edit(store, (p) => (p.blocks.find((b) => b.id === "b1").title = "My draft"));
  shared.blocks.find((b) => b.id === "b1").title = "Their draft";
  shared.blocks.find((b) => b.id === "b1").note = "Shared context";
  const snapshot = {
    projectId: "shared",
    revision: 2,
    project: shared,
    acknowledgedIds: [],
  };
  assert.ok(store.receive(snapshot).conflict);
  store.resolveRemote(snapshot, true);
  assert.equal(block(store).title, "My draft");
  assert.equal(block(store).note, "Shared context");
  assert.equal(store.getPendingMutations().length, 1);
  assert.equal(store.getPendingMutations()[0].kind, "resolve");
  assert.equal(
    JSON.parse(
      storage.getItem(`${STORAGE}:conflict-backup`),
    ).project.blocks.find((b) => b.id === "b1").title,
    "My draft",
  );
  store.undo();
  assert.equal(block(store).title, "Their draft");
});

test("choosing shared edits clears pending writes only after saving the local backup", () => {
  const { store, storage } = setup();
  store.enableSync({ projectId: "shared", revision: 1 });
  const shared = store.getProject();
  edit(store, (p) => (p.blocks[0].title = "Offline edit"));
  store.resolveRemote(
    { projectId: "shared", revision: 2, project: shared, acknowledgedIds: [] },
    false,
  );
  assert.equal(store.getPendingMutations().length, 0);
  assert.deepEqual(store.getProject().blocks, shared.blocks);
  assert.ok(storage.getItem(`${STORAGE}:conflict-backup`));
});

test("project name and sign subtitle save atomically across legacy rooms, reload, sync, and undo", () => {
  const {store,create}=setup();
  const before=store.getProject(), after=structuredClone(before);
  after.name='The autumn dig'; after.subtitle='One ledge at a time';
  store.commit(after,{label:'Edit project details'});
  assert.equal(create().getProject().subtitle,'One ledge at a time');
  const command={version:1,id:'details',clientId:'tab',projectId:'room',baseRevision:1,kind:'edit',label:'Edit project details',changes:diffDocuments(projectDocument(before),projectDocument(after))};
  const synced=materializeProject(applyCommand(projectDocument(before),command,'room'));
  assert.equal(synced.name,'The autumn dig');assert.equal(synced.subtitle,'One ledge at a time');
  assert.deepEqual(synced.blocks,before.blocks);
  store.undo(); assert.equal(store.getProject().name,before.name);assert.equal(store.getProject().subtitle,undefined);
  store.redo(); assert.equal(store.getProject().subtitle,'One ledge at a time');
  const cleared=structuredClone(after);cleared.subtitle='';
  assert.doesNotThrow(()=>applyCommand(projectDocument(after),{...command,id:'clear-subtitle',changes:diffDocuments(projectDocument(after),projectDocument(cleared))},'room'));
  for(const subtitle of ['x'.repeat(81),42,null]) {
    const invalid=structuredClone(after);invalid.subtitle=subtitle;
    assert.throws(()=>applyCommand(projectDocument(before),{...command,changes:diffDocuments(projectDocument(before),projectDocument(invalid))},'room'),/Invalid project/);
  }
});
