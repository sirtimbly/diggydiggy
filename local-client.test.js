import test from "node:test";
import assert from "node:assert/strict";
import { loadLocalProject, connectLocalPersistence, persistedProject } from "./src/local/client.js";
import { emptyProject } from "./src/project/project.js";

test("local startup reads SQL state and rejects an invalid board", async () => {
  const snapshot = await loadLocalProject({ request: async () => new Response(JSON.stringify({ project: null }), { headers: { etag: '"empty"' } }) });
  assert.deepEqual(snapshot.project, emptyProject());
  assert.equal(snapshot.etag, '"empty"');
  await assert.rejects(loadLocalProject({ request: async () => new Response('{"project":{"blocks":[]}}') }), /invalid project/);
});

test("local writes serialize, use the new ETag, and stop on stale writes", async () => {
  let listener, scheduled, release;
  let project = emptyProject();
  const calls = [], states = [];
  const controller = {
    store: { getProject: () => structuredClone(project), subscribe: (fn) => { listener = fn; return () => {}; } },
    setSyncState: (state) => states.push(state), setSyncHandlers() {}, actions: { setAccount() {} },
  };
  const stop = connectLocalPersistence(controller, { etag: '"first"' }, {
    schedule: (fn) => { scheduled = fn; }, cancel() {},
    request: async (_url, options) => {
      calls.push(options);
      if (calls.length === 1) return await new Promise((resolve) => { release = resolve; });
      return new Response(null, { status: 412 });
    },
  });
  project.name = "First"; listener({ source: "local" });
  const writing = scheduled();
  project.name = "Second"; listener({ source: "local" });
  scheduled();
  assert.equal(calls.length, 1);
  release(new Response(null, { status: 204, headers: { etag: '"second"' } }));
  await writing;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(calls.length, 2);
  assert.equal(calls[1].headers["if-match"], '"second"');
  assert.equal(JSON.parse(calls[1].body).project.name, "Second");
  assert.match(states.at(-1).error, /Another tab/);
  project.name = "Third"; listener({ source: "local" }); await scheduled();
  assert.equal(calls.length, 2);
  stop();
});

test("SQL payload excludes personal selection and sync credentials", () => {
  const p = { ...emptyProject(), selected: "private", _sync: { pending: ["secret"] } };
  const saved = persistedProject(p);
  assert.equal(saved.selected, null);
  assert.equal(saved._sync, undefined);
});

test("Sync waits for an in-flight save, prevents duplicate syncs, and refreshes received changes", async () => {
  let listener, scheduled, handlers, release;
  let project = emptyProject();
  const calls = [], states = [], pauses = [];
  const controller = {
    store: { getProject: () => structuredClone(project), subscribe: (fn) => { listener = fn; return () => {}; } },
    setSyncState: (state) => states.push(state), setSyncHandlers: (h) => { handlers = h; },
    hasActiveProjectEdit: () => false, replaceLocalProject: (p) => { project = p; },
    actions: { setAccount() {} }, setLocalSyncBusy: (busy) => pauses.push(busy),
  };
  const stop = connectLocalPersistence(controller, { etag: '"one"' }, {
    schedule: (fn) => { scheduled = fn; }, cancel() {},
    request: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "PUT") return new Promise((resolve) => { release = resolve; });
      return new Response(JSON.stringify({ project: { ...emptyProject(), name: "Received" } }), { headers: { etag: '"three"' } });
    },
  });
  project.name = "Local"; listener({ source: "local" });
  const save = scheduled();
  const syncing = handlers.sync();
  await handlers.sync();
  assert.equal(calls.length, 1);
  assert.equal(pauses.at(-1), true);
  release(new Response(null, { status: 204, headers: { etag: '"two"' } }));
  await save; await syncing;
  assert.equal(calls.length, 2);
  assert.equal(calls[1].url, "/api/local/sync");
  assert.equal(calls[1].options.headers["if-match"], '"two"');
  assert.equal(project.name, "Received");
  assert.equal(states.at(-1).syncMessage, "Synced with Git");
  assert.equal(pauses.at(-1), false);
  stop();
});

test("Sync preserves form drafts and adopts a pulled board even when push fails", async () => {
  let editing = true, handlers, project, state;
  let calls = 0;
  const controller = {
    store: { subscribe: () => () => {} }, hasActiveProjectEdit: () => editing,
    replaceLocalProject: (p) => { project = p; }, setSyncHandlers: (h) => { handlers = h; },
    setSyncState: (s) => { state = s; }, setLocalSyncBusy() {}, actions: { setAccount() {} },
  };
  const stop = connectLocalPersistence(controller, { etag: '"one"' }, { request: async () => {
    calls++;
    return new Response(JSON.stringify({ project: { ...emptyProject(), name: "Pulled" }, error: "Push failed" }), { status: 502, headers: { etag: '"two"' } });
  } });
  await handlers.sync();
  assert.equal(calls, 0);
  assert.match(state.remoteError, /Save or cancel/);
  editing = false;
  await handlers.sync();
  assert.equal(project.name, "Pulled");
  assert.equal(state.remoteError, "Push failed");
  assert.equal(state.remoteSyncing, false);
  stop();
});
