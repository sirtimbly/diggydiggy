import { activeCrew, saveCrewMember, archiveCrewMember, placementLimit, setPlacementLimit } from "./crew.js";
import { setBlockBlocked } from "./blocking.js";
import { DIGGER } from "../../digger-geometry.js";
import { belowBlockTarget, creationPlacement, insertCreatedBlock } from "./creation.js";
import { createBlockColorPreference } from "./color-preference.js";
import { blockByNumber, canvasTargetPlan, nextBlockTarget } from "./navigation.js";
import { canvasShortcut } from "./shortcuts.js";
import { DIVIDER_COLORS, dividerPosition, saveDivider } from "./dividers.js";
import {
  MASONRY,
  blockDimensions,
  applyMasonry,
  previewMove,
  previewResize,
  previewGrowToEdge,
  dependenciesOf,
  canAddDependency,
} from "../../masonry.js";
import { installCanvasPanning } from "../../canvas-pan.js";
import { installCanvasZoom } from "../../canvas-zoom.js";
import { projectPalette, validColorLegend } from "./color-legend.js";
import { PALETTE, demo, STORAGE, PROJECT_NAME_LIMIT, PROJECT_SUBTITLE_LIMIT } from "./project.js";
import { createSceneRenderer, SURFACE_SIGN_LEFT } from "../rendering/scene.js";
import { createWorkerAnimator } from "../rendering/workers.js";
import {
  drawSprite,
  drawUncertainty,
  drawCracks,
} from "../rendering/pixels.js";
import { createProjectStore } from "./store.js";
import { guardProjectEdits } from "./edit-access.js";
import { hash, rng } from "../rendering/random.js";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

