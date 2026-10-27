import { excavationRects, dependenciesOf } from "../../masonry.js";
import { routeDependency } from "../../dependency-lines.js";
import { rng, hash } from "./random.js";
import { pixelLine } from "./pixels.js";
import { escapeHTML } from "./icons.js";
import { drawDinosaurFossil, drawPortaPotty, drawDwarf, drawBalrog, clearDiscoveryObstacles, FOSSIL_TOP, DWARF_TOP, BALROG_TOP, BALROG_HEIGHT } from "./terrain-props.js";
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
export const SURFACE_SIGN_LEFT = 280;

export function createSceneRenderer(context) {
  const getBlock = (id) => context.state.blocks.find((b) => b.id === id);
  let discoveryPaint = null, discoveryFrame = -1;
  function drawDiscoveries(time = 0, force = false) {
    const paint = discoveryPaint;
    if (!paint || document.hidden) return;
    const animated = paint.bottom > DWARF_TOP && paint.top < BALROG_TOP + BALROG_HEIGHT;
    const frame = context.reducedMotion ? 0 : Math.floor(time / 140);
    if (!force && (!animated || frame === discoveryFrame)) return;
    discoveryFrame = frame;
    const canvas = $("#discoveries"), c = canvas.getContext("2d");
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.translate(-paint.left, -paint.top);
    if (paint.bottom > FOSSIL_TOP && paint.top < FOSSIL_TOP + 256) drawDinosaurFossil(c);
    if (paint.bottom > DWARF_TOP && paint.top < DWARF_TOP + 100) drawDwarf(c, frame * 140);
    if (paint.bottom > BALROG_TOP && paint.top < BALROG_TOP + BALROG_HEIGHT) drawBalrog(c, frame * 140);
    const { state, drag, currentLayout } = context;
    const placements = (drag?.preview ?? currentLayout)?.placements ?? new Map();
    clearDiscoveryObstacles(c, placements, excavationRects(placements, state.excavations));
  }
  // Canvas owns terrain pixels and geometric dependency paths; React owns task UI.
  function drawTerrain() {
    const { WORLD, zoom } = context;
    const view = $("#pit-viewport"),
      canvas = $("#terrain");
    const x = Math.max(0, Math.floor(view.scrollLeft / zoom / 128) * 128 - 128),
      y = Math.max(0, Math.floor(view.scrollTop / zoom / 128) * 128 - 128);
    const width = Math.max(
      1,
      Math.min(WORLD.width - x, Math.ceil(view.clientWidth / zoom) + 384),
    );
    const height = Math.max(
      1,
      Math.min(WORLD.height - y, Math.ceil(view.clientHeight / zoom) + 384),
    );
    canvas.width = width;
    canvas.height = height;
    Object.assign(canvas.style, {
      inset: "auto",
      left: `${x}px`,
      top: `${y}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
    const paint = {
      left: WORLD.left + x,
      top: y,
      right: WORLD.left + x + width,
      bottom: y + height,
      width,
      height,
    };
    const discoveries = $("#discoveries");
    discoveries.width = width; discoveries.height = height;
    Object.assign(discoveries.style, {left:`${x}px`, top:`${y}px`, width:`${width}px`, height:`${height}px`});
    discoveryPaint = paint;
    const c = canvas.getContext("2d");
    const random = rng(84);
    c.translate(-paint.left, -paint.top);
    c.fillStyle = "#332d2b";
    c.fillRect(paint.left, paint.top, width, height);
    c.fillStyle = "#3e332d";
    c.fillRect(paint.left, 110, width, 210);
    c.fillStyle = "#382f2a";
    c.fillRect(paint.left, 320, width, 320);
    c.fillStyle = "#302c2c";
    c.fillRect(paint.left, 640, width, WORLD.height - 640);
    for (
      let y = Math.max(115, Math.floor(paint.top / 16) * 16 + 3);
      y < paint.bottom;
      y += 16
    )
      for (let x = Math.floor(paint.left / 16) * 16; x < paint.right; x += 16) {
        const random = rng(hash(`${x}:${y}`));
        const v = random();
        c.fillStyle =
          v < 0.15
            ? "#534236"
            : v < 0.32
              ? "#473a32"
              : v < 0.6
                ? "#2f2927"
                : "#3b312b";
        c.globalAlpha = y > 650 ? 0.4 : 0.55;
        if (v < 0.52)
          c.fillRect(
            x + (y % 32 ? 8 : 0),
            y,
            12 + Math.floor(random() * 10),
            4 + Math.floor(random() * 8),
          );
      }
    c.globalAlpha = 1;
    for (let i = 0; i < 95; i++) {
      const x = Math.floor(random() * 225) * 4,
        y = 130 + Math.floor(random() * 230) * 4;
      c.fillStyle = "#605044";
      c.fillRect(x, y, 8, 4);
      c.fillStyle = "#241f22";
      c.fillRect(x + 4, y + 4, 8, 4);
    }
    c.fillStyle = "#78825b";
    c.fillRect(paint.left, 0, width, 100);
    c.fillStyle = "#677650";
    for (let x = Math.floor(paint.left / 20) * 20; x < paint.right; x += 20) {
      const random = rng(hash(`hill:${x}`));
      const h = 12 + Math.floor((random() * 30) / 4) * 4;
      c.fillRect(x, 100 - h, 24, h);
    }
    c.fillStyle = "#536a42";
    c.fillRect(paint.left, 88, width, 16);
    for (let x = Math.floor(paint.left / 8) * 8; x < paint.right; x += 8) {
      const random = rng(hash(`grass:${x}`));
      c.fillStyle = random() > 0.5 ? "#8d9d5b" : "#a0ab68";
      c.fillRect(x, 88 + (random() > 0.5 ? -4 : 0), 8, 8);
      c.fillStyle = "#70854b";
      c.fillRect(x, 96, 8, 4 + Math.floor(random() * 4) * 4);
      if (random() > 0.8) {
        c.fillStyle = "#a4b46c";
        c.fillRect(x, 76, 4, 12);
      }
    }
    // A small timber sign, grass tufts, fence, and the forgotten shovel at the surface.
    c.fillStyle = "#514b34";
    c.fillRect(SURFACE_SIGN_LEFT, 17, 242, 54);
    c.fillRect(SURFACE_SIGN_LEFT + 16, 65, 8, 25);
    c.fillRect(SURFACE_SIGN_LEFT + 213, 65, 8, 25);
    c.fillStyle = "#9c9970";
    c.fillRect(SURFACE_SIGN_LEFT, 17, 242, 3);
    c.fillRect(SURFACE_SIGN_LEFT, 17, 3, 54);
    c.fillStyle = "#525f3d";
    for (let x = 620; x < 880; x += 58) {
      c.fillRect(x, 58, 6, 31);
    }
    c.fillRect(620, 66, 238, 5);
    c.fillRect(620, 79, 238, 4);
    pixelLine(c, 580, 47, 598, 83, "#b6a077", 4);
    c.fillStyle = "#a9afa0";
    c.fillRect(591, 76, 12, 9);
    c.fillRect(435, 84, 8, 4);
    drawPortaPotty(c);
    for (let i = 0; i < 25; i++) {
      const x = Math.floor(random() * 215) * 4,
        y = Math.floor(random() * 16) * 4;
      c.fillStyle = "#8c9567";
      c.fillRect(x, y, 4, 4);
    }
    // Embedded mineral seams remain subdued so work blocks carry the color.
    for (const [x, y, color] of [
      [35, 530, "#8d784d"],
      [840, 365, "#76836b"],
      [437, 805, "#82708c"],
      [50, 980, "#7b6858"],
      [820, 1020, "#688188"],
    ]) {
      c.globalAlpha = 0.7;
      for (let i = 0; i < 7; i++) {
        c.fillStyle = color;
        c.fillRect(
          x + Math.floor(random() * 10) * 4,
          y + Math.floor(random() * 7) * 4,
          4,
          4,
        );
      }
      c.globalAlpha = 1;
    }
    drawGeology(c, paint);
    drawDiscoveries(performance.now(), true);
    drawDependencies();
  }
  function drawDependencies() {
    const { WORLD, zoom, state, drag, pendingLink } = context;
    const root = $("#dependency-lines");
    if (!root) return;
    const canvas = $("#terrain"),
      x = parseFloat(canvas.style.left) || 0,
      y = parseFloat(canvas.style.top) || 0,
      w = canvas.width,
      h = canvas.height;
    Object.assign(root.style, {
      left: `${x}px`,
      top: `${y}px`,
      width: `${w}px`,
      height: `${h}px`,
    });
    root.setAttribute("viewBox", `${WORLD.left + x} ${y} ${w} ${h}`);
    function anchor(id, end) {
      const node = $(`[data-block="${CSS.escape(id)}"]`);
      if (node)
        return {
          x: node.offsetLeft + WORLD.left + node.offsetWidth - 20,
          y: node.offsetTop + (end ? node.offsetHeight - 20 : 20),
        };
      const hole = state.excavations?.find((h) => h.blockId === id);
      return hole
        ? { x: hole.x + hole.width * 0.75, y: hole.y + (end ? hole.height : 0) }
        : null;
    }
    function path(a, b, sourceId, targetId) {
      const obstacles = $$(".task-block")
        .filter(
          (n) => n.dataset.block !== sourceId && n.dataset.block !== targetId,
        )
        .map((n) => ({
          x: n.offsetLeft + WORLD.left,
          y: n.offsetTop,
          width: n.offsetWidth,
          height: n.offsetHeight,
        }));
      const points = routeDependency(a, b, sourceId ? obstacles : []);
      return points.map((p, i) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
    }
    const markers = {
      normal: "#bdc9a2",
      active: "#f1e6ab",
      invalid: "#e69d84",
    };
    let paths =
      "<defs>" +
      Object.entries(markers)
        .map(
          ([name, color]) =>
            `<marker id="dependency-arrow-${name}" viewBox="0 0 10 10" refX="6" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M 3 2 L 6 5 L 3 8" fill="none" stroke="#1d2523" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M 3 2 L 6 5 L 3 8" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>`,
        )
        .join("") +
      "</defs>";
    const connectedOutputs = new Set(), connectedInputs = new Set();
    for (const b of state.blocks.filter((b) => !b.done))
      for (const id of dependenciesOf(b)) {
        const a = anchor(id, true),
          end = anchor(b.id, false);
        if (!a || !end) continue;
        connectedOutputs.add(id);
        connectedInputs.add(b.id);
        const d = path(a, end, id, b.id),
          active = state.selected === b.id || state.selected === id;
        paths += `<g class="dependency-connection" data-from="${escapeHTML(id)}" data-to="${escapeHTML(b.id)}"><path class="dependency-shadow" d="${d}"/><path class="dependency-line ${active ? "is-active" : ""}" d="${d}" marker-end="url(#dependency-arrow-${active ? "active" : "normal"})" data-from="${escapeHTML(id)}" data-to="${escapeHTML(b.id)}"><title>${escapeHTML(getBlock(id)?.title ?? "Cleared work")} must precede ${escapeHTML(b.title)}</title></path></g>`;
      }
    const sourceId = drag?.kind === "link" ? drag.id : pendingLink,
      source = sourceId ? anchor(sourceId, true) : null;
    if (source) {
      const pointer = drag?.kind === "link" ? drag.lastPointer : null;
      if (pointer) {
        const r = $("#pit-world").getBoundingClientRect(),
          end = {
            x: (pointer.clientX - r.left) / zoom + WORLD.left,
            y: (pointer.clientY - r.top) / zoom,
          };
        paths += `<path class="dependency-draft ${drag.invalidTarget ? "is-invalid" : ""}" d="${path(source, end)}" marker-end="url(#dependency-arrow-${drag.invalidTarget ? "invalid" : "active"})"/>`;
      } else
        paths += `<circle cx="${source.x}" cy="${source.y}" r="9" fill="none" stroke="#f6e8a6" stroke-width="2"/>`;
    }
    root.innerHTML = paths;
    updateDependencyEmphasis();
    $$(".dependency-port").forEach((p) => {
      p.classList.toggle("is-link-source", p.dataset.linkOut === pendingLink);
      p.classList.toggle("is-connected", p.dataset.linkOut
        ? connectedOutputs.has(p.dataset.linkOut)
        : connectedInputs.has(p.dataset.linkIn));
    });
  }
  function updateDependencyEmphasis() {
    const highlighted = new Set(
      $$(
        ".task-block:hover,.task-block:focus-within,.excavated-label:hover,.excavated-label:focus-visible",
      ).map((node) => node.dataset.block ?? node.dataset.cleared),
    );
    $$(".dependency-connection").forEach((connection) => {
      connection.classList.toggle(
        "is-emphasized",
        highlighted.has(connection.dataset.from) ||
          highlighted.has(connection.dataset.to),
      );
    });
  }
  function drawGeology(c, paint) {
    const { state, drag, currentLayout } = context;
    const rectangles = excavationRects(
      (drag?.preview ?? currentLayout)?.placements ?? new Map(),
      state.excavations,
    );
    // One clipped union keeps shafts and extracted cavities visually connected.
    c.save();
    c.beginPath();
    for (const r of rectangles) c.rect(r.x, r.y, r.width, r.height);
    c.clip();
    const unit = 4,
      cells = new Set();
    for (const r of rectangles) {
      const startX = Math.floor(Math.max(r.x, paint.left - unit) / unit) * unit,
        endX = Math.min(r.x + r.width, paint.right + unit);
      const startY = Math.floor(Math.max(r.y, paint.top - unit) / unit) * unit,
        endY = Math.min(r.y + r.height, paint.bottom + unit);
      for (let y = startY; y < endY; y += unit)
        for (let x = startX; x < endX; x += unit) cells.add(`${x},${y}`);
    }
    for (const cell of cells) {
      const [x, y] = cell.split(",").map(Number);
      c.fillStyle = "#1d2221";
      c.fillRect(x, y, unit, unit);
      // Only union boundaries get a rim. Adjacent removed blocks form a single hole.
      if (!cells.has(`${x - unit},${y}`)) {
        c.fillStyle = "#151a1a";
        c.fillRect(x, y, 2, unit);
      }
      if (!cells.has(`${x + unit},${y}`)) {
        c.fillStyle = "#72604a";
        c.fillRect(x + unit - 2, y, 2, unit);
      }
      if (!cells.has(`${x},${y + unit}`)) {
        c.fillStyle = "#8c7452";
        c.fillRect(x, y + unit - 2, unit, 2);
      }
      if (!cells.has(`${x},${y - unit}`) && y > 96) {
        c.fillStyle = "#111818";
        c.fillRect(x, y, unit, 2);
      }
    }
    c.restore();
  }

  return { drawTerrain, drawDependencies, updateDependencyEmphasis, drawDiscoveries };
}
