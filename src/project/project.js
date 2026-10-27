import { DEFAULT_CREW, validCrew, placementLimit, validPlacementLimit } from "./crew.js";
import { validColorLegend } from "./color-legend.js";
import { validDividers } from "./dividers.js";
import {
  MASONRY,
  SIZES,
  RESIZE_LIMITS,
  dependencyOrder,
} from "../../masonry.js";

export const STORAGE = "diggy-project-v1";
export { PALETTE } from "./palette.js";
import { PALETTE } from "./palette.js";
// Kept as a seed export for older fixtures; runtime crew belongs to each project.
export { DEFAULT_CREW as PEOPLE } from "./crew.js";
export const PROJECT_NAME_LIMIT = 80;
export const PROJECT_SUBTITLE_LIMIT = 80;
export const projectName = (project) => project.name ?? "Untitled project";
export const blockNumber = (block) => block.code.replace(/^DIG-/, "").replace(/^0+(?=\d)/, "");
export function emptyProject() {
  return { version: 1, name: "Untitled project", layoutVersion: 3, selected: null, blocks: [], crew: [], dividers: [], colorLegend: {}, excavations: [] };
}
export function demo() {
  return {
    version: 1,
    name: "The next release",
    crew: structuredClone(DEFAULT_CREW),
    selected: "b1",
    blocks: [
      {
        id: "b1",
        code: "DIG-01",
        title: "Authentication",
        note: "A welcoming front door. Sign in, stay signed in, and find your way back when you forget.",
        x: 87,
        y: 206,
        size: "medium",
        color: "amber",
        uncertainty: 24,
        progress: 55,
        people: ["maya", "theo"],
        dependency: "",
        done: false,
      },
      {
        id: "b2",
        code: "DIG-02",
        title: "Component library",
        note: "The shared building blocks. Buttons, inputs, and all the little details that make things feel like us.",
        x: 493,
        y: 186,
        size: "large",
        color: "moss",
        uncertainty: 16,
        progress: 20,
        people: ["jun"],
        dependency: "",
        done: false,
      },
      {
        id: "b3",
        code: "DIG-03",
        title: "Permissions & roles",
        note: "Who gets to do what? We know the basics, but the edge cases are still buried.",
        x: 138,
        y: 432,
        size: "medium",
        color: "lilac",
        uncertainty: 32,
        progress: 0,
        people: [],
        dependency: "b1",
        done: false,
      },
      {
        id: "b4",
        code: "DIG-04",
        title: "Search that feels right",
        note: "Find the right thing, even when you do not quite know what you are looking for.",
        x: 535,
        y: 450,
        size: "medium",
        color: "blue",
        uncertainty: 40,
        progress: 10,
        people: ["sam"],
        dependency: "",
        done: false,
      },
      {
        id: "b5",
        code: "DIG-05",
        title: "Bring your data",
        note: "Import the things people already have. Formats and messy data could make this bigger than it looks.",
        x: 83,
        y: 675,
        size: "large",
        color: "coral",
        uncertainty: 36,
        progress: 0,
        people: [],
        dependency: "",
        done: false,
      },
      {
        id: "b6",
        code: "DIG-06",
        title: "Make it accessible",
        note: "Keyboard journeys, readable contrast, and useful screen reader feedback. Dig through the whole experience.",
        x: 515,
        y: 691,
        size: "medium",
        color: "amber",
        uncertainty: 20,
        progress: 0,
        people: [],
        dependency: "b2",
        done: false,
      },
      {
        id: "b7",
        code: "DIG-07",
        title: "The little details",
        note: "The small things we will notice once the larger pieces fit together.",
        x: 225,
        y: 887,
        size: "small",
        color: "moss",
        uncertainty: 12,
        progress: 0,
        people: [],
        dependency: "",
        done: false,
      },
      {
        id: "b8",
        code: "DIG-08",
        title: "A faster first load",
        note: "A lighter pack for the journey in. We will know more once the core experience is built.",
        x: 596,
        y: 896,
        size: "small",
        color: "lilac",
        uncertainty: 28,
        progress: 0,
        people: [],
        dependency: "",
        done: false,
      },
    ],
  };
}
export function validProject(p) {
  if (
    !p ||
    p.version !== 1 ||
    !Array.isArray(p.blocks) ||
    p.blocks.length > 100
  )
    return false;
  if (p.maxPlacements !== undefined && !validPlacementLimit(p.maxPlacements)) return false;
  if (p.name !== undefined && (typeof p.name !== "string" || !p.name.trim() || p.name.length > PROJECT_NAME_LIMIT)) return false;
  if (p.subtitle !== undefined && (typeof p.subtitle !== "string" || p.subtitle.length > PROJECT_SUBTITLE_LIMIT)) return false;
  if (p.crew === undefined) p.crew = structuredClone(DEFAULT_CREW);
  if (!validCrew(p.crew)) return false;
  if (p.dividers === undefined) p.dividers = [];
  if (!validDividers(p.dividers)) return false;
  if (p.colorLegend !== undefined && !validColorLegend(p.colorLegend)) return false;
  const ids = new Set();
  for (const b of p.blocks) {
    if (
      !b ||
      typeof b.id !== "string" ||
      ids.has(b.id) ||
      typeof b.title !== "string" ||
      typeof b.note !== "string" ||
      typeof b.code !== "string" ||
      !SIZES[b.size] ||
      !PALETTE[b.color]
    )
      return false;
    if (
      ![b.x, b.y, b.progress, b.uncertainty].every(Number.isFinite) ||
      b.progress < 0 ||
      b.progress > 100 ||
      b.uncertainty < 0 ||
      b.uncertainty > 48 ||
      !Array.isArray(b.people) ||
      !b.people.every((id) => p.crew.some((person) => person.id === id && (b.done || !person.archived))) ||
      new Set(b.people).size !== b.people.length
    )
      return false;
    if (typeof b.done !== "boolean" || typeof b.dependency !== "string")
      return false;
    if ((b.blocked !== undefined && typeof b.blocked !== "boolean") ||
      (b.blocked && (b.done || b.people.length))) return false;
    if (
      b.dependencies !== undefined &&
      (!Array.isArray(b.dependencies) ||
        !b.dependencies.every((id) => typeof id === "string"))
    )
      return false;
    ids.add(b.id);
  }
  if (
    p.excavations &&
    (!Array.isArray(p.excavations) ||
      !p.excavations.every(
        (r) =>
          [r.x, r.y, r.width, r.height].every(Number.isFinite) &&
          r.width > 0 &&
          r.y >= MASONRY.surface &&
          r.height > 0,
      ))
  )
    return false;
  for (const b of p.blocks) {
    if (!Number.isInteger(b.pinnedColumn)) delete b.pinnedColumn;
    if (b.pinnedX !== undefined && !Number.isFinite(b.pinnedX))
      delete b.pinnedX;
    if (b.pinnedY !== undefined && (!Number.isFinite(b.pinnedY) || b.pinnedY < MASONRY.top || b.pinnedY > 1e7)) return false;
    if (
      b.width !== undefined &&
      (!Number.isFinite(b.width) ||
        b.width < RESIZE_LIMITS.minWidth ||
        b.width > RESIZE_LIMITS.maxWidth)
    )
      return false;
    if (
      b.height !== undefined &&
      (!Number.isFinite(b.height) ||
        b.height < RESIZE_LIMITS.minHeight ||
        b.height > RESIZE_LIMITS.maxHeight)
    )
      return false;
  }
  try {
    dependencyOrder(p.blocks);
  } catch {
    return false;
  }
  return p.crew.every(
    (person) =>
      p.blocks.filter((b) => !b.done && b.people.includes(person.id)).length <=
      placementLimit(p),
  );
}
