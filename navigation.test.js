import test from "node:test";
import assert from "node:assert/strict";
import { blockByNumber, canvasTargetPlan, nextBlockTarget } from "./src/project/navigation.js";
import { canvasShortcut } from "./src/project/shortcuts.js";
import { creationPlacement, insertCreatedBlock } from "./src/project/creation.js";
import { applyMasonry } from "./masonry.js";

const block = (id, code, extra = {}) => ({ id, code, title: id, color: "moss", size: "medium", x: 48, y: 144, progress: 0, uncertainty: 0, people: [], dependency: "", done: false, ...extra });

test("number lookup uses stable displayed numbers, includes completed blocks and rejects partial or invalid input", () => {
  const project = { blocks: [block("last", "DIG-12"), block("done", "DIG-01", { done: true }), block("other", "DIG-123")] };
  assert.equal(blockByNumber(project, "001").id, "done");
  assert.equal(blockByNumber(project, "12").id, "last");
  assert.equal(blockByNumber(project, "123").id, "other");
  for (const value of ["", "1e1", "-1", "1.2", "DIG-01", "9999999999999999999999", "2"]) assert.equal(blockByNumber(project, value), null);
});

test("repeated creation follows the last created block despite another selection and reflows work beneath it", () => {
  const project = { blocks: [block("first", "DIG-01"), block("second", "DIG-02")], selected: "second", excavations: [] };
  applyMasonry(project);
  const target = nextBlockTarget(project, "first");
  const next = block("new", "DIG-03", creationPlacement(target));
  project.blocks = insertCreatedBlock(project, next, target);
  applyMasonry(project);
  assert.equal(next.x, project.blocks[0].x);
  assert.equal(next.y, project.blocks[0].y + project.blocks[0].slot.height);
  assert.equal(nextBlockTarget(project, next.id).afterId, next.id);
  assert.equal(nextBlockTarget(project, "removed").afterId, "second");
  project.blocks.forEach((b) => b.done = true);
  assert.equal(nextBlockTarget(project, next.id), null);
});

test("target navigation centers negative world coordinates, deep targets and completed footprints at a useful zoom", () => {
  const target = { x: -500, y: 1800, width: 250, height: 148 };
  const view = { width: 1000, height: 700, worldLeft: -1000, zoom: 0.6, fit: true };
  const plan = canvasTargetPlan(target, view);
  assert.equal(plan.zoom, 1);
  assert.equal((target.x - view.worldLeft + target.width / 2) * plan.zoom - plan.left, 500);
  assert.equal((target.y + target.height / 2) * plan.zoom - plan.top, 350);
  const large = canvasTargetPlan({ x: 700, y: 1300, width: 640, height: 640 }, { ...view, width: 480, height: 500 });
  assert.equal(large.zoom, 0.65);
  const preserve = canvasTargetPlan(target, { ...view, zoom: 0.8, fit: false });
  assert.equal(preserve.zoom, 0.8);
  assert.deepEqual(canvasTargetPlan({ x: 0, y: 0, width: 100, height: 100 }, view), { zoom: 1, left: 550, top: 0 });
});

test("N and G shortcuts ignore editors, composition, modifiers, prevented events, and held keys", () => {
  const event = { key: "n", target: { closest: () => null } };
  assert.equal(canvasShortcut(event), "new");
  assert.equal(canvasShortcut({ ...event, key: "G" }), "go");
  for (const flag of ["defaultPrevented", "isComposing", "repeat", "altKey", "metaKey", "ctrlKey"]) assert.equal(canvasShortcut({ ...event, [flag]: true }), null);
  assert.equal(canvasShortcut({ ...event, target: { closest: () => ({}) } }), null);
  assert.equal(canvasShortcut({ ...event, key: "1" }), null);
});
