import test from "node:test";
import assert from "node:assert/strict";
import { createProjectStore } from "./src/project/store.js";
import { projectDocument, materializeProject } from "./src/project/changes.js";
import { applyCommand } from "./src/sync/protocol.js";
import { connectCollaboration } from "./src/sync/client.js";
import { applyMasonry, previewResize } from "./masonry.js";
import { demo } from "./src/project/project.js";

const settle = () => new Promise((resolve) => setTimeout(resolve, 5));
function room(t) {
  const initial = demo(); applyMasonry(initial);
  let document = projectDocument(initial), revision = 1;
  const sockets = [], receipts = new Set();
  const snapshot = (socket) => ({ type: "snapshot", projectId: "shared", revision,
    project: materializeProject(document), acknowledgedIds: [...socket.pending].filter((id) => receipts.has(id)) });
  class Socket extends EventTarget {
    readyState = 0;
    pending = new Set();
    messages = [];
    dropNextSnapshot = false;
    constructor() { super(); sockets.push(this); queueMicrotask(() => this.open()); }
    open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
    deliver(packet) {
      if (packet.type === "snapshot" && this.dropNextSnapshot) { this.dropNextSnapshot = false; return; }
      queueMicrotask(() => this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(packet) })));
    }
    send(value) {
      const packet = JSON.parse(value); this.messages.push(packet);
      if (packet.type === "hello") {
        this.pending = new Set(packet.pendingIds); this.deliver(snapshot(this));
      } else if (packet.type === "mutation") {
        this.pending.add(packet.command.id);
        try {
          if (!receipts.has(packet.command.id)) {
            document = applyCommand(document, packet.command, "shared"); revision++; receipts.add(packet.command.id);
          }
          for (const peer of sockets.filter((s) => s.readyState === 1)) peer.deliver(snapshot(peer));
        } catch (error) { this.deliver({ type: "error", status: error.status, message: error.message, snapshot: snapshot(this) }); }
      }
    }
    close() { this.readyState = 3; this.dispatchEvent(new Event("close")); }
    reconnect() { this.close(); queueMicrotask(() => this.open()); }
  }
  function client() {
    const values = new Map(), page = new EventTarget(); page.hidden = false;
    const store = createProjectStore({ initial: () => materializeProject(document), storage: {
      getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value),
    } });
    let view = { state: store.getProject(), canEdit: true, sync: {}, presence: {} }, deferred = false;
    const listeners = new Set();
    const controller = { store, getView: () => view, actions: { setAccount: (user) => { view.canEdit = Boolean(user); } },
      receiveRemote: (packet) => {
        if (deferred) return { deferred: true };
        const result = store.receive(packet); if (result.applied) view.state = result.project; return result;
      },
      setSyncState: (sync) => { view.sync = sync; }, setPresenceState: (presence) => { view.presence = presence; },
      subscribeView: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
      setSyncHandlers: (handlers) => { controller.handlers = handlers; },
      applyResolvedProject: (project) => { view.state = project; },
    };
    const dispose = connectCollaboration(controller, { projectId: "shared", snapshot: snapshot({pending:new Set()}), inviteUrl: "https://diggy.test/?project=shared" }, {
      Socket, page, currentLocation: { origin: "https://diggy.test", protocol: "https:" },
    });
    t.after(dispose);
    return { store, controller, page, socket: sockets.at(-1), view: () => view,
      defer: (value) => { deferred = value; },
      select: (id) => { view.state.selected = id; for (const fn of listeners) fn(view); },
      edit: (fn) => { const p = store.getProject(); fn(p); applyMasonry(p); store.commit(p); view.state = p; },
    };
  }
  return { client, snapshot, get project() { return materializeProject(document); } };
}

test("rapid resizes propagate between independent browser stores and drain the pending queue", async (t) => {
  const shared = room(t), a = shared.client(), b = shared.client(); await settle();
  for (const delta of [8, 16, 24]) a.edit((p) => { p.blocks = previewResize(p, "b1", "e", delta, 0).blocks; });
  await settle();
  assert.equal(a.store.getStatus().pendingCount, 0);
  assert.equal(b.store.getProject().blocks.find((block) => block.id === "b1").width, shared.project.blocks.find((block) => block.id === "b1").width);
  assert.deepEqual(a.store.getProject().blocks, b.store.getProject().blocks);
  assert.equal(a.view().sync.status, "live");
});

test("concurrent resizes of separate blocks merge despite packing changes to their neighbors", async (t) => {
  const shared = room(t), a = shared.client(), b = shared.client(); await settle();
  a.edit((p) => { p.blocks = previewResize(p, "b1", "s", 0, 96).blocks; });
  b.edit((p) => { p.blocks = previewResize(p, "b2", "e", 64, 0).blocks; });
  await settle();
  assert.equal(a.store.getStatus().pendingCount, 0);
  assert.equal(b.store.getStatus().pendingCount, 0);
  assert.deepEqual(a.store.getProject().blocks, b.store.getProject().blocks);
  assert.equal(a.view().sync.status, "live"); assert.equal(b.view().sync.status, "live");
});

test("reconnect acknowledges an accepted resize whose reply was lost", async (t) => {
  const shared = room(t), a = shared.client(); await settle();
  a.socket.dropNextSnapshot = true;
  a.edit((p) => { p.blocks = previewResize(p, "b1", "e", 32, 0).blocks; }); await settle();
  assert.equal(a.store.getStatus().pendingCount, 1);
  a.socket.reconnect(); await settle();
  assert.equal(a.store.getStatus().pendingCount, 0);
  assert.deepEqual(a.store.getProject().blocks, shared.project.blocks);
});

test("a genuine simultaneous edit to the same width pauses for review without losing either version", async (t) => {
  const shared = room(t), a = shared.client(), b = shared.client(); await settle();
  a.edit((p) => { p.blocks = previewResize(p, "b1", "e", 32, 0).blocks; });
  b.edit((p) => { p.blocks = previewResize(p, "b1", "e", 64, 0).blocks; });
  await settle();
  assert.equal(a.store.getStatus().pendingCount, 0);
  assert.equal(b.store.getStatus().pendingCount, 1);
  assert.equal(b.view().sync.status, "conflict");
  assert.notEqual(a.store.getProject().blocks.find((block) => block.id === "b1").width, b.store.getProject().blocks.find((block) => block.id === "b1").width);
});

test("remote updates wait for a gesture to finish and presence never enters project history", async (t) => {
  const shared = room(t), a = shared.client(), b = shared.client(); await settle();
  const history = b.store.getStatus().canUndo;
  b.select("b1");
  assert.equal(b.socket.messages.at(-1).type, "presence");
  assert.equal(b.socket.messages.at(-1).selectedBlock, "b1");
  assert.equal(b.store.getStatus().pendingCount, 0); assert.equal(b.store.getStatus().canUndo, history);
  b.page.hidden = true; b.page.dispatchEvent(new Event("visibilitychange"));
  assert.equal(b.socket.messages.at(-1).selectedBlock, null);
  b.defer(true); a.edit((p) => { p.subtitle = "A remote update"; }); await settle();
  assert.notEqual(b.view().state.subtitle, "A remote update");
  b.defer(false); await new Promise((resolve) => setTimeout(resolve, 170));
  assert.equal(b.view().state.subtitle, "A remote update");
});
