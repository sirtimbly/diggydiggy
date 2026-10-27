import { blockDimensions } from "../../masonry.js";
import { fractureField, visibleFractures } from "../../fractures.js";
import { hash } from "./random.js";
import { DIGGER } from "../../digger-geometry.js";
import { crewAppearance } from "../project/crew.js";

function helmetTone(color, target, amount) {
  const source = parseInt(color.slice(1), 16);
  return `#${[16, 8, 0].map((shift, index) => Math.round(
    ((source >> shift) & 255) * (1 - amount) + target[index] * amount,
  ).toString(16).padStart(2, "0")).join("")}`;
}

export function pixelLine(c, x1, y1, x2, y2, color, pixel = 2) {
  c.fillStyle = color;
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += pixel) {
    const p = steps ? i / steps : 0;
    c.fillRect(
      Math.round((x1 + (x2 - x1) * p) / pixel) * pixel,
      Math.round((y1 + (y2 - y1) * p) / pixel) * pixel,
      pixel,
      pixel,
    );
  }
}
export function drawSprite(
  canvas,
  person,
  pose = { mode: "idle", frame: 0, facing: 1, phase: 0 },
) {
  const { mode, frame, facing, phase } = pose, c = canvas.getContext("2d");
  const { hairLength, hairColor, glasses, headphones } = crewAppearance(person);
  c.clearRect(0, 0, DIGGER.width, DIGGER.height);
  c.save();
  if (facing < 0) { c.translate(DIGGER.width, 0); c.scale(-1, 1); }
  const bob = (mode === "dig" && frame === 2) || (mode === "walk" && frame % 2) ? 1 : 0;
  const rect = (x, y, w, h, color) => { c.fillStyle = color; c.fillRect(x, y + bob, w, h); };
  // Hair sits behind the shoulders; the face, fringe and accessories layer above it.
  if (hairLength !== "none") {
    const end = { short: 22, medium: 29, long: 36 }[hairLength];
    rect(8, 14, 6, end - 14, hairColor);
    rect(24, 14, 4, end - 16, hairColor);
    if (hairLength === "long") rect(6, 24, 4, 10, hairColor);
  }
  rect(10, 28, 16, 9, person.shirt);
  rect(8, 30, 4, 6, person.shirt);
  rect(24, 30, 4, 6, person.shirt);
  rect(8, 36, 4, 3, person.skin);
  rect(24, 36, 4, 3, person.skin);
  rect(16, 25, 6, 3, person.skin);
  rect(10, 14, 16, 10, person.skin);
  rect(12, 24, 12, 2, person.skin);
  rect(8, 19, 2, 3, person.skin);
  rect(26, 19, 2, 3, person.skin);
  if (hairLength !== "none") {
    rect(10, 14, 4, 6, hairColor);
    rect(14, 14, 8, 2, hairColor);
    if (hairLength !== "short") rect(10, 20, 2, hairLength === "long" ? 12 : 8, hairColor);
  }
  // The band tucks under the helmet; only the ear cups show below its brim.
  if (headphones) {
    rect(12, 4, 12, 2, "#293335");
    rect(8, 6, 2, 10, "#293335");
    rect(26, 6, 2, 10, "#293335");
    rect(6, 15, 5, 8, "#293335");
    rect(7, 16, 2, 5, "#8ca9a5");
    rect(26, 15, 4, 7, "#293335");
    rect(28, 16, 1, 4, "#8ca9a5");
  }
  // A taller, fitted shell with three molded ribs and a projecting brim.
  // Highlights and shadows follow the chosen helmet color, including custom hues.
  const helmetLight = helmetTone(person.color, [255, 244, 213], .4);
  const helmetShade = helmetTone(person.color, [54, 49, 38], .3);
  const brimShade = helmetTone(person.color, [54, 49, 38], .5);
  rect(12, 2, 12, 2, person.color);
  rect(10, 4, 16, 2, person.color);
  rect(8, 6, 20, 6, person.color);
  rect(26, 6, 2, 6, helmetShade);
  rect(10, 10, 16, 2, helmetShade);
  rect(11, 4, 2, 6, helmetLight);
  rect(13, 6, 1, 4, helmetShade);
  rect(23, 4, 2, 6, helmetLight);
  rect(25, 6, 1, 4, helmetShade);
  rect(17, 1, 2, 10, helmetLight);
  rect(19, 3, 1, 8, helmetShade);
  rect(5, 12, 26, 1, helmetLight);
  rect(5, 13, 26, 1, person.color);
  rect(8, 14, 22, 1, brimShade);
  // Face and lenses share eye centers, including mirrored and bobbing poses.
  const eyeXs = [13, 21];
  if (glasses) {
    rect(9, 19, 2, 1, "#293335");
    rect(25, 19, 2, 1, "#293335");
    for (const eyeX of eyeXs) {
      rect(eyeX - 2, 18, 6, 6, "#293335");
      rect(eyeX - 1, 19, 4, 4, person.skin);
      rect(eyeX - 1, 19, 1, 1, "#ecdfbd");
    }
    rect(17, 20, 2, 1, "#293335");
  }
  for (const x of eyeXs) rect(x, 20, 2, 2, "#2a2e2b");
  c.fillStyle = "#3c4244";
  c.fillRect(12, 37, 12, 4);
  if (mode === "walk") {
    const stride = [-2, 0, 2, 0][frame];
    pixelLine(c, 14, 40, 14 + stride, 45, "#3c4244", 2);
    pixelLine(c, 22, 40, 22 - stride, 45, "#3c4244", 2);
    c.fillStyle = "#292b2b";
    c.fillRect(10 + stride, 46, 6, 2);
    c.fillRect(20 - stride, 46, 6, 2);
    pixelLine(c, 27, 32 + bob, 28 - stride, 37, person.skin, 2);
  } else {
    c.fillRect(12, 41, 4, 5); c.fillRect(20, 41, 4, 5);
    c.fillStyle = "#292b2b";
    c.fillRect(10, 46, 6, 2); c.fillRect(20, 46, 6, 2);
  }
  if (mode === "dig") {
    const poses = [[29, 19, 35, 8], [30, 20, 36, 14], [30, 31, 36, 36], [30, 28, 36, 30]];
    const [x, y, ex, ey] = poses[frame];
    pixelLine(c, 26, 32 + bob, ex, ey, "#c3a373", 2);
    pixelLine(c, ex - 6, ey - 2, ex + 2, ey + 2, "#bec3b3", 2);
    c.fillStyle = person.skin; c.fillRect(x - 2, y + 4, 4, 4);
    if (frame === 2) { c.fillStyle = "#e9cb86"; c.fillRect(36, 41, 2, 2); c.fillRect(32, 44, 2, 2); }
  } else if (mode === "coffee") {
    const y = 34 - Math.round(Math.sin(phase * Math.PI) * 10);
    pixelLine(c, 28, 34, 32, y + 4, person.skin, 2);
    c.fillStyle = "#ece0b5"; c.fillRect(31, y, 5, 6); c.fillRect(36, y + 1, 2, 4);
    c.fillStyle = "#765141"; c.fillRect(32, y, 3, 1);
    c.fillStyle = "#d6d5bd"; c.fillRect(33 + (frame % 2), y - 5, 1, 2); c.fillRect(32, y - 8 - (frame % 2), 1, 2);
  } else if (mode === "phone") {
    pixelLine(c, 28, 34, 33, 37, person.skin, 2);
    c.fillStyle = "#202a2e"; c.fillRect(31, 31, 6, 10);
    c.fillStyle = "#9ab8b6"; c.fillRect(32, 32, 4, 6);
    c.fillStyle = "#d5dfc8"; c.fillRect(33, 33 + (frame % 3), 2, 1);
    c.fillStyle = person.skin; c.fillRect(30, 36 + (frame % 2), 3, 2);
  }
  c.restore();
}
export function drawUncertainty(node, block) {
  const face = node.querySelector(".block-surface"),
    [w, h] = blockDimensions(block),
    amount = block.uncertainty / 48;
  if (!amount) {
    face.style.maskImage = "none";
    return;
  }
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const c = mask.getContext("2d"),
    pixel = 4;
  // Keep the whole footprint faintly colored beneath the dirt-like dithering.
  c.globalAlpha = 0.28;
  c.fillRect(0, 0, w, h);
  c.globalAlpha = 1;
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const end = h - 12,
    start = Math.max(12, end * (1 - amount)),
    fade = Math.min(28, Math.max(4, (end - start) * 0.35));
  for (let y = 0; y < h; y += pixel) {
    // An increasingly long obscured band between the known face and bottom rim.
    const down = Math.max(0, Math.min(1, 1 - (y - start) / fade));
    const up = Math.max(0, Math.min(1, (y - (h - 12)) / 8));
    const coverage = Math.max(down, up);
    for (let x = 0; x < w; x += pixel)
      if (
        coverage >
        (bayer[((y / pixel) % 4) * 4 + ((x / pixel) % 4)] + 0.5) / 16
      )
        c.fillRect(x, y, pixel, pixel);
  }
  face.style.maskImage = `url("${mask.toDataURL()}")`;
}
const crackFields = new Map();
export function drawCracks(canvas, block) {
  const [w, h] = blockDimensions(block);
  canvas.width = w;
  canvas.height = h;
  if (block.progress < 1) return;
  let field = crackFields.get(block.id);
  if (!field || field.w !== w || field.h !== h) {
    field = { w, h, edges: fractureField(w, h, hash(block.id) + 6) };
    crackFields.set(block.id, field);
  }
  const c = canvas.getContext("2d");
  for (const { a, b, depth } of visibleFractures(field.edges, block.progress)) {
    c.globalAlpha = depth === 0 ? 0.9 : 0.65;
    pixelLine(c, a.x + 1, a.y + 1, b.x + 1, b.y + 1, "#f6dfb766", 1);
    pixelLine(c, a.x, a.y, b.x, b.y, "#403129", depth === 0 ? 2 : 1);
  }
}
