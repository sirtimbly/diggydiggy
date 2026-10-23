import {
  MASONRY,
  blockDimensions,
  applyMasonry,
  previewMove,
  previewResize,
  dependenciesOf,
  canAddDependency,
} from "../../masonry.js";
import { installCanvasPanning } from "../../canvas-pan.js";
import { PALETTE, PEOPLE, demo } from "./project.js";
import { createSceneRenderer } from "../rendering/scene.js";
import { createWorkerAnimator } from "../rendering/workers.js";
import {
  pixelLine,
  drawSprite,
  drawUncertainty,
  drawCracks,
} from "../rendering/pixels.js";
import { createProjectStore } from "./store.js";
import { hash, rng } from "../rendering/random.js";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Project commands and pointer gestures coordinate the pure placement model with
// React's committed scene. Pointer previews and canvas pixels stay off React's
// render loop; a commit replaces only the transient scene, preserving form state.
export function createProjectController(commit) {
  const WORLD = { left: 0, right: 900, width: 900, height: 1160 };
  let disposed = false,
    sceneRevision = 0,
    toast = "",
    canvasPanning;
  const listeners = [],
    frames = new Set();
  function listen(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    listeners.push(() => target.removeEventListener(type, handler, options));
  }
  function requestFrame(callback) {
    const id = requestAnimationFrame((time) => {
      frames.delete(id);
      if (!disposed) callback(time);
    });
    frames.add(id);
    return id;
  }
  const store = createProjectStore({
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
  });
  let state = store.getProject();
  let storageAvailable = store.getStatus().storageAvailable;
  let editGroup = null;
  let selectedDigger = null;
  let pendingLink = null;
  let currentLayout = null;
  let inspectorReturnId = null;
  let inspectorMoreOpen = false;
  let crewCollapsed = matchMedia("(max-width:680px)").matches;
  let mode = "inspect";
  let zoom = 1;
  let drag = null;
  let toastTimer;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  const scene = createSceneRenderer({
    get state() {
      return state;
    },
    get zoom() {
      return zoom;
    },
    get drag() {
      return drag;
    },
    get pendingLink() {
      return pendingLink;
    },
    get currentLayout() {
      return currentLayout;
    },
    WORLD,
  });
  const { drawTerrain, drawDependencies, updateDependencyEmphasis } = scene;
  const workers = createWorkerAnimator({ getDrag: () => drag, reducedMotion });
  const cacheSprites = () => workers.cacheSprites();
  function getView() {
    return {
      state,
      selectedDigger,
      crewCollapsed,
      mode,
      inspectorMoreOpen,
      sceneRevision,
      world: { ...WORLD },
      zoom,
      storageAvailable,
      history: store.getStatus(),
      toast,
      isBlocked,
      waitingDependencies,
      blockedReason,
      getBlock,
      placedDiggers,
      activeCount: PEOPLE.filter((p) =>
        state.blocks.some(
          (b) => !b.done && !isBlocked(b) && b.people.includes(p.id),
        ),
      ).length,
    };
  }
  function publish() {
    if (!disposed) commit(getView());
  }
  function save(label = "Edit project") {
    store.commit(state, { label, group: editGroup });
    storageAvailable = store.getStatus().storageAvailable;
    publish();
  }
  function endEdit() {
    editGroup = null;
    store.endGroup();
  }
  function travelHistory(kind) {
    if (drag || canvasPanning?.active || mode !== "inspect") return false;
    endEdit();
    const result = store[kind]();
    if (!result) return false;
    state = result.project;
    pendingLink = null;
    selectedDigger = null;
    if (!getBlock(state.selected)) {
      state.selected = null;
      closeInspector();
    }
    $$(".effect-canvas").forEach((node) => node.remove());
    render();
    storageAvailable = store.getStatus().storageAvailable;
    publish();
    notify(
      result.changes.length
        ? `${kind === "undo" ? "Undid" : "Redid"}: ${result.label}.${result.skipped.length ? " Newer changes were kept." : ""}`
        : "Newer changes were kept. This edit could not be reversed.",
    );
    return true;
  }
  function notify(message) {
    toast = message;
    publish();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast = "";
      publish();
    }, 3500);
  }
  function getBlock(id) {
    return state.blocks.find((b) => b.id === id);
  }
  function waitingDependencies(b) {
    return dependenciesOf(b).filter((id) =>
      state.blocks.some((a) => a.id === id && !a.done),
    );
  }
  function isBlocked(b) {
    return (
      waitingDependencies(b).length > 0 ||
      currentLayout?.access.get(b.id)?.reachable === false
    );
  }
  function blockedReason(b) {
    return waitingDependencies(b).length
      ? "Another block comes first."
      : "Clear the stone above to reach this surface.";
  }
  function placedDiggers(b, layout = currentLayout) {
    if (waitingDependencies(b).length || !layout?.access.get(b.id)?.reachable)
      return [];
    const spots = [];
    for (const [index, r] of layout.access.get(b.id).ranges.entries())
      for (let x = r.x; x + 32 <= r.x + r.width; x += 40)
        spots.push({
          x: x - layout.placements.get(b.id).x,
          range: index,
          min: r.x - layout.placements.get(b.id).x,
          max: r.x + r.width - 32 - layout.placements.get(b.id).x,
        });
    const count = Math.min(b.people.length, spots.length);
    const selected = Array.from(
      { length: count },
      (_, i) =>
        spots[
          Math.min(
            spots.length - 1,
            Math.floor(((i + 0.5) * spots.length) / count),
          )
        ],
    );
    return selected.map((spot, i) => {
      const before = selected[i - 1],
        after = selected[i + 1];
      const min =
        before?.range === spot.range ? (before.x + spot.x) / 2 + 20 : spot.min;
      const max =
        after?.range === spot.range ? (after.x + spot.x) / 2 - 20 : spot.max;
      return {
        id: b.people[i],
        x: Math.max(min, Math.min(max, spot.x)),
        min,
        max,
      };
    });
  }
  function setDependencies(block, ids) {
    block.dependencies = [...new Set(ids)];
    block.dependency = block.dependencies[0] ?? "";
  }
  function addDependency(sourceId, targetId) {
    const result = canAddDependency(state.blocks, sourceId, targetId);
    pendingLink = null;
    if (!result.ok) {
      notify(result.reason);
      drawDependencies();
      return false;
    }
    const b = getBlock(targetId);
    setDependencies(b, [...dependenciesOf(b), sourceId]);
    state.selected = b.id;
    mode = "inspect";
    render();
    save("Link blocks");
    notify(`${getBlock(sourceId).title} comes before ${b.title}.`);
    return true;
  }
  function syncWorldBounds(layout, growOnly = false) {
    const view = $("#pit-viewport"),
      oldLeft = WORLD.left;
    WORLD.left = growOnly ? Math.min(WORLD.left, layout.left) : layout.left;
    WORLD.right = growOnly ? Math.max(WORLD.right, layout.right) : layout.right;
    WORLD.right = Math.max(
      WORLD.right,
      WORLD.left + Math.ceil(view.clientWidth / zoom),
    );
    WORLD.width = WORLD.right - WORLD.left;
    WORLD.height = growOnly
      ? Math.max(WORLD.height, layout.height ?? WORLD.height)
      : layout.height;
    Object.assign($("#pit-world").style, {
      width: `${WORLD.width}px`,
      height: `${WORLD.height}px`,
    });
    const shift = oldLeft - WORLD.left;
    if (shift) {
      $$(
        ".task-block,.excavated-label,#placement-preview,.effect-canvas",
      ).forEach((node) => {
        node.style.left = `${parseFloat(node.style.left) + shift}px`;
      });
      view.scrollLeft += shift * zoom;
    }
    $(".surface-sign").style.left =
      `${(innerWidth <= 680 ? 45 : 58) - WORLD.left}px`;
    $$(".depth-label").forEach(
      (node) => (node.style.left = `${15 - WORLD.left}px`),
    );
    Object.assign($(".undiscovered").style, {
      left: `${280 - WORLD.left}px`,
      top: `${WORLD.height - 126}px`,
    });
  }
  let terrainPending = false;
  function scheduleTerrain() {
    if (terrainPending) return;
    terrainPending = true;
    requestFrame(() => {
      terrainPending = false;
      drawTerrain();
    });
  }

  function positionInspector() {
    const popup = $("#inspector-popup");
    if (!popup.matches(":popover-open")) return;
    const block = state.selected ? getBlock(state.selected) : null;
    const target =
      mode === "new"
        ? null
        : block?.done
          ? $(`#task-layer [data-cleared="${CSS.escape(block.id)}"]`)
          : $(`[data-block="${CSS.escape(block?.id ?? "")}"]`);
    const rect = target?.getBoundingClientRect(),
      width = popup.offsetWidth,
      height = popup.offsetHeight,
      gap = 12;
    let left = rect ? rect.right + gap : (innerWidth - width) / 2;
    if (rect && left + width > innerWidth - gap) left = rect.left - width - gap;
    popup.style.left = `${Math.max(gap, Math.min(innerWidth - width - gap, left))}px`;
    popup.style.top = `${Math.max(gap, Math.min(innerHeight - height - gap, rect?.top ?? 96))}px`;
  }
  function openInspector(returnId = null) {
    inspectorReturnId = returnId ?? state.selected;
    const popup = $("#inspector-popup");
    if (!popup.matches(":popover-open")) popup.showPopover();
    positionInspector();
    popup.focus({ preventScroll: true });
  }
  function closeInspector(restoreFocus = false) {
    const popup = $("#inspector-popup");
    if (!popup.matches(":popover-open")) return;
    popup.hidePopover();
    if (restoreFocus) {
      const target =
        inspectorReturnId === "new-block"
          ? $("#new-block")
          : $(
              `[data-block="${CSS.escape(inspectorReturnId ?? "")}"] .block-hit`,
            );
      target?.focus({ preventScroll: true });
    }
  }
  function renderCrewToggle() {
    publish();
  }
  function renderCrew() {
    publish();
    cacheSprites();
  }
  function renderInspector() {
    publish();
    cacheSprites();
    requestFrame(positionInspector);
  }
  function renderBoard() {
    currentLayout = applyMasonry(state);
    syncWorldBounds(currentLayout, true);
    sceneRevision++;
    publish();
    for (const b of state.blocks.filter((b) => !b.done)) {
      const node = $(`[data-block="${CSS.escape(b.id)}"]`);
      drawUncertainty(node, b);
      drawCracks($(".crack-canvas", node), b);
    }
    drawTerrain();
    cacheSprites();
    requestFrame(positionInspector);
  }
  function render() {
    const focused = document.activeElement;
    const focusId = focused?.id;
    const focusResize = focused?.dataset.resize;
    const resizeBlock = focusResize
      ? focused.closest("[data-block]").dataset.block
      : null;
    const focusBlock = focused?.classList.contains("block-hit")
      ? focused.closest("[data-block]").dataset.block
      : null;
    renderBoard();
    const replacement = focusId
      ? document.getElementById(focusId)
      : focusResize
        ? $(
            `[data-block="${CSS.escape(resizeBlock)}"] [data-resize="${focusResize}"]`,
          )
        : focusBlock
          ? $(`[data-block="${CSS.escape(focusBlock)}"] .block-hit`)
          : null;
    if (replacement && !replacement.disabled)
      replacement.focus({ preventScroll: true });
  }
  function selectBlock(id) {
    if (selectedDigger) {
      assignPerson(selectedDigger, id);
      return;
    }
    if (state.selected !== id) inspectorMoreOpen = false;
    state.selected = id;
    mode = "inspect";
    render();
    save();
    openInspector(id);
  }
  function openNew() {
    selectedDigger = null;
    mode = "new";
    renderCrew();
    renderInspector();
    cacheSprites();
    openInspector("new-block");
  }
  function assignPerson(personId, blockId, sourceId = null) {
    const b = getBlock(blockId),
      p = PEOPLE.find((p) => p.id === personId);
    if (!b || b.done) return;
    if (b.people.includes(personId)) {
      selectedDigger = null;
      state.selected = b.id;
      mode = "inspect";
      render();
      return;
    }
    const sites = state.blocks.filter(
      (a) => !a.done && a.id !== sourceId && a.people.includes(personId),
    );
    if (sites.length >= 2) {
      notify(
        `${p.name} is already digging in two places. Remove one assignment first.`,
      );
      return;
    }
    if (sourceId) {
      const source = getBlock(sourceId);
      if (source) source.people = source.people.filter((id) => id !== personId);
    }
    b.people.push(personId);
    selectedDigger = null;
    state.selected = b.id;
    mode = "inspect";
    render();
    save("Assign digger");
    notify(
      `${p.name} ${isBlocked(b) ? "is lined up here when the way is clear." : "has found a new spot to dig."}`,
    );
  }
  function changeProgress(b, amount) {
    if (b.done || (amount > 0 && isBlocked(b))) return;
    b.progress = Math.max(0, Math.min(100, b.progress + amount));
    if (b.progress === 100) {
      state.excavations.push({ blockId: b.id, ...b.slot });
      b.done = true;
      b.people = [];
      explode(b);
      notify(`${b.title} is out of the ground. Its space stays open.`);
    }
    render();
    save("Update progress");
  }
  function revealSelected() {
    const b = getBlock(state.selected);
    if (!b || b.done) return;
    const view = $("#pit-viewport");
    view.scrollTo({
      left: Math.max(0, (b.x - WORLD.left - 50) * zoom),
      top: Math.max(0, (b.y - 140) * zoom),
      behavior: reducedMotion.matches ? "instant" : "smooth",
    });
  }
  function setZoom(value) {
    zoom = Math.min(1.35, Math.max(0.6, value));
    const world = $("#pit-world");
    // CSS zoom also sizes the scroll area, avoiding a phantom unscaled canvas.
    world.style.zoom = zoom;
    syncWorldBounds(
      { left: WORLD.left, right: WORLD.right, height: WORLD.height },
      true,
    );
    publish();
    scheduleTerrain();
  }
  function fit() {
    setZoom(Math.min(1, $("#pit-viewport").clientWidth / 900));
  }
  function explode(b) {
    if (reducedMotion.matches) return;
    const canvas = document.createElement("canvas"),
      [w, h] = blockDimensions(b);
    canvas.className = "effect-canvas";
    canvas.width = w + 256;
    canvas.height = h + 256;
    Object.assign(canvas.style, {
      inset: "auto",
      left: `${b.x - WORLD.left - 128}px`,
      top: `${b.y - 128}px`,
      width: `${canvas.width}px`,
      height: `${canvas.height}px`,
      zIndex: 20,
    });
    $("#pit-world").append(canvas);
    const c = canvas.getContext("2d"),
      random = rng(hash(b.id)),
      particles = Array.from({ length: 50 }, () => ({
        x: 128 + random() * w,
        y: 128 + random() * h,
        vx: (random() - 0.5) * 6,
        vy: -random() * 6,
        size: 3 + Math.floor(random() * 3) * 2,
      }));
    let start;
    function step(t) {
      start ??= t;
      const age = (t - start) / 1000;
      c.clearRect(0, 0, canvas.width, canvas.height);
      c.globalAlpha = Math.max(0, 1 - age);
      c.fillStyle = PALETTE[b.color].fill;
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        c.fillRect(
          Math.round(p.x / 2) * 2,
          Math.round(p.y / 2) * 2,
          p.size,
          p.size,
        );
      }
      if (age < 1) requestFrame(step);
      else canvas.remove();
    }
    requestFrame(step);
  }

  // Canvas navigation takes priority over grabbing blocks, handles, links, or diggers.
  listen(document, "pointerdown", (e) => {
    suppressClickUntil = 0;
    if (e.button !== 0 || e.target.closest("input,select,textarea")) return;
    const digger = e.target.closest("[data-digger]"),
      block = e.target.closest(".task-block");
    const resize = e.target.closest("[data-resize]");
    const link = e.target.closest("[data-link-out]");
    if (!digger && !block) return;
    if (!digger && !resize && !link && !e.target.closest(".block-hit")) return;
    const el = link || resize || digger || block,
      rect = $("#pit-world").getBoundingClientRect();
    drag = {
      kind: link ? "link" : resize ? "resize" : digger ? "digger" : "block",
      edge: resize?.dataset.resize,
      id: digger?.dataset.digger || block.dataset.block,
      sourceId: digger?.dataset.source || null,
      el,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
      offsetX:
        (e.clientX - rect.left) / zoom +
        WORLD.left -
        (block ? getBlock(block.dataset.block).x : 0),
      offsetY:
        (e.clientY - rect.top) / zoom -
        (block ? getBlock(block.dataset.block).y : 0),
    };
    if (!digger) {
      drag.baseline = structuredClone(state);
    }
    el.setPointerCapture(e.pointerId);
  });
  function updateDrag(e) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (
      !drag.moved &&
      Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) < 5
    )
      return;
    e.preventDefault?.();
    drag.lastPointer = {
      pointerId: e.pointerId,
      clientX: e.clientX,
      clientY: e.clientY,
    };
    pendingLink = null;
    if (drag.kind === "link") {
      drag.moved = true;
      pendingLink = null;
      $$(".is-link-target,.is-invalid-link-target").forEach((node) =>
        node.classList.remove("is-link-target", "is-invalid-link-target"),
      );
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest("[data-block]");
      drag.invalidTarget =
        !!target &&
        !canAddDependency(state.blocks, drag.id, target.dataset.block).ok;
      target?.classList.add(
        drag.invalidTarget ? "is-invalid-link-target" : "is-link-target",
      );
      drawDependencies();
      return;
    }
    if (drag.kind === "resize") {
      drag.moved = true;
      drag.preview = previewResize(
        drag.baseline,
        drag.id,
        drag.edge,
        (e.clientX - drag.startX) / zoom,
        (e.clientY - drag.startY) / zoom,
      );
      showPlacementPreview(drag.preview, drag.id, false);
      const b = drag.preview.blocks.find((b) => b.id === drag.id),
        p = drag.preview.placements.get(b.id),
        [w, h] = blockDimensions(b),
        node = drag.el.closest(".task-block");
      node.classList.add("is-resizing");
      Object.assign(node.style, {
        left: `${p.x - WORLD.left}px`,
        top: `${p.y}px`,
        width: `${w}px`,
        height: `${h}px`,
      });
      drawUncertainty(node, b);
      drawCracks($(".crack-canvas", node), b);
      drawDependencies();
      return;
    }
    if (!drag.moved) {
      drag.moved = true;
      drag.el.classList.add(
        drag.kind === "block" ? "is-dragging" : "moving-source",
      );
      if (drag.kind === "digger") {
        const ghost = document.createElement("div");
        ghost.className = "drag-ghost";
        const sprite = document.createElement("canvas");
        sprite.className = "crew-sprite";
        sprite.width = 32;
        sprite.height = 40;
        ghost.append(sprite);
        document.body.append(ghost);
        drag.ghost = ghost;
        drawSprite(
          $("canvas", ghost),
          PEOPLE.find((p) => p.id === drag.id),
        );
      }
    }
    if (drag.kind === "block") {
      const b = getBlock(drag.id),
        rect = $("#pit-world").getBoundingClientRect(),
        x = (e.clientX - rect.left) / zoom + WORLD.left - drag.offsetX,
        y = (e.clientY - rect.top) / zoom - drag.offsetY;
      const slotX = x,
        slotY = y;
      drag.preview = previewMove(drag.baseline, b.id, slotX, slotY);
      showPlacementPreview(drag.preview, b.id);
      const p = drag.preview.placements.get(b.id);
      drag.orderLimited = dependenciesOf(b).length > 0 && p.y > y + 8;
      const hint = $("#placement-preview span");
      if (hint)
        hint.textContent = drag.orderLimited
          ? "PREREQUISITE COMES FIRST"
          : "SNAP INTO THE GROUND";
      const visibleX = p.x,
        visibleY = p.y;
      drag.el.style.left = `${visibleX - WORLD.left}px`;
      drag.el.style.top = `${visibleY}px`;
      pendingLink = null;
      drawDependencies();
    } else {
      Object.assign(drag.ghost.style, {
        left: `${e.clientX}px`,
        top: `${e.clientY}px`,
      });
      $$(".is-drop-target").forEach((el) =>
        el.classList.remove("is-drop-target"),
      );
      const target = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest(".task-block");
      if (target) target.classList.add("is-drop-target");
    }
  }
  listen(document, "pointermove", updateDrag);
  function panWhileDragging(time) {
    if (
      !drag?.moved ||
      !["block", "link"].includes(drag.kind) ||
      !drag.lastPointer
    )
      return;
    const view = $("#pit-viewport"),
      r = view.getBoundingClientRect(),
      pointer = drag.lastPointer;
    if (
      pointer.clientY < r.top - 32 ||
      pointer.clientY > r.bottom + 32 ||
      pointer.clientX < r.left - 32 ||
      pointer.clientX > r.right + 32
    )
      return;
    const hot = 64,
      dt = Math.min(32, time - (drag.panTime ?? time));
    drag.panTime = time;
    const speed = (start, end) =>
      start < hot
        ? -Math.min(1.5, Math.max(0.15, (hot - start) / hot))
        : end < hot
          ? Math.min(1.5, Math.max(0.15, (hot - end) / hot))
          : 0;
    const dx =
      speed(pointer.clientX - r.left, r.right - pointer.clientX) * dt * 0.7;
    const dy =
      speed(pointer.clientY - r.top, r.bottom - pointer.clientY) * dt * 0.7;
    if (!dx && !dy) return;
    if (dx < 0 && view.scrollLeft < 128)
      syncWorldBounds(
        { left: WORLD.left - 256, right: WORLD.right, height: WORLD.height },
        true,
      );
    if (dx > 0 && view.scrollLeft + view.clientWidth > view.scrollWidth - 128)
      syncWorldBounds(
        { left: WORLD.left, right: WORLD.right + 256, height: WORLD.height },
        true,
      );
    if (dy > 0 && view.scrollTop + view.clientHeight > view.scrollHeight - 128)
      syncWorldBounds(
        { left: WORLD.left, right: WORLD.right, height: WORLD.height + 320 },
        true,
      );
    view.scrollLeft += dx;
    view.scrollTop += dy;
    updateDrag(pointer);
    scheduleTerrain();
  }
  function finishDrag(e, cancel = false) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = drag;
    drag = null;
    d.el.classList.remove("is-dragging", "moving-source");
    d.ghost?.remove();
    $$(".is-drop-target").forEach((el) =>
      el.classList.remove("is-drop-target"),
    );
    $$(".is-link-target,.is-invalid-link-target").forEach((el) =>
      el.classList.remove("is-link-target", "is-invalid-link-target"),
    );
    if (d.el.hasPointerCapture(e.pointerId))
      d.el.releasePointerCapture(e.pointerId);
    if (d.moved) {
      suppressClickUntil = performance.now() + 200;
      if (d.kind === "link") {
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-block]");
        if (!cancel && target) addDependency(d.id, target.dataset.block);
        else {
          drawDependencies();
          if (!cancel)
            notify("Drop the line onto the block that depends on this work.");
        }
      } else if (d.kind === "block" || d.kind === "resize") {
        if (!cancel && d.preview) state.blocks = d.preview.blocks;
        $("#placement-preview")?.remove();
        state.selected = d.id;
        mode = "inspect";
        render();
        save(d.kind === "resize" ? "Resize block" : "Move block");
        if (!cancel && d.kind === "block" && d.orderLimited)
          notify("This block stays below its prerequisites.");
      } else if (!cancel) {
        const target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest(".task-block");
        if (target) assignPerson(d.id, target.dataset.block, d.sourceId);
        else notify("Drop onto a colored block to assign a work site.");
      }
    }
  }
  listen(document, "pointerup", (e) => finishDrag(e));
  listen(document, "pointercancel", (e) => finishDrag(e, true));
  function showPlacementPreview(preview, movingId, showMarker = true) {
    syncWorldBounds(preview, true);
    scheduleTerrain();
    for (const [id, p] of preview.placements) {
      const block = getBlock(id),
        node = $(`[data-block="${CSS.escape(id)}"]`);
      if (!node) continue;
      const spots = placedDiggers(block, preview);
      node.classList.toggle("is-idle", spots.length === 0);
      $$(".block-digger", node).forEach((el) => {
        const spot = spots.find((s) => s.id === el.dataset.digger);
        el.hidden = !spot;
        if (spot) {
          el.style.left = `${spot.x}px`;
          el.dataset.walkMin = spot.min;
          el.dataset.walkMax = spot.max;
        }
      });
      if (id === movingId) continue;
      node.classList.add("is-reflowing");
      node.style.left = `${p.x - WORLD.left}px`;
      node.style.top = `${p.y}px`;
    }
    if (!showMarker) return;
    let marker = $("#placement-preview");
    if (!marker) {
      marker = document.createElement("div");
      marker.id = "placement-preview";
      marker.innerHTML = "<span>SNAP INTO THE GROUND</span>";
      $("#task-layer").append(marker);
    }
    const p = preview.placements.get(movingId).slot;
    marker.style.cssText = `left:${p.x - WORLD.left}px;top:${p.y}px;width:${p.width}px;height:${p.height}px`;
  }
  let suppressClickUntil = 0;
  listen(document, "click", (e) => {
    if (
      canvasPanning.ready ||
      canvasPanning.active ||
      performance.now() < suppressClickUntil
    )
      return;
    const source = e.target.closest("[data-link-out]");
    if (source) {
      pendingLink =
        pendingLink === source.dataset.linkOut ? null : source.dataset.linkOut;
      drawDependencies();
      if (pendingLink)
        notify("Prerequisite selected. Choose the block that depends on it.");
      return;
    }
    if (e.target.closest("[data-resize]")) return;
    const digger = e.target.closest("[data-digger]");
    if (digger) {
      selectedDigger =
        selectedDigger === digger.dataset.digger ? null : digger.dataset.digger;
      renderCrew();
      cacheSprites();
      if (selectedDigger)
        notify(
          `${PEOPLE.find((p) => p.id === selectedDigger).name} selected. Pick a block to dig.`,
        );
      return;
    }
    const block = e.target.closest(".task-block");
    if (block) {
      if (pendingLink) addDependency(pendingLink, block.dataset.block);
      else selectBlock(block.dataset.block);
      return;
    }
    const cleared = e.target.closest("[data-cleared]");
    if (cleared) {
      state.selected = cleared.dataset.cleared;
      mode = "inspect";
      render();
      save();
      $(".cleared-menu").open = false;
      openInspector(state.selected);
    }
  });
  listen(document, "keydown", (e) => {
    if (e.key === "Escape" && drag) {
      finishDrag(
        {
          pointerId: drag.pointerId,
          clientX: drag.startX,
          clientY: drag.startY,
        },
        true,
      );
      return;
    }
    if (e.key === "Escape" && $("#inspector-popup").matches(":popover-open")) {
      e.preventDefault();
      closeInspector(true);
      return;
    }
    if (e.key === "Escape") {
      selectedDigger = null;
      pendingLink = null;
      drawDependencies();
      renderCrew();
      cacheSprites();
      if (mode !== "inspect") {
        mode = "inspect";
        renderInspector();
        cacheSprites();
      }
    }
    const target = e.target.closest(".block-hit"),
      vectors = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
    const handle = e.target.closest("[data-resize]");
    if (handle && vectors[e.key]) {
      e.preventDefault();
      const b = getBlock(handle.closest("[data-block]").dataset.block),
        [dx, dy] = vectors[e.key],
        step = e.shiftKey ? 32 : 8;
      const preview = previewResize(
        state,
        b.id,
        handle.dataset.resize,
        dx * step,
        dy * step,
      );
      state.blocks = preview.blocks;
      state.selected = b.id;
      render();
      save("Resize block");
      return;
    }
    if (target && vectors[e.key]) {
      e.preventDefault();
      const b = getBlock(target.closest("[data-block]").dataset.block),
        [dx, dy] = vectors[e.key];
      if (dx) {
        delete b.pinnedX;
        b.pinnedColumn = b.column + dx * (e.shiftKey ? 3 : 1);
      }
      if (dy) {
        const index = state.blocks.indexOf(b),
          step = e.shiftKey ? 3 : 1;
        state.blocks.splice(index, 1);
        state.blocks.splice(
          Math.max(0, Math.min(state.blocks.length, index + dy * step)),
          0,
          b,
        );
      }
      render();
      save("Move block");
      if (dx) revealSelected();
    }
  });

  const actions = {
    undo: () => travelHistory("undo"),
    redo: () => travelHistory("redo"),
    beginEdit() {
      if (!editGroup) editGroup = crypto.randomUUID();
    },
    endEdit,

    openNew,
    closeInspector,
    changeProgress,
    assignPerson,
    addDependency,
    toggleCrew() {
      crewCollapsed = !crewCollapsed;
      renderCrewToggle();
    },
    editBlock() {
      mode = "edit";
      renderInspector();
    },
    cancelForm() {
      const creating = mode === "new";
      mode = "inspect";
      renderInspector();
      if (creating) closeInspector(true);
    },
    setInspectorMore(open) {
      if (inspectorMoreOpen !== open) {
        inspectorMoreOpen = open;
        publish();
        requestFrame(positionInspector);
      }
    },
    setUncertainty(b, value) {
      b.uncertainty = value;
      renderBoard();
      save("Adjust unknown scope");
    },
    setSize(b, size) {
      b.size = size;
      delete b.width;
      delete b.height;
      render();
      save("Change block size");
    },
    unassign(b, id) {
      b.people = b.people.filter((person) => person !== id);
      render();
      save("Unassign digger");
      notify("A little room to breathe. Digger unassigned.");
    },
    removeDependency(b, id) {
      setDependencies(
        b,
        dependenciesOf(b).filter((parent) => parent !== id),
      );
      render();
      save("Remove dependency");
      notify("Dependency removed.");
    },
    reopenBlock(b) {
      state.excavations = state.excavations.filter((h) => h.blockId !== b.id);
      b.done = false;
      b.progress = 90;
      render();
      save("Reopen block");
      notify("Work reopened. Its excavated space can hold work again.");
    },
    saveBlock(id, values) {
      const b = id ? getBlock(id) : null;
      if (b) Object.assign(b, values);
      else {
        const maxCode = Math.max(
          0,
          ...state.blocks.map((t) => Number(t.code.replace("DIG-", "")) || 0),
        );
        const view = $("#pit-viewport");
        const block = {
          id: crypto.randomUUID(),
          code: `DIG-${String(maxCode + 1).padStart(2, "0")}`,
          ...values,
          size: "medium",
          x: 150 + (maxCode % 3) * 50,
          y: Math.max(
            170,
            Math.min(830, Math.round(view.scrollTop / zoom + 200)),
          ),
          uncertainty: 24,
          progress: 0,
          people: [],
          dependency: "",
          done: false,
        };
        state.blocks.push(block);
        state.selected = block.id;
      }
      mode = "inspect";
      render();
      save("Save block");
      notify(
        b
          ? "The shape of the work is a little clearer."
          : "A new block, ready to explore.",
      );
      revealSelected();
      closeInspector(true);
    },
    deleteBlock(id) {
      state.blocks = state.blocks.filter((b) => b.id !== id);
      state.blocks.forEach((b) =>
        setDependencies(
          b,
          dependenciesOf(b).filter((parent) => parent !== id),
        ),
      );
      state.selected = null;
      mode = "inspect";
      render();
      save("Remove block");
      closeInspector();
      notify("Block removed.");
    },
    openHelp() {
      closeInspector();
      $("#help-dialog").showModal();
    },
    zoomOut() {
      setZoom(zoom - 0.1);
    },
    zoomIn() {
      setZoom(zoom + 0.1);
    },
    resetView() {
      fit();
      $("#pit-viewport").scrollTo({
        left: -WORLD.left * zoom,
        top: 0,
        behavior: reducedMotion.matches ? "instant" : "smooth",
      });
    },
    resetDemo() {
      state = demo();
      mode = "inspect";
      selectedDigger = null;
      render();
      save("Reset demo");
      notify("Fresh ground. The demo is reset.");
    },
  };
  let lastSpriteTime = -1;
  function animate(time) {
    panWhileDragging(time);
    if (drag?.moved && ["block", "resize"].includes(drag.kind))
      drawDependencies();
    if (time - lastSpriteTime >= 70) {
      workers.paint(time);
      lastSpriteTime = time;
    }
    requestFrame(animate);
  }
  let resizeObserver;
  function start() {
    canvasPanning = installCanvasPanning($("#pit-viewport"), {
      canStart: () => !drag,
      onEnd: () => {
        suppressClickUntil = performance.now() + 200;
      },
      onMove(dx, dy) {
        closeInspector();
        const view = $("#pit-viewport");
        // Grow before either horizontal boundary while preserving the grabbed point.
        if (dx > 0 && view.scrollLeft - dx < 128)
          syncWorldBounds(
            {
              left: WORLD.left - Math.max(256, Math.ceil(dx / zoom)),
              right: WORLD.right,
              height: WORLD.height,
            },
            true,
          );
        if (
          dx < 0 &&
          view.scrollLeft - dx + view.clientWidth > view.scrollWidth - 128
        )
          syncWorldBounds(
            {
              left: WORLD.left,
              right: WORLD.right + Math.max(256, Math.ceil(-dx / zoom)),
              height: WORLD.height,
            },
            true,
          );
        if (
          dy < 0 &&
          view.scrollTop - dy + view.clientHeight > view.scrollHeight - 128
        )
          syncWorldBounds(
            {
              left: WORLD.left,
              right: WORLD.right,
              height: WORLD.height + Math.max(320, Math.ceil(-dy / zoom)),
            },
            true,
          );
        view.scrollLeft -= dx;
        view.scrollTop -= dy;
        scheduleTerrain();
      },
    });

    listen(document, "visibilitychange", () => {
      if (document.hidden) workers.pause();
    });
    let emphasisPending = false;
    const scheduleEmphasis = () => {
      if (emphasisPending) return;
      emphasisPending = true;
      requestFrame(() => {
        emphasisPending = false;
        updateDependencyEmphasis();
      });
    };
    for (const event of ["pointerover", "pointerout", "focusin", "focusout"])
      listen($("#pit-viewport"), event, scheduleEmphasis);
    listen(window, "resize", positionInspector);
    listen(window, "blur", endEdit);
    listen($("#inspector-popup"), "toggle", (event) => {
      if (event.newState === "closed" && mode !== "inspect") {
        mode = "inspect";
        renderInspector();
      }
    });
    listen($("#pit-viewport"), "wheel", () => closeInspector(), {
      passive: true,
    });
    listen(
      $("#pit-viewport"),
      "scroll",
      () => {
        const view = $("#pit-viewport");
        requestFrame(positionInspector);
        if (
          view.scrollTop > 0 &&
          view.scrollTop + view.clientHeight > view.scrollHeight - 128
        )
          syncWorldBounds(
            {
              left: WORLD.left,
              right: WORLD.right,
              height: WORLD.height + 480,
            },
            true,
          );
        scheduleTerrain();
      },
      { passive: true },
    );
    render();
    save();
    fit();
    requestFrame(animate);
    const brand = $(".brand-pick").getContext("2d");
    pixelLine(brand, 6, 28, 23, 6, "#68794b", 4);
    pixelLine(brand, 7, 4, 27, 12, "#344d34", 4);
    pixelLine(brand, 11, 2, 19, 2, "#344d34", 4);
    pixelLine(brand, 27, 12, 27, 16, "#344d34", 4);
    let previousWidth = $("#pit-viewport").clientWidth;
    resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0].contentRect.width;
      if (Math.abs(width - previousWidth) > 20) {
        previousWidth = width;
        fit();
      }
    });
    resizeObserver.observe($("#pit-viewport"));
  }
  function dispose() {
    if (drag)
      finishDrag(
        {
          pointerId: drag.pointerId,
          clientX: drag.startX,
          clientY: drag.startY,
        },
        true,
      );
    disposed = true;
    canvasPanning?.dispose();
    resizeObserver?.disconnect();
    workers.dispose();
    listeners.forEach((remove) => remove());
    frames.forEach(cancelAnimationFrame);
    frames.clear();
    clearTimeout(toastTimer);
    closeInspector();
    $$(".drag-ghost,.effect-canvas,#placement-preview").forEach((node) =>
      node.remove(),
    );
  }
  function receiveRemote(snapshot) {
    // Never replace nodes underneath an active gesture or an unsaved text form.
    if (drag || mode !== "inspect" || editGroup)
      return { applied: false, deferred: true };
    const result = store.receive(snapshot);
    if (result.applied) {
      state = result.project;
      if (!getBlock(state.selected)) {
        state.selected = null;
        closeInspector();
      }
      render();
    }
    return result;
  }
  return { getView, actions, start, dispose, store, receiveRemote };
}
