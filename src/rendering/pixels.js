import { blockDimensions } from "../../masonry.js";
import { fractureField, visibleFractures } from "../../fractures.js";
import { hash } from "./random.js";

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
  const { mode, frame, facing, phase } = pose,
    c = canvas.getContext("2d");
  c.clearRect(0, 0, 32, 40);
  c.save();
  if (facing < 0) {
    c.translate(32, 0);
    c.scale(-1, 1);
  }
  const bob =
    (mode === "dig" && frame === 2) || (mode === "walk" && frame % 2) ? 1 : 0;
  const rows = [
    "     hhhhh      ",
    "    hhhhhhh     ",
    "   hhhhhhhhh    ",
    "   hhhlhhhhh    ",
    "  hhhhhhhhhhh   ",
    "    ssssdd      ",
    "    ssssd       ",
    "    ssesd       ",
    "     ssss       ",
    "    tttttt      ",
    "   tttttttt     ",
    "   stttttts     ",
    "   stttttts     ",
    "    tttttt      ",
    "    pppppp      ",
    "    pp  pp      ",
    "    pp  pp      ",
    "   bbb  bbb     ",
  ];
  const colors = {
    h: person.color,
    l: "#f7e6a0",
    s: person.skin,
    d: "#714f3e",
    e: "#2a2e2b",
    t: person.shirt,
    p: "#3c4244",
    b: "#292b2b",
  };
  rows.forEach((row, y) =>
    [...row].forEach((v, x) => {
      if (colors[v] && !(mode === "walk" && y >= 14)) {
        c.fillStyle = colors[v];
        c.fillRect(x * 2, y * 2 + 3 + (y < 14 ? bob : 0), 2, 2);
      }
    }),
  );
  if (mode === "walk") {
    const stride = [-3, 0, 3, 0][frame];
    pixelLine(c, 12, 30, 12 + stride, 36, "#3c4244", 3);
    pixelLine(c, 19, 30, 19 - stride, 36, "#3c4244", 3);
    c.fillStyle = "#292b2b";
    c.fillRect(10 + stride, 37, 6, 3);
    c.fillRect(17 - stride, 37, 6, 3);
    pixelLine(c, 24, 24 + bob, 25 - stride, 29, person.skin, 2);
  } else if (mode === "dig") {
    const poses = [
      [23, 13, 29, 5],
      [24, 14, 30, 9],
      [24, 23, 31, 28],
      [24, 20, 31, 24],
    ];
    const [x, y, ex, ey] = poses[frame];
    pixelLine(c, 22, 24 + bob, ex, ey, "#c3a373", 2);
    pixelLine(c, ex - 5, ey - 2, ex + 3, ey + 2, "#bec3b3", 2);
    c.fillStyle = person.skin;
    c.fillRect(x - 2, y + 4, 4, 4);
    if (frame === 2) {
      c.fillStyle = "#e9cb86";
      c.fillRect(29, 33, 2, 2);
      c.fillRect(25, 36, 2, 2);
    }
  } else if (mode === "coffee") {
    const y = 26 - Math.round(Math.sin(phase * Math.PI) * 8);
    pixelLine(c, 24, 26, 26, y + 4, person.skin, 3);
    c.fillStyle = "#ece0b5";
    c.fillRect(25, y, 5, 6);
    c.fillRect(30, y + 1, 2, 4);
    c.fillStyle = "#765141";
    c.fillRect(26, y, 3, 1);
    c.fillStyle = "#d6d5bd";
    c.fillRect(27 + (frame % 2), y - 5, 1, 2);
    c.fillRect(26, y - 8 - (frame % 2), 1, 2);
  } else if (mode === "phone") {
    pixelLine(c, 24, 26, 27, 29, person.skin, 3);
    c.fillStyle = "#202a2e";
    c.fillRect(25, 23, 6, 10);
    c.fillStyle = "#9ab8b6";
    c.fillRect(26, 24, 4, 6);
    c.fillStyle = "#d5dfc8";
    c.fillRect(27, 25 + (frame % 3), 2, 1);
    c.fillStyle = person.skin;
    c.fillRect(24, 28 + (frame % 2), 3, 2);
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
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const end = h - 12,
    start = Math.max(12, end * (1 - amount)),
    fade = Math.min(28, Math.max(4, (end - start) * 0.35));
  for (let y = 0; y < h; y += pixel) {
    // An increasingly long absence between the known beginning and a returning bottom rim.
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
