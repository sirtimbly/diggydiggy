import test from "node:test";
import assert from "node:assert/strict";
import { demo, validProject, STORAGE } from "./src/project/project.js";
import { DEFAULT_CREW, DEFAULT_APPEARANCE, crewAppearance, validCrew, activeCrew, saveCrewMember, archiveCrewMember } from "./src/project/crew.js";
import { createProjectStore } from "./src/project/store.js";
import { projectDocument, diffDocuments } from "./src/project/changes.js";
import { applyCommand } from "./src/sync/protocol.js";

function setup(project = demo()) {
  const values = new Map([[STORAGE, JSON.stringify(project)]]);
  const storage = {getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value)};
  let id = 0;
  const create = () => createProjectStore({storage, id: () => `crew-${++id}`});
  return {store: create(), create};
}
const newMember = {name: "Alex", color: "#cda65a", shirt: "#335577", skin: "#8b6044"};

test("legacy appearance defaults do not rewrite records; invalid custom appearance is rejected", () => {
  const legacy = structuredClone(DEFAULT_CREW);
  assert.equal(validCrew(legacy), true);
  assert.deepEqual(crewAppearance(legacy[0]), {...DEFAULT_APPEARANCE, ...legacy[0]});
  assert.deepEqual(legacy, DEFAULT_CREW);
  for (const invalid of [{hairLength: "huge"}, {hairLength: null}, {hairColor: "red"}, {hairColor: null}, {glasses: "true"}, {headphones: 1}]) {
    assert.equal(validCrew([{...legacy[0], ...invalid}]), false);
    assert.throws(() => saveCrewMember(demo(), "maya", {...legacy[0], ...invalid}));
  }
});

test("personalization syncs from missing legacy fields, survives reload, undo, and archive/restore", () => {
  const {store, create} = setup(); store.enableSync({projectId: "room", revision: 1});
  const before = store.getProject(), look = {hairLength: "long", hairColor: "#cc7711", glasses: true, headphones: true};
  store.commit(saveCrewMember(before, "maya", {...before.crew[0], ...look}));
  const command = store.getPendingMutations()[0];
  const synced = applyCommand(projectDocument(before), command, "room");
  assert.deepEqual(synced.crew.maya, {...before.crew[0], ...look});
  assert.deepEqual(create().getProject().crew[0], synced.crew.maya);
  store.undo(); assert.deepEqual(store.getProject().crew[0], before.crew[0]);
  store.redo(); assert.deepEqual(store.getProject().crew[0], synced.crew.maya);
  store.commit(archiveCrewMember(store.getProject(), "maya", true));
  store.commit(archiveCrewMember(store.getProject(), "maya", false));
  assert.deepEqual(store.getProject().crew[0], synced.crew.maya);
  assert.deepEqual(before.crew[0], DEFAULT_CREW[0]);
});

test("editing a legacy name leaves a teammate's new appearance fields unclaimed", () => {
  const before = setup().store.getProject(), after = saveCrewMember(before, "maya", {...crewAppearance(before.crew[0]), name: "Morgan"});
  const changes = diffDocuments(projectDocument(before), projectDocument(after));
  assert.deepEqual(changes.map((change) => change.path), [["crew", "maya", "name"]]);
  const remote = saveCrewMember(before, "maya", {...before.crew[0], hairLength: "long", headphones: true});
  const saved = applyCommand(projectDocument(remote), {version: 1, id: "rename-legacy", clientId: "client-1", projectId: "room", baseRevision: 1, kind: "edit", label: "Edit digger", changes}, "room");
  assert.equal(saved.crew.maya.name, "Morgan");
  assert.equal(saved.crew.maya.hairLength, "long");
  assert.equal(saved.crew.maya.headphones, true);
});

test("legacy local projects acquire their own crew without resetting blocks or assignments", () => {
  const legacy = demo(); delete legacy.crew;
  const {store, create} = setup(legacy);
  assert.deepEqual(store.getProject().crew, DEFAULT_CREW);
  assert.deepEqual(store.getProject().blocks.find((block) => block.id === "b1").people, ["maya", "theo"]);
  store.commit(saveCrewMember(store.getProject(), "maya", {...DEFAULT_CREW[0], name: "Maya renamed"}));
  assert.equal(create().getProject().crew[0].name, "Maya renamed");
  assert.equal(demo().crew[0].name, "Maya");
});