// Project commands and pointer gestures coordinate the pure placement model with
// React's committed scene. Pointer previews and canvas pixels stay off React's
// render loop; a commit replaces only the transient scene, preserving form state.
export function createProjectController(commit, { storageKey, initial, isShared = false, preferInitial = false } = {}) {
  const WORLD = { left: 0, right: 900, width: 900, height: 1160 };
  let disposed = false,
    sceneRevision = 0,
    toast = "",
    canvasPanning;
  let canEdit = false, accountLoading = true, localSyncBusy = false;
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
    canEdit: () => canEdit && !localSyncBusy,
    key: storageKey,
    initial,
    preferInitial,
    storage: {
      getItem: (key) => localStorage.getItem(key),
      setItem: (key, value) => localStorage.setItem(key, value),
    },
  });
  let state = store.getProject();
  const colorPreference = createBlockColorPreference({
    getItem: (key) => localStorage.getItem(key),
    setItem: (key, value) => localStorage.setItem(key, value),
  });
  const clearedVisibilityKey = `${storageKey ?? STORAGE}:visible-cleared`;
  const visibleClearedIds = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(clearedVisibilityKey) ?? "[]");
    if (Array.isArray(saved)) for (const id of saved.slice(0,100))
      if (typeof id === "string" && state.blocks.some((block) => block.id===id && block.done)) visibleClearedIds.add(id);
  } catch { /* View preferences are optional when browser storage is unavailable. */ }
  function persistClearedVisibility() {
    try { localStorage.setItem(clearedVisibilityKey,JSON.stringify([...visibleClearedIds])); } catch { /* Keep the current view usable in memory. */ }
  }
  let storageAvailable = store.getStatus().storageAvailable;
  let editGroup = null;
  let sync = { status: "local", pending: 0, inviteUrl: "", error: "" };
  let presence = { selfId: null, peers: [] };
  const viewListeners = new Set();
  let shareOpen = false;
  let projectDetailsOpen = false;
  let disposeCanvasZoom;
  let crewOpen = false, crewEditing = false;
  let dividerEditor = null;
  let syncHandlers = {};
  let selectedDigger = null;
  let pendingLink = null;
  let currentLayout = null;
  let inspectorReturnId = null;
  let inspectorMoreOpen = false;
  let crewCollapsed = matchMedia("(max-width:680px)").matches;
  let mode = "inspect";
  let lastCreatedId = null;
  let goToOpen = false;
  let newBlockTarget = null;
  let newBlockColor = colorPreference.initialColor();
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
    get reducedMotion() { return reducedMotion.matches; },
    WORLD,
  });
  const { drawTerrain, drawDependencies, updateDependencyEmphasis, drawDiscoveries } = scene;
  const workers = createWorkerAnimator({ getDrag: () => drag, getPeople: () => state.crew, reducedMotion });
  const cacheSprites = () => workers.cacheSprites();
  function getView() {
    return {
      state,
      canEdit,
      accountLoading,
      isShared,
      visibleClearedIds: new Set(visibleClearedIds),
      selectedDigger,
      crewCollapsed,
      mode,
      goToOpen,
      newBlockTarget,
      newBlockColor,
      inspectorMoreOpen,
      sceneRevision,
      world: { ...WORLD },
      zoom,
      storageAvailable,
      history: store.getStatus(),
      sync,
      presence,
      shareOpen,
      projectDetailsOpen,
      crewOpen,
      dividerEditor,
      dividerPreview: drag?.kind === "divider" ? drag.dividerPreview : null,
      dividerObstacles: dividerObstacles(),
      toast,
      isBlocked,
      waitingDependencies,
      blockedReason,
      getBlock,
      placedDiggers,
      activeCount: activeCrew(state).filter((p) =>
        state.blocks.some(
          (b) => !b.done && !isBlocked(b) && b.people.includes(p.id),
        ),
      ).length,
    };
  }
  function publish() {
    if (!disposed) {
      const view = getView();
      commit(view);
      for (const listener of viewListeners) listener(view);
    }
  }
  function save(label = "Edit project") {
    if (!canEdit) {
      const selected = state.selected;
      store.persistSelection(selected);
      state = store.getProject();
      state.selected = selected;
      publish();
      return;
    }
    store.commit(state, { label, group: editGroup });
    storageAvailable = store.getStatus().storageAvailable;
    publish();
  }
  function endEdit() {
    editGroup = null;
    store.endGroup();
  }
  function travelHistory(kind) {
    if (!canEdit) return requireSignIn();
    if (drag || canvasPanning?.active || mode !== "inspect" || dividerEditor || projectDetailsOpen) return false;
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
  function requireSignIn() {
    if (localSyncBusy) { notify("Wait for sync to finish before editing."); return false; }
    notify("Sign in to make changes to this project.");
    $("#account-menu")?.showPopover();
    return false;
  }
  function getBlock(id) {
    return state.blocks.find((b) => b.id === id);
  }
  function waitingDependencies(b) {
    return dependenciesOf(b).filter((id) =>
      state.blocks.some((a) => a.id === id && !a.done),
    );
  }
  function isBlocked(b, layout = currentLayout) {
    return (
      b.blocked === true || waitingDependencies(b).length > 0 ||
      layout?.access.get(b.id)?.reachable === false
    );
  }
  function blockedReason(b) {
    if (b.blocked) return "This site is blocked. Unblock it when the way is clear.";
    return waitingDependencies(b).length
      ? "Another block comes first."
      : "Clear the stone above to reach this surface.";
  }
  function placedDiggers(b, layout = currentLayout) {
    if (b.blocked || waitingDependencies(b).length || !layout?.access.get(b.id)?.reachable)
      return [];
    const spots = [];
    for (const [index, r] of layout.access.get(b.id).ranges.entries())
      for (let x = r.x; x + DIGGER.width <= r.x + r.width; x += DIGGER.width + DIGGER.gap)
        spots.push({
          x: x - layout.placements.get(b.id).x,
          range: index,
          min: r.x - layout.placements.get(b.id).x,
          max: r.x + r.width - DIGGER.width - layout.placements.get(b.id).x,
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
        before?.range === spot.range ? (before.x + spot.x + DIGGER.width + DIGGER.gap) / 2 : spot.min;
      const max =
        after?.range === spot.range ? (after.x + spot.x - DIGGER.width - DIGGER.gap) / 2 : spot.max;
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
  function dividerObstacles() {
    const layout = drag?.preview ?? currentLayout;
    if (!layout) return [];
    return [...(state.excavations ?? []).map((hole) => visibleClearedIds.has(hole.blockId) ? hole : ({x:hole.x+hole.width/2-65,
      y:hole.y+hole.height/2-14,width:130,height:28})), ...state.blocks.filter((block) => !block.done).flatMap((block) => {
      const body = layout.placements.get(block.id)?.slot;
      if (!body) return [];
      return [body, ...(block.blocked ? [{x:body.x+body.width/2-56,y:body.y-44,width:112,height:44}] : []), ...placedDiggers(block,layout).map((spot) => ({x:body.x+spot.min,
        y:body.y-DIGGER.height, width:spot.max-spot.min+DIGGER.width, height:DIGGER.height}))];
    })];
  }
  function addDependency(sourceId, targetId) {
    if (!canEdit) return requireSignIn();
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
    const markers = [...(state.dividers ?? []), ...(drag?.dividerPreview ? [drag.dividerPreview] : [])];
    layout = {...layout, left:Math.min(layout.left,...markers.map((d) => d.x-48)),
      right:Math.max(layout.right,...markers.map((d) => d.x+360)),
      height:Math.max(layout.height ?? WORLD.height,...markers.map((d) => d.y+240))};
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
        ".task-block,.cleared-block,.excavated-label,#placement-preview,.effect-canvas",
      ).forEach((node) => {
        node.style.left = `${parseFloat(node.style.left) + shift}px`;
      });
      view.scrollLeft += shift * zoom;
    }
    $(".surface-sign").style.left =
      `${SURFACE_SIGN_LEFT + 14 - WORLD.left}px`;
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
      if (state.dividers?.length) publish();
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
    (mode === "new" || mode === "edit" ? $("#block-title", popup) : popup)?.focus({ preventScroll: true });
  }
  function closeInspector(restoreFocus = false) {
    const popup = $("#inspector-popup");
    if (!popup.matches(":popover-open")) return;
    popup.hidePopover();
    if (restoreFocus) {
      const target =
        inspectorReturnId === "new-block"
          ? $("#new-block")
          : getBlock(inspectorReturnId)?.done
            ? $(`#task-layer [data-cleared="${CSS.escape(inspectorReturnId)}"]`)
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
    let visibilityChanged = false;
    for (const id of visibleClearedIds) if (!state.blocks.some((block) => block.id===id && block.done)) {
      visibleClearedIds.delete(id); visibilityChanged = true;
    }
    if (visibilityChanged) persistClearedVisibility();
    if (selectedDigger && !activeCrew(state).some((person) => person.id === selectedDigger)) selectedDigger = null;
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
  function openNew(target = null) {
    if (!canEdit) return requireSignIn();
    if (drag || canvasPanning?.ready || canvasPanning?.active || performance.now() < suppressClickUntil) return;
    // Global Add controls pass a click event, not a placement target.
    newBlockTarget = Number.isFinite(target?.x) && Number.isFinite(target?.y) && Number.isFinite(target?.width) ? target : null;
    newBlockColor = colorPreference.initialColor(newBlockTarget?.afterId ? newBlockTarget.color : undefined);
    selectedDigger = null;
    goToOpen = false;
    mode = "new";
    renderCrew();
    renderInspector();
    cacheSprites();
    openInspector("new-block");
  }
  function assignPerson(personId, blockId, sourceId = null) {
    if (!canEdit) return requireSignIn();
    const b = getBlock(blockId),
      p = state.crew.find((p) => p.id === personId);
    if (!b || b.done || !p || p.archived) return;
    if (b.blocked) {
      notify("This site is blocked. Unblock it before assigning a digger.");
      return;
    }
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
    if (sites.length >= placementLimit(state)) {
      notify(
        `${p.name} has filled all ${placementLimit(state)} placement ${placementLimit(state) === 1 ? "slot" : "slots"}. Remove one assignment first.`,
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
    if (!canEdit) return requireSignIn();
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
  function navigateToTarget(target, { fit = false, onlyIfOutside = false, behavior } = {}) {
    if (!target || ![target.x,target.y,target.width,target.height].every(Number.isFinite) || target.width <= 0 || target.height <= 0) return false;
    const viewport = $("#pit-viewport");
    const left = WORLD.left + viewport.scrollLeft / zoom, top = viewport.scrollTop / zoom;
    if (onlyIfOutside && target.x >= left && target.x + target.width <= left + viewport.clientWidth / zoom &&
      target.y >= top && target.y + target.height <= top + viewport.clientHeight / zoom) return true;
    const plan = canvasTargetPlan(target, { width: viewport.clientWidth, height: viewport.clientHeight, worldLeft: WORLD.left, zoom, fit });
    if (plan.zoom !== zoom) setZoom(plan.zoom);
    viewport.scrollTo({ left: plan.left, top: plan.top, behavior: reducedMotion.matches ? "instant" : (behavior ?? "smooth") });
    return true;
  }
  function blockElement(block) {
    return block?.done ? $(`#task-layer [data-cleared="${CSS.escape(block.id)}"]`) :
      $(`[data-block="${CSS.escape(block?.id ?? "")}"] .block-hit`);
  }
  function navigateToBlock(id, { select = true, focus = true, ...options } = {}) {
    const block = getBlock(id);
    if (!block) return false;
    const hole = block.done ? state.excavations.find((item) => item.blockId === id) : null;
    if (block.done && !hole) return false;
    if (block.done && !visibleClearedIds.has(id)) {
      visibleClearedIds.add(id);
      persistClearedVisibility();
      publish();
    }
    if (select) {
      closeInspector();
      selectedDigger = null;
      pendingLink = null;
      mode = "inspect";
      inspectorMoreOpen = false;
      state.selected = id;
      render();
      save();
    }
    const [width, height] = blockDimensions(block);
    navigateToTarget(hole ?? { x: block.x, y: block.y, width, height }, options);
    if (focus) blockElement(block)?.focus({ preventScroll: true });
    return true;
  }
  function revealSelected() {
    navigateToBlock(state.selected, { select: false, focus: false });
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
      c.fillStyle = projectPalette(state)[b.color].fill;
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
    if (!canEdit) return;
    if (e.button !== 0 || e.target.closest("input,select,textarea")) return;
    const digger = e.target.closest("[data-digger]"),
      block = e.target.closest(".task-block");
    const divider = e.target.closest("[data-divider-drag]");
    const resize = e.target.closest("[data-resize]");
    const link = e.target.closest("[data-link-out]");
    if (!digger && !block && !divider) return;
    if (!divider && !digger && !resize && !link && !e.target.closest(".block-hit")) return;
    const marker = divider ? state.dividers.find((d) => d.id === divider.dataset.dividerDrag) : null;
    if (divider && !marker) return;
    if (divider) endEdit();
    const el = divider ? $("#pit-viewport") : link || resize || digger || block,
      rect = $("#pit-world").getBoundingClientRect();
    drag = {
      kind: divider ? "divider" : link ? "link" : resize ? "resize" : digger ? "digger" : "block",
      edge: resize?.dataset.resize,
      id: marker?.id || digger?.dataset.digger || block.dataset.block,
      sourceId: digger?.dataset.source || null,
      el,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      pointerId: e.pointerId,
      offsetX:
        (e.clientX - rect.left) / zoom +
        WORLD.left -
        (marker ? marker.x : block ? getBlock(block.dataset.block).x : 0),
      offsetY:
        (e.clientY - rect.top) / zoom -
        (marker ? marker.y : block ? getBlock(block.dataset.block).y : 0),
    };
    if (!digger && !divider) {
      drag.baseline = structuredClone(state);
    }
    if (!divider) el.setPointerCapture(e.pointerId);
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
    if (drag.kind === "divider") {
      drag.moved = true;
      if (!drag.el.hasPointerCapture(e.pointerId)) drag.el.setPointerCapture(e.pointerId);
      const rect = $("#pit-world").getBoundingClientRect();
      drag.dividerPreview = {...state.dividers.find((d) => d.id === drag.id),
        ...dividerPosition((e.clientX-rect.left)/zoom+WORLD.left-drag.offsetX,
          (e.clientY-rect.top)/zoom-drag.offsetY)};
      syncWorldBounds(WORLD,true);
      publish();
      return;
    }
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
        sprite.width = DIGGER.width;
        sprite.height = DIGGER.height;
        ghost.append(sprite);
        document.body.append(ghost);
        drag.ghost = ghost;
        drawSprite(
          $("canvas", ghost),
          state.crew.find((p) => p.id === drag.id),
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
      !["block", "link", "divider"].includes(drag.kind) ||
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
      if (d.kind === "divider") {
        if (!cancel && d.dividerPreview) {
          state = saveDivider(state,d.id,d.dividerPreview);
          save("Move divider");
        } else publish();
      } else if (d.kind === "link") {
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
      node.classList.toggle("is-unavailable", isBlocked(block, preview));
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
  function growToNeighborEdge(handle) {
    if (!canEdit) return requireSignIn();
    const edge = handle.dataset.resize;
    if (edge !== "w" && edge !== "e") return;
    const id = handle.closest("[data-block]").dataset.block;
    const preview = previewGrowToEdge(state, id, edge);
    if (!preview.ok) { notify(preview.reason); return; }
    endEdit();
    state.blocks = preview.blocks;
    state.selected = id;
    selectedDigger = null;
    pendingLink = null;
    mode = "inspect";
    closeInspector();
    render();
    save(edge === "w" ? "Align left edge" : "Align right edge");
    notify(`Aligned with ${getBlock(preview.targetId).title}.`);
  }
  listen(document, "dblclick", (e) => {
    const handle = e.target.closest('[data-resize="w"],[data-resize="e"]');
    if (!handle || e.button !== 0 || canvasPanning.ready || canvasPanning.active || drag || performance.now() < suppressClickUntil) return;
    e.preventDefault();
    growToNeighborEdge(handle);
  });
  listen(document, "click", (e) => {
    if (
      canvasPanning.ready ||
      canvasPanning.active ||
      performance.now() < suppressClickUntil
    )
      return;
    const source = e.target.closest("[data-link-out]");
    if (source) {
      if (!canEdit) return;
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
      if (!canEdit) return;
      selectedDigger =
        selectedDigger === digger.dataset.digger ? null : digger.dataset.digger;
      renderCrew();
      cacheSprites();
      if (selectedDigger)
        notify(
          `${state.crew.find((p) => p.id === selectedDigger).name} selected. Pick a block to dig.`,
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
      navigateToBlock(cleared.dataset.cleared, { focus: false, onlyIfOutside: true });
      $(".cleared-menu").open = false;
      openInspector(state.selected);
      return;
    }
    if (state.selected && e.target.closest("main") &&
      !e.target.closest("button,a,input,select,textarea,summary,[role=button]")) {
      closeInspector();
      state.selected = null;
      mode = "inspect";
      inspectorMoreOpen = false;
      // A popover can return focus to its block when it closes. Release that
      // focus as well, so :focus-within does not leave resize grips visible.
      if (document.activeElement?.closest(".task-block,.cleared-block")) document.activeElement.blur();
      save();
      cacheSprites();
      updateDependencyEmphasis();
    }
  });
  listen(document, "keydown", (e) => {
    if (e.defaultPrevented || e.isComposing) return;
    if (e.key === "Escape" && goToOpen) {
      e.preventDefault();
      actions.closeGoTo(true);
      return;
    }
    const shortcut = canvasShortcut(e);
    if (shortcut && mode === "inspect" && !drag && !canvasPanning?.ready && !canvasPanning?.active &&
      !crewOpen && !shareOpen && !dividerEditor && !projectDetailsOpen &&
      !$("dialog[open],details[open],:popover-open:not(#inspector-popup)")) {
      e.preventDefault();
      if (shortcut === "new") actions.openNextBlock();
      else actions.openGoTo();
      return;
    }
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
    if (!canEdit) return;
    const target = e.target.closest(".block-hit"),
      vectors = {
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
      };
    const handle = e.target.closest("[data-resize]");
    if (handle && !drag && e.key === "Enter" && !e.repeat && !e.metaKey && !e.ctrlKey && !e.altKey && !canvasPanning.ready && !canvasPanning.active) {
      if (["w", "e"].includes(handle.dataset.resize)) {
        e.preventDefault();
        growToNeighborEdge(handle);
        return;
      }
    }
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
        delete b.pinnedY;
        delete b.pinnedX;
        b.pinnedColumn = b.column + dx * (e.shiftKey ? 3 : 1);
      }
      if (dy) {
        delete b.pinnedY;
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
    dismissLocalSyncError() { syncHandlers.dismissError?.(); },
    syncLocalProject() { return syncHandlers.sync?.(); },
    retryLocalSave() { syncHandlers.retry?.(); },
    requireSignIn,
    setAccount(user, loading = false) {
      accountLoading = loading;
      const allowed = Boolean(user) && !loading;
      const changed = canEdit !== allowed;
      if (!allowed && canEdit) {
        if (drag) finishDrag({ pointerId: drag.pointerId }, true);
        endEdit();
        closeInspector();
        mode = "inspect";
        selectedDigger = null;
        pendingLink = null;
        projectDetailsOpen = false;
        crewOpen = false;
        crewEditing = false;
        dividerEditor = null;
      }
      canEdit = allowed;
      publish();
      if (changed) syncHandlers.authenticationChanged?.();
    },
    openProjectDetails() {
      if (drag || canvasPanning?.active || canvasPanning?.ready || performance.now() < suppressClickUntil) return;
      closeInspector(); endEdit();
      mode = "inspect";
      projectDetailsOpen = true;
      publish();
    },
    closeProjectDetails() {
      if (!projectDetailsOpen) return;
      projectDetailsOpen = false;
      publish();
    },
    saveProjectDetails(values) {
      const name = values.name.trim().slice(0, PROJECT_NAME_LIMIT);
      const subtitle = values.subtitle.trim().slice(0, PROJECT_SUBTITLE_LIMIT);
      if (!name) return;
      endEdit();
      state.name = name;
      state.subtitle = subtitle;
      projectDetailsOpen = false;
      save("Edit project details");
    },
    saveColorLegend(entries) {
      if (!validColorLegend(entries)) return false;
      endEdit();
      state.colorLegend = { ...state.colorLegend, ...structuredClone(entries) };
      save("Edit color legend");
      return true;
    },
    toggleClearedVisibility(id) {
      const block = getBlock(id);
      if (!block?.done) return;
      const showing = !visibleClearedIds.has(id);
      if (showing) visibleClearedIds.add(id);
      else {
        visibleClearedIds.delete(id);
        if (state.selected === id) {state.selected=null;closeInspector();mode="inspect";save();}
      }
      persistClearedVisibility();
      publish();
      if (showing) {
        const hole=state.excavations.find((item) => item.blockId===id);
        if (!hole) return;
        navigateToTarget(hole, { onlyIfOutside: true });
      }
    },
    openNewDivider(event) {
      const viewport = $("#pit-viewport"), anchor = event.currentTarget.getBoundingClientRect();
      closeInspector();
      selectedDigger = null;
      pendingLink = null;
      dividerEditor = {id:null, label:`Phase ${(state.dividers?.length ?? 0)+1}`,
        color:Object.keys(DIVIDER_COLORS)[(state.dividers?.length ?? 0)%5],
        ...dividerPosition(WORLD.left+(viewport.scrollLeft+48)/zoom,(viewport.scrollTop+viewport.clientHeight*.45)/zoom),
        anchor:{x:anchor.left,y:anchor.bottom}};
      $(".dividers-menu").open = false;
      publish();
    },
    openDivider(id, target) {
      if (drag || canvasPanning?.ready || canvasPanning?.active || performance.now()<suppressClickUntil) return;
      const divider = state.dividers?.find((d) => d.id === id);
      if (!divider) return;
      const anchor=target.getBoundingClientRect();
      closeInspector(); selectedDigger=null; pendingLink=null;
      dividerEditor = {...divider,anchor:{x:anchor.left,y:anchor.bottom}};
      $(".dividers-menu").open = false;
      publish();
    },
    closeDivider(returnFocus = false) {
      const id = dividerEditor?.id;
      dividerEditor = null;
      publish();
      if (returnFocus) ($(`[data-phase="${CSS.escape(id ?? "")}"] .phase-label`) ?? $(".dividers-menu summary"))?.focus({preventScroll:true});
    },
    saveDivider(id, values) {
      endEdit();
      state = saveDivider(state,id,values);
      dividerEditor = null;
      render();
      save(id ? "Edit divider" : "Add divider");
      notify(id ? "Divider updated." : "Phase boundary added. Drag its label or line to move it.");
      $(".dividers-menu summary")?.focus({preventScroll:true});
    },
    deleteDivider(id) {
      endEdit();
      state.dividers = state.dividers.filter((d) => d.id !== id);
      dividerEditor = null;
      render();
      save("Remove divider");
      $(".dividers-menu summary")?.focus({preventScroll:true});
    },
    nudgeDivider(id, key, larger) {
      if (drag || canvasPanning?.ready || canvasPanning?.active || dividerEditor) return;
      const divider=state.dividers?.find((d) => d.id === id);
      if (!divider) return;
      const step=larger ? 32 : 8, vector={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]}[key];
      if (!vector) return;
      endEdit();
      state=saveDivider(state,id,{...divider,...dividerPosition(divider.x+vector[0]*step,divider.y+vector[1]*step)});
      syncWorldBounds(currentLayout,true);
      save("Move divider");
    },
    openCrew() {
      closeInspector();
      endEdit();
      mode = "inspect";
      selectedDigger = null;
      crewOpen = true;
      publish();
    },
    closeCrew() {
      crewEditing = false;
      crewOpen = false;
      publish();
      cacheSprites();
    },
    setCrewEditing(editing) { crewEditing = editing; },
    setPlacementLimit(value) {
      const next = setPlacementLimit(state, value);
      if (placementLimit(state) === value) return true;
      endEdit();
      state = next;
      render();
      save("Change crew placement limit");
      notify(`Each digger now has ${value} placement ${value === 1 ? "slot" : "slots"}.`);
      return true;
    },
    saveCrewMember(id, values) {
      state = saveCrewMember(state, id, values);
      render();
      save(id ? "Edit digger" : "Add digger");
      notify(id ? "Digger updated." : "A new digger has joined the crew.");
    },
    archiveCrewMember(id, archived) {
      state = archiveCrewMember(state, id, archived);
      render();
      save(archived ? "Archive digger" : "Restore digger");
      notify(archived ? "Digger archived and removed from work sites." : "Digger restored. Ready for a new dig.");
    },
    openShare() {
      closeInspector();
      shareOpen = true;
      publish();
    },
    closeShare() {
      shareOpen = false;
      publish();
    },
    createSharedProject() {
      return syncHandlers.create?.();
    },
    copyInvite() {
      return syncHandlers.copy?.();
    },
    resolveShared(keepLocal) {
      return syncHandlers.resolve?.(keepLocal);
    },

    undo: () => travelHistory("undo"),
    redo: () => travelHistory("redo"),
    beginEdit() {
      if (!editGroup) editGroup = crypto.randomUUID();
    },
    endEdit,

    openNew,
    openNextBlock() { openNew(nextBlockTarget(state, lastCreatedId)); },
    navigateToTarget,
    navigateToBlock,
    openGoTo() {
      closeInspector();
      selectedDigger = null;
      pendingLink = null;
      goToOpen = true;
      publish();
    },
    closeGoTo(restoreFocus = false) {
      goToOpen = false;
      publish();
      if (restoreFocus) blockElement(getBlock(state.selected))?.focus({ preventScroll: true });
    },
    goToBlock(number) {
      if (mode !== "inspect" || drag || canvasPanning?.active) return false;
      const block = blockByNumber(state, number);
      if (!block) return false;
      goToOpen = false;
      return navigateToBlock(block.id, { fit: true });
    },
    addBelow(id) {
      const block = getBlock(id);
      if (block && !block.done) openNew(belowBlockTarget(block));
    },
    closeInspector,
    changeProgress,
    setBlocked(b, blocked) {
      if (!setBlockBlocked(getBlock(b.id), blocked)) return;
      selectedDigger = null;
      endEdit();
      render();
      save(blocked ? "Block work site" : "Unblock work site");
      notify(blocked ? "Barrier up. Diggers are free for other work." : "Barrier down. You can assign diggers again.");
    },
    assignPerson,
    addDependency,
    toggleCrew() {
      crewCollapsed = !crewCollapsed;
      renderCrewToggle();
    },
    editBlock() {
      mode = "edit";
      renderInspector();
      $("#block-title")?.focus({ preventScroll: true });
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
    setBlockColor(b, color) {
      colorPreference.remember(color);
      if (!Object.hasOwn(PALETTE, color) || b.color === color) return;
      b.color = color;
      renderBoard();
      save("Change block color");
    },
    rememberBlockColor(color) { colorPreference.remember(color); },
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
          ...creationPlacement(newBlockTarget),
        };
        state.blocks = insertCreatedBlock(state, block, newBlockTarget);
        state.selected = block.id;
        lastCreatedId = block.id;
      }
      mode = "inspect";
      render();
      save("Save block");
      notify(
        b
          ? "The shape of the work is a little clearer."
          : "A new block, ready to explore.",
      );
      closeInspector(true);
      navigateToBlock(state.selected, { select: false });
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
  guardProjectEdits(actions, () => canEdit && !localSyncBusy, requireSignIn);
  let lastSpriteTime = -1;
  function animate(time) {
    panWhileDragging(time);
    if (drag?.moved && ["block", "resize"].includes(drag.kind))
      drawDependencies();
    if (time - lastSpriteTime >= 70) {
      workers.paint(time);
      drawDiscoveries(time);
      lastSpriteTime = time;
    }
    requestFrame(animate);
  }
  let resizeObserver;
  function start() {
    disposeCanvasZoom = installCanvasZoom($("#pit-viewport"), {
      getZoom: () => zoom,
      setZoom,
      canZoom: () => !drag && !canvasPanning?.active && !canvasPanning?.ready && !projectDetailsOpen,
    });
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
    listen(window, "blur", () => {if (drag?.kind === "divider") finishDrag({pointerId:drag.pointerId},true);});
    listen($("#pit-viewport"), "lostpointercapture", (event) => {if (drag?.kind === "divider") finishDrag(event,true);});
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
        requestFrame(positionInspector);
        scheduleTerrain();
      },
      { passive: true },
    );
    render();
    save();
    fit();
    requestFrame(animate);
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
    disposeCanvasZoom?.();
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
    if (drag || mode !== "inspect" || editGroup || crewEditing || dividerEditor || projectDetailsOpen)
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
  return {
    setLocalSyncBusy(busy) { localSyncBusy = busy; },
    hasActiveProjectEdit: () => Boolean(drag || mode !== "inspect" || editGroup || crewEditing || dividerEditor || projectDetailsOpen),
    replaceLocalProject(project) {
      state = store.replaceLocalProject(project);
      if (!getBlock(state.selected)) closeInspector();
      render();
    },
    getView,
    actions,
    start,
    dispose,
    store,
    receiveRemote,
    setSyncHandlers(handlers) {
      syncHandlers = handlers;
    },
    setSyncState(update) {
      sync = { ...sync, ...update };
      publish();
    },
    setPresenceState(update) {
      presence = update;
      publish();
    },
    subscribeView(listener) {
      viewListeners.add(listener);
      return () => viewListeners.delete(listener);
    },
    applyResolvedProject(project) {
      state = project;
      if (!getBlock(state.selected)) closeInspector();
      render();
    },
  };
}
