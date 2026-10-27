export const BEACON_LIGHT = Object.freeze({ width: 576, height: 432, pixel: 4, period: 6000 });
const width = BEACON_LIGHT.width / BEACON_LIGHT.pixel;
const height = BEACON_LIGHT.height / BEACON_LIGHT.pixel;
const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

// Fixed spatial samples keep the grain still while the reflector travels past.
// Rasterize at one quarter world resolution, never rotate the pixel grid itself.
const field = Array.from({ length: width * height }, (_, index) => {
  const x = index % width, y = Math.floor(index / width);
  const dx = (x + .5 - width / 2) * 4, dy = (y + .5 - height / 2) * 4 / .75;
  const distance = Math.hypot(dx, dy);
  const edge = Math.max(0, 1 - (distance / 288) ** 4);
  return { column: x, dx,
    cone: Math.exp(-((dy / (10 + Math.abs(dx) * .22)) ** 4)),
    flare: Math.exp(-((dx / 44) ** 2 + (dy / 28) ** 2)),
    falloff: Math.exp(-distance / 140) * edge * edge,
    dither: (bayer[(y % 4) * 4 + x % 4] / 16 - .5) / 255 };
});

// The lamp turns around a vertical axis, viewed from the front. Its heading
// projects onto screen X; screen Y only describes the cone's vertical spread.
export function beaconRotation(time, reducedMotion = false) {
  const angle = (time % BEACON_LIGHT.period) / BEACON_LIGHT.period * Math.PI * 2;
  const side = reducedMotion ? 0 : Math.sin(angle);
  const front = reducedMotion ? 1 : Math.cos(angle);
  const glare = reducedMotion ? 0 : Math.max(0, front) ** 16;
  return { side, front, glare, scale: Math.max(.3, Math.abs(front)),
    opacity: reducedMotion ? .8 : .7 + .3 * Math.max(0, front) };
}

const horizontal = new Float32Array(width);
export function beaconLightPixels(time, reducedMotion = false, pixels = new Uint8ClampedArray(width * height * 4)) {
  const { side, glare } = beaconRotation(time, reducedMotion);
  // A single projected footprint travels continuously through the center on
  // both halves of the turn. There is no sign switch or dark rear half-turn.
  const center = side * 120, radius = 36 + Math.abs(side) * 138;
  for (let x = 0; x < width; x++) {
    const dx = (x + .5 - width / 2) * BEACON_LIGHT.pixel;
    horizontal[x] = Math.exp(-(((dx - center) / radius) ** 4));
  }
  for (let i = 0; i < field.length; i++) {
    const cell = field[i], white = glare * cell.flare;
    const energy = cell.falloff * (reducedMotion ? .32 : .035 + .9 * cell.cone * horizontal[cell.column] + .8 * white);
    const offset = i * 4;
    const green = 158 + cell.falloff * 48, blue = 35 + cell.falloff * 68;
    pixels[offset] = 255;
    pixels[offset + 1] = Math.round(green + (255 - green) * white);
    pixels[offset + 2] = Math.round(blue + (248 - blue) * white);
    // Keep the fixed pixel grain, with full 8-bit temporal blending instead of
    // jumping through 32 brightness levels as the light moves.
    pixels[offset + 3] = Math.round(Math.min(.96, Math.max(0, energy + cell.dither)) * 255);
  }
  return pixels;
}

export function installBeaconLight(canvas, beacon) {
  const doc = canvas.ownerDocument, win = doc.defaultView;
  const motion = win.matchMedia('(prefers-reduced-motion: reduce)');
  canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return () => {};
  const frame = context.createImageData(width, height);
  let visible = false, request = null, elapsed = 0, previous = null;
  function paint(time) {
    beaconLightPixels(time, motion.matches, frame.data);
    context.putImageData(frame, 0, 0);
    const pose = beaconRotation(time, motion.matches);
    beacon.style.setProperty('--beacon-face-x', `${pose.side * 2}px`);
    beacon.style.setProperty('--beacon-face-scale', `${pose.scale}`);
    beacon.style.setProperty('--beacon-face-opacity', `${pose.opacity}`);
    beacon.style.setProperty('--beacon-face-color', `rgb(255 ${Math.round(226 + 29 * pose.glare)} ${Math.round(160 + 95 * pose.glare)})`);
  }
  function tick(time) {
    request = null;
    if (previous !== null) elapsed += time - previous;
    previous = time;
    paint(elapsed);
    request = win.requestAnimationFrame(tick);
  }
  function update() {
    if (request !== null) win.cancelAnimationFrame(request);
    request = null; previous = null;
    const running = visible && !doc.hidden && !motion.matches;
    paint(elapsed);
    if (running) request = win.requestAnimationFrame(tick);
  }
  const observer = new win.IntersectionObserver(([entry]) => { visible = entry.isIntersecting; update(); });
  observer.observe(canvas);
  doc.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  update();
  return () => {
    if (request !== null) win.cancelAnimationFrame(request);
    observer.disconnect();
    doc.removeEventListener('visibilitychange', update);
    motion.removeEventListener('change', update);
  };
}
