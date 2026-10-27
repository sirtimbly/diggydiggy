import { CREW_FIELDS } from "../project/crew.js";
import { DIVIDER_FIELDS } from "../project/dividers.js";
import { SIZES, applyMasonry, dependenciesOf } from "../../masonry.js";
import { PALETTE, validProject } from "../project/project.js";
import { applySharedChanges } from "./changes.js";
import {
  materializeProject,
  projectDocument,
  equal,
} from "../project/changes.js";

const fields = new Set([
  "id",
  "code",
  "title",
  "note",
  "size",
  "color",
  "x",
  "y",
  "column",
  "slot",
  "pinnedX",
  "pinnedY",
  "pinnedColumn",
  "width",
  "height",
  "uncertainty",
  "progress",
  "people",
  "dependency",
  "dependencies",
  "done",
  "blocked",
]);
const safeId = (value) =>
  typeof value === "string" &&
  /^[a-zA-Z0-9_-]{1,80}$/.test(value) &&
  !["__proto__", "constructor", "prototype"].includes(value);
export class ProtocolError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}
export function canonicalProject(value) {
  const p = structuredClone(value);
  if (
    !validProject(p) ||
    p.layoutVersion !== 3 ||
    !Array.isArray(p.excavations)
  )
    throw new ProtocolError("Invalid project.");
  for (const b of p.blocks) {
    if (
      !safeId(b.id) ||
      !Object.hasOwn(SIZES, b.size) ||
      !Object.hasOwn(PALETTE, b.color) ||
      !b.title.trim() ||
      b.title.length > 65 ||
      b.note.length > 600 ||
      b.code.length > 32 ||
      Object.keys(b).some((key) => !fields.has(key))
    )
      throw new ProtocolError("Invalid block.");
    if (
      new Set(b.people).size !== b.people.length ||
      dependenciesOf(b).some(
        (id) => id === b.id || !p.blocks.some((other) => other.id === id),
      )
    )
      throw new ProtocolError("Invalid assignments or prerequisites.");
    if (
      b.dependencies &&
      (new Set(b.dependencies).size !== b.dependencies.length ||
        b.dependency !== (b.dependencies[0] ?? ""))
    )
      throw new ProtocolError("Prerequisites disagree.");
    if (
      Math.abs(b.x) > 1e7 ||
      Math.abs(b.y) > 1e7 ||
      (b.pinnedX !== undefined && Math.abs(b.pinnedX) > 1e7) ||
      (b.pinnedColumn !== undefined && Math.abs(b.pinnedColumn) > 1e5)
    )
      throw new ProtocolError("Block position is too far away.");
  }
  if (
    p.excavations.length > 1000 ||
    p.excavations.some(
      (h) =>
        h.width > 640 ||
        h.height > 640 ||
        Math.abs(h.x) > 1e7 ||
        h.y > 1e7 ||
        (h.blockId !== undefined && !safeId(h.blockId)),
    )
  )
    throw new ProtocolError("Invalid excavated ground.");
  applyMasonry(p);
  return materializeProject(projectDocument(p));
}
function validCell(cell) {
  return (
    cell === null ||
    (cell &&
      typeof cell === "object" &&
      !Array.isArray(cell) &&
      Object.keys(cell).length === 1 &&
      Object.hasOwn(cell, "value"))
  );
}
export function validateCommand(command, projectId) {
  if (
    !command ||
    command.version !== 1 ||
    !safeId(command.id) ||
    !safeId(command.clientId) ||
    command.projectId !== projectId ||
    !Number.isSafeInteger(command.baseRevision) ||
    command.baseRevision < 1 ||
    !["edit", "undo", "redo", "resolve"].includes(command.kind) ||
    typeof command.label !== "string" ||
    command.label.length > 120 ||
    !Array.isArray(command.changes) ||
    !command.changes.length ||
    command.changes.length > 5000
  )
    throw new ProtocolError("Invalid edit command.");
  const paths = new Set();
  for (const change of command.changes) {
    const path = change?.path;
    const allowed =
      Array.isArray(path) &&
      ((path.length === 1 && ["order", "name", "subtitle", "maxPlacements"].includes(path[0])) ||
        (path[0] === "colorLegend" && [2, 3].includes(path.length) &&
          Object.hasOwn(PALETTE, path[1]) && (path.length === 2 || ["color", "label"].includes(path[2]))) ||
        (["blocks", "excavations", "crew", "dividers"].includes(path[0]) &&
          [2, 3].includes(path.length) &&
          (safeId(path[1]) || (path[0] === "excavations" && typeof path[1] === "string" && /^ground:-?[\d.]+:[\d.]+:[\d.]+:[\d.]+$/.test(path[1]))) &&
          (path.length === 2 ||
            (path[0] === "blocks"
              ? fields.has(path[2]) && path[2] !== "id"
              : path[0] === "crew"
                ? CREW_FIELDS.has(path[2]) && path[2] !== "id"
                : path[0] === "dividers"
                  ? DIVIDER_FIELDS.has(path[2]) && path[2] !== "id"
                : ["x", "y", "width", "height", "blockId"].includes(path[2])))));
    if (
      !allowed ||
      !validCell(change.before) ||
      !validCell(change.after) ||
      paths.has(JSON.stringify(path))
    )
      throw new ProtocolError("Invalid field change.");
    paths.add(JSON.stringify(path));
  }
  return command;
}
export function applyCommand(document, command, projectId) {
  validateCommand(command, projectId);
  // Older rooms acquire the original crew before their first roster edit.
  document = { ...document, colorLegend: document.colorLegend ?? {}, crew: document.crew ?? projectDocument(materializeProject(document)).crew, dividers: document.dividers ?? {} };
  const result = applySharedChanges(document, command.changes);
  if (result.skipped.length)
    throw new ProtocolError("This work changed while you were editing.", 409);
  const project = materializeProject(result.document);
  if (
    result.document.order.length !== new Set(result.document.order).size ||
    !equal(
      new Set(result.document.order).size,
      Object.keys(result.document.blocks).length,
    ) ||
    result.document.order.some(
      (id) => !Object.hasOwn(result.document.blocks, id),
    ) ||
    Object.entries(result.document.blocks).some(([id, b]) => b.id !== id) ||
    Object.entries(result.document.crew).some(([id, person]) => person.id !== id) ||
    Object.entries(result.document.dividers).some(([id, divider]) => divider.id !== id)
  )
    throw new ProtocolError("Invalid project structure.");
  return projectDocument(canonicalProject(project));
}