test("creating and editing crew survives reload and produces field-level shared commands", () => {
  const {store, create} = setup();
  store.enableSync({projectId: "room", revision: 1});
  store.commit(saveCrewMember(store.getProject(), null, newMember), {label: "Add digger"});
  const person = store.getProject().crew.at(-1);
  assert.equal(person.name, "Alex");
  assert.deepEqual(store.getPendingMutations()[0].changes.map((c) => c.path), [["crew", person.id]]);
  store.commit(saveCrewMember(store.getProject(), person.id, {...person, name: "Alex Morgan", shirt: "#994477"}));
  assert.equal(create().getProject().crew.at(-1).shirt, "#994477");
  store.undo(); assert.equal(store.getProject().crew.at(-1).name, "Alex");
  store.undo(); assert.equal(store.getProject().crew.length, 4);
  store.redo(); assert.equal(store.getProject().crew.at(-1).name, "Alex");
});

test("archive removes assignments atomically, undo restores them, and restore leaves a digger available", () => {
  const {store} = setup();
  const before = store.getProject();
  store.commit(archiveCrewMember(before, "maya", true), {label: "Archive digger"});
  assert.equal(activeCrew(store.getProject()).some((p) => p.id === "maya"), false);
  assert.equal(store.getProject().blocks.some((b) => b.people.includes("maya")), false);
  store.undo(); assert.deepEqual(store.getProject(), before);
  store.redo();
  store.commit(archiveCrewMember(store.getProject(), "maya", false));
  assert.equal(activeCrew(store.getProject()).some((p) => p.id === "maya"), true);
  assert.equal(store.getProject().blocks.some((b) => b.people.includes("maya")), false);
});

test("crew validation rejects stale archived assignments, unknown IDs, unsafe colors, and duplicate members", () => {
  const p = archiveCrewMember(demo(), "maya", true);
  p.blocks[0].people.push("maya"); assert.equal(validProject(p), false);
  p.blocks[0].people = ["missing"]; assert.equal(validProject(p), false);
  assert.throws(() => saveCrewMember(demo(), null, {...newMember, name: "  "}));
  assert.throws(() => saveCrewMember(demo(), null, {...newMember, shirt: "url(bad)"}));
  const duplicate = demo(); duplicate.crew.push({...duplicate.crew[0]}); assert.equal(validProject(duplicate), false);
});

test("legacy server documents accept crew mutations and reject partial archives and mismatched entity IDs", () => {
  const {store} = setup();
  const before = store.getProject(), legacy = projectDocument(before); delete legacy.crew;
  const after = saveCrewMember(before, null, newMember);
  const command = {version: 1, id: "edit-1", clientId: "client-1", projectId: "room", baseRevision: 1, kind: "edit", label: "Add digger", changes: diffDocuments(projectDocument(before), projectDocument(after))};
  const saved = applyCommand(legacy, command, "room");
  assert.equal(Object.values(saved.crew).at(-1).name, "Alex");
  assert.throws(() => applyCommand(saved, {...command, changes: [{path: ["crew", "maya", "archived"], before: {value: false}, after: {value: true}}]}, "room"));
  assert.throws(() => applyCommand(saved, {...command, changes: [{path: ["crew", "different-id"], before: null, after: {value: {...newMember, id: "other-id", archived: false}}}]}, "room"));
});

test("a teammate's assignment protects a new digger from a stale creation undo", () => {
  const {store} = setup(); store.enableSync({projectId: "room", revision: 1});
  store.commit(saveCrewMember(store.getProject(), null, newMember));
  const person = store.getProject().crew.at(-1), pending = store.getPendingMutations()[0];
  const remote = store.getProject(); remote.blocks[0].people.push(person.id);
  store.receive({projectId: "room", revision: 2, project: remote, acknowledgedIds: [pending.id]});
  const result = store.undo();
  assert.ok(result.skipped.length);
  assert.equal(store.getProject().crew.some((p) => p.id === person.id), true);
  assert.equal(validProject(store.getProject()), true);
});
