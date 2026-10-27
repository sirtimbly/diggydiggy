import test from "node:test";
import assert from "node:assert/strict";
import { demo, PALETTE, validProject } from "./src/project/project.js";
import { projectPalette } from "./src/project/color-legend.js";
import { createProjectStore } from "./src/project/store.js";
import { projectDocument, materializeProject, diffDocuments } from "./src/project/changes.js";
import { applyCommand, canonicalProject } from "./src/sync/protocol.js";
import { applyMasonry } from "./masonry.js";

function command(before, after) {
  return { version: 1, id: crypto.randomUUID(), clientId: "legend-editor", projectId: "project", baseRevision: 1,
    kind: "edit", label: "Edit color legend", changes: diffDocuments(before, after) };
}
test("legacy palettes keep their colors; project colors and labels round trip without changing block IDs", () => {
  const project = demo();
  assert.deepEqual(projectPalette(project), Object.fromEntries(Object.entries(PALETTE).map(([key, value]) => [key, {...value, label: ""}])));
  project.colorLegend = { amber: { color: "#336699", label: "Engineering" }, moss: { color: PALETTE.moss.fill, label: "" } };
  assert.equal(validProject(project), true);
  const roundTrip = materializeProject(projectDocument(project));
  assert.deepEqual(roundTrip.colorLegend, project.colorLegend);
  assert.equal(roundTrip.blocks[0].color, "amber");
  assert.deepEqual(projectPalette(roundTrip).amber, { fill: "#336699", shade: "#24476b", name: "Engineering", label: "Engineering" });
  assert.equal(projectPalette(roundTrip).moss.name, "Moss");
  assert.equal(PALETTE.amber.fill, "#ddb472");
});
test("legend validation rejects unknown slots, malformed colors, unsafe fields, and oversized labels", () => {
  for (const colorLegend of [null, [], { unknown: { color: "#123456", label: "X" } }, { amber: {color: "red", label: "X"} },
    { amber: {color: "#123456", label: "x".repeat(33)} }, { amber: {color: "#123456", label: 7} },
    { amber: {color: "#123456", label: "X", fill: "url(x)"} }]) {
    assert.equal(validProject({ ...demo(), colorLegend }), false);
  }
});
test("legend edits persist, undo, redo, and require sign-in", () => {
  const data = new Map(); let signedIn = true;
  const storage = { getItem: key => data.get(key), setItem: (key,value) => data.set(key,value) };
  const store = createProjectStore({storage, canEdit: () => signedIn});
  const next = store.getProject(); next.colorLegend = { amber: { color: "#123456", label: "Design" } };
  store.commit(next, {label: "Edit color legend"});
  assert.deepEqual(createProjectStore({storage}).getProject().colorLegend, next.colorLegend);
  assert.deepEqual(store.undo().project.colorLegend, {});
  assert.deepEqual(store.redo().project.colorLegend, next.colorLegend);
  signedIn = false;
  const blocked = store.getProject(); blocked.colorLegend.amber.label = "Blocked";
  assert.throws(() => store.commit(blocked), /Sign in/);
  assert.equal(store.undo(), null);
  assert.equal(store.getProject().colorLegend.amber.label, "Design");
});
test("legacy rooms accept legend edits, merge different colors and fields, and reject malformed writes", () => {
  const initial = demo(); applyMasonry(initial);
  const base = projectDocument(canonicalProject(initial));
  const legacy = structuredClone(base); delete legacy.colorLegend;
  const a = structuredClone(base), b = structuredClone(base);
  a.colorLegend.amber = {color: "#123456", label: "Build"};
  b.colorLegend.moss = {color: "#789abc", label: "Research"};
  const first = applyCommand(legacy, command(base,a), "project");
  const both = applyCommand(first, command(base,b), "project");
  assert.deepEqual(both.colorLegend, {...a.colorLegend, ...b.colorLegend});
  const renamed = structuredClone(both), recolored = structuredClone(both);
  renamed.colorLegend.amber.label = "Engineering";
  recolored.colorLegend.amber.color = "#abcdef";
  const merged = applyCommand(applyCommand(both,command(both,renamed),"project"),command(both,recolored),"project");
  assert.deepEqual(merged.colorLegend.amber,{color: "#abcdef", label: "Engineering"});
  const invalid = structuredClone(both); invalid.colorLegend.amber.color = "red";
  assert.throws(() => applyCommand(both, command(both,invalid), "project"), /Invalid project/);
  const unsafe = command(base,a); unsafe.changes[0].path = ["colorLegend", "__proto__"];
  assert.throws(() => applyCommand(base,unsafe,"project"), /Invalid field change/);
});
