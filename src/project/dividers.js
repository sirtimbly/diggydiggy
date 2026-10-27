import { MASONRY } from "../../masonry.js";

export const DIVIDER_COLORS = Object.freeze({
  sand: { name: "Sand", ink: "#e6bd81" },
  sage: { name: "Sage", ink: "#baca98" },
  mist: { name: "Mist", ink: "#a8ced8" },
  heather: { name: "Heather", ink: "#c7b9df" },
  clay: { name: "Clay", ink: "#e2ac95" },
});
export const DIVIDER_FIELDS = new Set(["id", "label", "x", "y", "color"]);
export const DIVIDER_LIMIT = 50;
export function validDividers(dividers) {
  if (!Array.isArray(dividers) || dividers.length > DIVIDER_LIMIT) return false;
  const ids = new Set();
  return dividers.every((divider) => {
    if (!divider || typeof divider !== "object" || Array.isArray(divider) ||
      typeof divider.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(divider.id) ||
      ["__proto__", "constructor", "prototype"].includes(divider.id) || ids.has(divider.id) ||
      Object.keys(divider).some((key) => !DIVIDER_FIELDS.has(key)) ||
      typeof divider.label !== "string" || !divider.label.trim() || divider.label.length > 60 ||
      !Number.isFinite(divider.x) || Math.abs(divider.x) > 1e7 ||
      !Number.isFinite(divider.y) || divider.y < MASONRY.top || divider.y > 1e7 ||
      !Object.hasOwn(DIVIDER_COLORS, divider.color)) return false;
    ids.add(divider.id);
    return true;
  });
}
export function saveDivider(project, id, values) {
  const next = structuredClone(project);
  next.dividers ??= [];
  const divider = next.dividers.find((item) => item.id === id);
  if (id && !divider) throw new Error("This divider was removed. Add a new divider to mark this phase.");
  if (!divider && next.dividers.length >= DIVIDER_LIMIT) throw new Error(`A dig can have up to ${DIVIDER_LIMIT} dividers.`);
  const fields = {label: values.label.trim(), color: values.color, x: values.x, y: values.y};
  if (divider) Object.assign(divider, fields);
  else next.dividers.push({id: crypto.randomUUID(), ...fields});
  if (!validDividers(next.dividers)) throw new Error("Use a label of 1–60 characters and a position within the dig.");
  return next;
}

export function dividerPosition(x, y) {
  return {x: Math.max(-1e7, Math.min(1e7, Math.round(x / 8) * 8)),
    y: Math.max(MASONRY.top, Math.min(1e7, Math.round(y / 8) * 8))};
}
