export const DEFAULT_CREW = [
  { id: "maya", name: "Maya", color: "#deb969", shirt: "#a76a50", skin: "#d9a17b", archived: false },
  { id: "theo", name: "Theo", color: "#a5b99a", shirt: "#678e8a", skin: "#b87e5b", archived: false },
  { id: "jun", name: "Jun", color: "#bbb0d2", shirt: "#8a77ac", skin: "#e3bd91", archived: false },
  { id: "sam", name: "Sam", color: "#d49d89", shirt: "#b48166", skin: "#9a684a", archived: false },
];
export const CREW_LIMIT = 50;
export const DEFAULT_MAX_PLACEMENTS = 2;
export const MAX_PLACEMENTS = 8;
export const placementLimit = (project) => project.maxPlacements ?? DEFAULT_MAX_PLACEMENTS;
export const validPlacementLimit = (value) => Number.isInteger(value) && value >= 1 && value <= MAX_PLACEMENTS;
export function setPlacementLimit(project, value) {
  if (!validPlacementLimit(value)) throw new Error(`Choose a whole number from 1 to ${MAX_PLACEMENTS}.`);
  const overloaded = crewOf(project).filter((person) => project.blocks.filter((block) => !block.done && block.people.includes(person.id)).length > value);
  if (overloaded.length) throw new Error(`${overloaded.map((person) => person.name).join(", ")} ${overloaded.length === 1 ? "has" : "have"} more than ${value} ${value === 1 ? "placement" : "placements"}. Remove assignments before lowering the limit.`);
  return { ...project, maxPlacements: value };
}
export const HAIR_LENGTHS = ["none", "short", "medium", "long"];
export const DEFAULT_APPEARANCE = Object.freeze({ hairLength: "short", hairColor: "#604133", glasses: false, headphones: false });
// Defaults are read without rewriting legacy members or pending sync commands.
export const crewAppearance = (person) => ({ ...DEFAULT_APPEARANCE, ...person });
export const CREW_FIELDS = new Set(["id", "name", "color", "shirt", "skin", "archived", ...Object.keys(DEFAULT_APPEARANCE)]);
export const crewOf = (project) => project.crew ?? DEFAULT_CREW;
export const activeCrew = (project) => crewOf(project).filter((person) => !person.archived);
export function validCrew(crew) {
  if (!Array.isArray(crew) || crew.length > CREW_LIMIT) return false;
  const ids = new Set();
  return crew.every((person) => {
    if (!person || typeof person !== "object" || Array.isArray(person) ||
      typeof person.id !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(person.id) ||
      ["__proto__", "constructor", "prototype"].includes(person.id) || ids.has(person.id) ||
      typeof person.name !== "string" || !person.name.trim() || person.name.length > 60 ||
      typeof person.archived !== "boolean" ||
      Object.keys(person).some((key) => !CREW_FIELDS.has(key)) ||
      ![person.color, person.shirt, person.skin].every((color) => typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color)) ||
      (person.hairColor !== undefined && (typeof person.hairColor !== "string" || !/^#[0-9a-f]{6}$/i.test(person.hairColor))) ||
      (person.hairLength !== undefined && !HAIR_LENGTHS.includes(person.hairLength)) ||
      ["glasses", "headphones"].some((field) => person[field] !== undefined && typeof person[field] !== "boolean")) return false;
    ids.add(person.id);
    return true;
  });
}
export function saveCrewMember(project, id, values) {
  const next = structuredClone(project);
  next.crew ??= structuredClone(DEFAULT_CREW);
  const person = next.crew.find((member) => member.id === id);
  if (id && !person) throw new Error("This digger was removed. Return to the crew list and try again.");
  if (!person && next.crew.length >= CREW_LIMIT) throw new Error(`A project can have up to ${CREW_LIMIT} diggers, including archived members.`);
  const custom = { ...DEFAULT_APPEARANCE, ...person, ...values };
  const appearance = {name: values.name.trim(), color: values.color, shirt: values.shirt, skin: values.skin};
  for (const [field, fallback] of Object.entries(DEFAULT_APPEARANCE)) {
    // Renaming an older digger must not claim untouched appearance fields when
    // a teammate is personalizing that same digger at the same time.
    if (!person || Object.hasOwn(person, field) || custom[field] !== fallback) appearance[field] = custom[field];
  }
  if (person) Object.assign(person, appearance);
  else next.crew.push({id: crypto.randomUUID(), ...appearance, archived: false});
  if (!validCrew(next.crew)) throw new Error("Enter a name of 1–60 characters and choose valid colors and appearance options.");
  return next;
}
export function archiveCrewMember(project, id, archived) {
  const next = structuredClone(project);
  next.crew ??= structuredClone(DEFAULT_CREW);
  const person = next.crew.find((member) => member.id === id);
  if (!person) throw new Error("This digger is no longer in the crew.");
  person.archived = archived;
  if (archived) for (const block of next.blocks) block.people = block.people.filter((memberId) => memberId !== id);
  return next;
}
