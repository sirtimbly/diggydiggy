import test from "node:test";
import assert from "node:assert/strict";
import { createProjectStore } from "./src/project/store.js";
import { guardProjectEdits } from "./src/project/edit-access.js";

test("signed-out changes cannot alter project data, history, or pending writes; sign-in grants edits and sign-out blocks undo", () => {
  let signedIn = false;
  const storage = new Map();
  const store = createProjectStore({
    storage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    canEdit: () => signedIn,
  });
  const original = store.getProject();
  const renamed = { ...original, name: "Changed name", subtitle: "Changed subtitle" };
  assert.throws(() => store.commit(renamed), /Sign in/);
  assert.deepEqual(store.getProject(), original);
  assert.equal(store.getStatus().canUndo, false);
  assert.deepEqual(store.getPendingMutations(), []);
  store.commit({ ...original, selected: original.blocks[0].id });
  assert.equal(store.getProject().selected, original.blocks[0].id);
  signedIn = true;
  store.commit(renamed);
  assert.equal(store.getProject().name, renamed.name);
  signedIn = false;
  assert.equal(store.undo(), null);
  assert.equal(store.redo(), null);
  assert.equal(store.getProject().subtitle, renamed.subtitle);
  signedIn = true;
  store.undo();
  assert.equal(store.getProject().name, original.name);
});

test("an already-open edit form and history shortcut recheck sign-in when invoked", () => {
  let signedIn = true, changes = 0, prompts = 0;
  const actions = guardProjectEdits({
    saveProjectDetails: () => changes++, saveColorLegend: () => changes++, undo: () => changes++,
    changeProgress: () => changes++, saveBlock: () => changes++, openNextBlock: () => changes++,
  }, () => signedIn, () => { prompts++; return false; });
  const submit = actions.saveProjectDetails;
  submit({ name: "Allowed", subtitle: "Signed in" });
  assert.equal(changes, 1);
  signedIn = false;
  submit({ name: "Blocked", subtitle: "Signed out" });
  actions.undo(); actions.changeProgress(); actions.saveBlock(); actions.saveColorLegend(); actions.openNextBlock();
  assert.equal(changes, 1);
  assert.equal(prompts, 6);
});
