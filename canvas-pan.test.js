import test from "node:test";
import assert from "node:assert/strict";
import { installCanvasPanning } from "./canvas-pan.js";

class Events {
  listeners = new Map();
  addEventListener(type, fn, capture = false) {
    const list = this.listeners.get(type) ?? [];
    list.push({ fn, capture });
    this.listeners.set(type, list);
  }
  removeEventListener(type, fn, capture = false) {
    this.listeners.set(
      type,
      (this.listeners.get(type) ?? []).filter(
        (l) => l.fn !== fn || l.capture !== capture,
      ),
    );
  }
  send(type, props = {}) {
    const e = {
      button: 0,
      pointerId: 1,
      clientX: 0,
      clientY: 0,
      prevented: false,
      stopped: false,
      preventDefault() {
        this.prevented = true;
      },
      stopPropagation() {
        this.stopped = true;
      },
      ...props,
    };
    for (const { fn } of this.listeners.get(type) ?? []) fn(e);
    return e;
  }
}
function setup() {
  const doc = new Events(),
    win = new Events(),
    view = new Events(),
    classes = new Set(),
    captures = new Set(),
    moves = [];
  doc.defaultView = win;
  doc.querySelector = () => null;
  const target = (inside = true, kind = "block") => ({
    inside,
    closest: (s) =>
      s.includes("input") && kind === "input"
        ? {}
        : s.includes("button") && kind === "block"
          ? {}
          : null,
  });
  const block = target(),
    input = target(false, "input"),
    outsideButton = target(false);
  view.ownerDocument = doc;
  view.contains = (t) => !!t?.inside;
  view.classList = {
    toggle: (name, on) => (on ? classes.add(name) : classes.delete(name)),
  };
  view.setPointerCapture = (id) => captures.add(id);
  view.hasPointerCapture = (id) => captures.has(id);
  view.releasePointerCapture = (id) => captures.delete(id);
  let ends = 0,
    busy = false;
  const controller = installCanvasPanning(view, {
    onMove: (x, y) => moves.push([x, y]),
    onEnd: () => ends++,
    canStart: () => !busy,
  });
  const send = (type, props = {}) =>
    doc.send(type, { target: block, ...props });
  return {
    doc,
    win,
    view,
    classes,
    captures,
    moves,
    controller,
    send,
    input,
    outsideButton,
    get ends() {
      return ends;
    },
    set busy(value) {
      busy = value;
    },
  };
}

test("middle drag captures the pointer, pans both axes, and never starts a work gesture", () => {
  const s = setup();
  assert.ok(
    s.send("pointerdown", { button: 1, clientX: 240, clientY: 180 }).stopped,
  );
  assert.ok(s.controller.active);
  assert.ok(s.classes.has("is-panning"));
  assert.ok(s.captures.has(1));
  s.send("pointermove", { clientX: 150, clientY: 130 });
  s.send("pointermove", { clientX: 170, clientY: 200 });
  assert.deepEqual(s.moves, [
    [-90, -50],
    [20, 70],
  ]);
  s.send("pointerup", { button: 1 });
  assert.equal(s.controller.active, false);
  assert.equal(s.captures.size, 0);
  assert.equal(s.ends, 1);
  assert.ok(s.view.send("auxclick", { button: 1 }).prevented);
  assert.ok(s.doc.listeners.get("pointerdown")[0].capture);
});

test("Space plus left drag pans over work and releasing Space stops immediately", () => {
  const s = setup();
  assert.ok(s.send("keydown", { code: "Space" }).prevented);
  assert.ok(s.controller.ready);
  s.send("pointerdown", { clientX: 200, clientY: 200 });
  s.send("pointermove", { clientX: 220, clientY: 170 });
  assert.deepEqual(s.moves, [[20, -30]]);
  s.send("keyup", { code: "Space" });
  assert.equal(s.controller.active, false);
  assert.equal(s.controller.ready, false);
  s.send("pointermove", { clientX: 400, clientY: 400 });
  assert.equal(s.moves.length, 1);
});

test("Space preserves typing, outside controls, dialogs, and modified shortcuts", () => {
  const s = setup();
  for (const props of [
    { target: s.input },
    { target: s.outsideButton },
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
  ]) {
    assert.equal(
      s.send("keydown", { code: "Space", ...props }).prevented,
      false,
    );
    assert.equal(s.controller.ready, false);
  }
  s.doc.querySelector = () => ({});
  assert.equal(s.send("keydown", { code: "Space" }).prevented, false);
});

test("ordinary work gestures and unrelated pointers remain available", () => {
  const s = setup();
  assert.equal(s.send("pointerdown").stopped, false);
  assert.equal(s.controller.active, false);
  assert.equal(
    s.send("pointerdown", { button: 1, target: s.outsideButton }).stopped,
    false,
  );
  s.busy = true;
  s.send("pointerdown", { button: 1 });
  assert.equal(s.controller.active, false);
  s.busy = false;
  s.send("pointerdown", { button: 1 });
  s.send("pointermove", { pointerId: 2, clientX: 20 });
  assert.equal(s.moves.length, 0);
  s.send("pointerup", { button: 0 });
  assert.ok(s.controller.active);
  s.send("pointerup", { button: 1 });
  assert.equal(s.controller.active, false);
});

test("Escape, blur, cancellation, and lost capture clean up the pan state", () => {
  for (const end of ["escape", "blur", "cancel", "lost", "hidden"]) {
    const s = setup();
    s.send("keydown", { code: "Space" });
    s.send("pointerdown");
    if (end === "escape") s.send("keydown", { key: "Escape" });
    if (end === "blur") s.win.send("blur");
    if (end === "cancel") s.send("pointercancel");
    if (end === "lost") s.view.send("lostpointercapture", { pointerId: 1 });
    if (end === "hidden") {
      s.doc.hidden = true;
      s.send("visibilitychange");
    }
    assert.equal(s.controller.active, false, end);
    assert.equal(s.ends, 1, end);
    assert.equal(s.captures.size, 0, end);
    s.send("keyup", { code: "Space" });
    assert.equal(s.classes.size, 0, end);
  }
});

test("disposing a canvas releases capture and removes all listeners before remount", () => {
  const s = setup();
  s.send("keydown", { code: "Space" });
  s.send("pointerdown");
  assert.ok(s.controller.active);
  s.controller.dispose();
  assert.equal(s.controller.active, false);
  assert.equal(s.controller.ready, false);
  assert.equal(s.captures.size, 0);
  assert.equal(s.classes.size, 0);
  for (const target of [s.doc, s.win, s.view])
    for (const listeners of target.listeners.values())
      assert.equal(listeners.length, 0);
  s.send("pointerdown", { button: 1 });
  s.send("pointermove", { clientX: 30 });
  assert.equal(s.moves.length, 0);
  s.controller.dispose();
});
