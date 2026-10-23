import {
  MASONRY,
  SIZES,
  RESIZE_LIMITS,
  dependencyOrder,
} from "../../masonry.js";

export const STORAGE = "diggy-project-v1";
export const PALETTE = {
  amber: { fill: "#ddb472", shade: "#a07f4b", name: "Amber" },
  moss: { fill: "#a7bc83", shade: "#788e5c", name: "Moss" },
  lilac: { fill: "#b4a6cf", shade: "#857598", name: "Lilac" },
  coral: { fill: "#d9957d", shade: "#9e6959", name: "Coral" },
  blue: { fill: "#8eb7c3", shade: "#5f8999", name: "Blue" },
};
export const PEOPLE = [
  {
    id: "maya",
    name: "Maya",
    color: "#deb969",
    shirt: "#a76a50",
    skin: "#d9a17b",
  },
  {
    id: "theo",
    name: "Theo",
    color: "#a5b99a",
    shirt: "#678e8a",
    skin: "#b87e5b",
  },
  {
    id: "jun",
    name: "Jun",
    color: "#bbb0d2",
    shirt: "#8a77ac",
    skin: "#e3bd91",
  },
  {
    id: "sam",
    name: "Sam",
    color: "#d49d89",
    shirt: "#b48166",
    skin: "#9a684a",
  },
];
export function demo() {
  return {
    version: 1,
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
      !b.people.every((id) => PEOPLE.some((p) => p.id === id))
    )
      return false;
    if (typeof b.done !== "boolean" || typeof b.dependency !== "string")
      return false;
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
  return PEOPLE.every(
    (person) =>
      p.blocks.filter((b) => !b.done && b.people.includes(person.id)).length <=
      2,
  );
}
