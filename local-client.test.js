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
  await scheduled();
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
