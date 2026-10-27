import { useEffect, useRef, useState } from "react";
import { MASONRY } from "../../masonry.js";
import { dirtParticles, introFrame, introRects, INTRO_PIXEL } from "../rendering/intro.js";
import { rng } from "../rendering/random.js";

function terrainTexture(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const c = canvas.getContext("2d"), random = rng(84);
  c.fillStyle = "#3e332d"; c.fillRect(0, 0, width, height);
  c.fillStyle = "#382f2a"; c.fillRect(0, height * .35, width, height);
  c.fillStyle = "#302c2c"; c.fillRect(0, height * .75, width, height);
  for (let y = 4; y < height; y += 4) for (let x = 0; x < width; x += 5) {
    if (random() > .58) continue;
    c.fillStyle = ["#534236", "#473a32", "#2f2927", "#605044"][Math.floor(random() * 4)];
    c.fillRect(x + (y % 8 ? 2 : 0), y, 2 + Math.floor(random() * 3), 1 + Math.floor(random() * 2));
  }
  return canvas;
}
function cloud(c, x, y, size) {
  x = Math.round(x); y = Math.round(y);
  c.fillStyle = "#eef1df";
  c.fillRect(x + size, y, size * 4, size);
  c.fillRect(x, y + size, size * 7, size);
  c.fillRect(x + size, y + size * 2, size * 5, size);
  c.fillStyle = "#d2e1cf";
  c.fillRect(x + size, y + size * 2, size * 5, 1);
}

const clockNow = () => performance.now();

export function LoadingIntro({ view, error, onComplete, clock = clockNow }) {
  const canvas = useRef(null), scene = useRef(null), latest = useRef({ view, error, onComplete, clock });
  const [stage, setStage] = useState("sky");
  const [ready, setReady] = useState(false);
  latest.current = { view, error, onComplete, clock };
  useEffect(() => {
    const root = scene.current, surface = canvas.current, c = surface.getContext("2d");
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let frameId, started = latest.current.clock(), readyAt = null, site = null, texture, width, height;
    let particles = [], complete = false, currentStage = "sky", lastPaint = -1, measuredView = null, blasted = false, boundsObserver;
    function finish() {
      if (complete || !latest.current.view) return;
      complete = true; cancelAnimationFrame(frameId); latest.current.onComplete();
    }
    function measure() {
      const nextWidth = Math.ceil(innerWidth / INTRO_PIXEL), nextHeight = Math.ceil(innerHeight / INTRO_PIXEL);
      if (nextWidth !== width || nextHeight !== height) {
        width = nextWidth; height = nextHeight;
        surface.width = width; surface.height = height;
        texture = terrainTexture(width, height);
      }
      const { view } = latest.current;
      measuredView = view;
      const world = document.querySelector("#pit-world"), viewport = document.querySelector("#pit-viewport");
      if (!view || !world || !viewport) return;
      if (!boundsObserver) {
        boundsObserver = new ResizeObserver(measure);
        boundsObserver.observe(viewport);
        boundsObserver.observe(world);
      }
      const origin = world.getBoundingClientRect(), bounds = viewport.getBoundingClientRect();
      const zoom = origin.width / world.offsetWidth;
      const rectangles = introRects(view.state, { left: origin.left, top: origin.top, zoom, worldLeft: view.world.left, viewport: bounds });
      site = { rectangles, ground: origin.top + MASONRY.surface * zoom };
      // Openings follow late auth/layout/sync updates. Clods already in flight
      // keep their original trajectories rather than restarting the explosion.
      if (!blasted) particles = dirtParticles(rectangles, innerWidth < 680 ? 260 : 620);
    }
    function setPhase(phase) { if (phase !== currentStage) { currentStage = phase; setStage(phase); } }
    function draw(now) {
      if (complete) return;
      frameId = requestAnimationFrame(draw);
      if (document.hidden) return;
      // A small logical canvas and a capped 45 fps keep the intro light on mobile.
      if (now - lastPaint < 22) return;
      lastPaint = now;
      const elapsed = latest.current.clock() - started;
      if (latest.current.error) {
        setPhase("error"); cancelAnimationFrame(frameId);
        c.clearRect(0, 0, width, height);
        root.style.setProperty("--intro-copy-opacity", "1");
        return;
      }
      if (latest.current.view && readyAt === null) { readyAt = elapsed; measure(); setReady(true); }
      const frame = introFrame(elapsed, readyAt, motion.matches);
      if (frame.done) { finish(); return; }
      if (latest.current.view && (measuredView !== latest.current.view || (frame.bursting && !blasted))) measure();
      if (frame.bursting) blasted = true;
      setPhase(frame.bursting ? "burst" : elapsed > 800 && !motion.matches ? "pan" : "sky");
      const ground = ((innerHeight + 80) * (1 - frame.pan) + (site?.ground ?? innerHeight * .25) * frame.pan) / INTRO_PIXEL;
      c.clearRect(0, 0, width, height);
      c.save(); c.globalAlpha = 1 - frame.dissolve;
      c.fillStyle = "#b8d8ce"; c.fillRect(0, 0, width, height);
      const skyShift = frame.pan * height * .85;
      c.fillStyle = "#f1ce83";
      const sunX = Math.round(width * .77), sunY = Math.round(height * .17 - skyShift);
      c.fillRect(sunX, sunY, 12, 16);
      c.fillRect(sunX - 2, sunY + 3, 16, 10);
      const drift = motion.matches ? 0 : elapsed;
      cloud(c, width * .12 + (drift / 2200) % 8, height * .16 - skyShift * .7, 3);
      cloud(c, width * .69 - (drift / 3200) % 8, height * .42 - skyShift * .9, 4);
      cloud(c, width * .36, height * .65 - skyShift, 2);
      c.drawImage(texture, 0, Math.round(ground), width, height);
      c.fillStyle = "#536a42"; c.fillRect(0, Math.round(ground) - 4, width, 4);
      for (let x = 0; x < width; x += 2) {
        c.fillStyle = x % 6 ? "#8d9d5b" : "#a0ab68";
        c.fillRect(x, Math.round(ground) - 6 - (x % 5 ? 0 : 1), 2, 3);
      }
      if (frame.bursting && site) {
        c.globalAlpha = 1;
        c.globalCompositeOperation = "destination-out";
        for (const rect of site.rectangles) {
          const opened = Math.min(1, frame.burstTime / 340);
          c.fillRect(rect.x / INTRO_PIXEL, rect.y / INTRO_PIXEL, rect.width / INTRO_PIXEL, rect.height / INTRO_PIXEL * opened);
        }
      }
      c.restore();
      if (frame.bursting) for (const particle of particles) {
        const t = frame.burstTime / 1000 - particle.delay;
        if (t < 0 || t > 1.1) continue;
        c.globalAlpha = Math.max(0, 1 - Math.max(0, t - .4) / .7);
        c.fillStyle = particle.color;
        const x = (particle.x + particle.vx * t) / INTRO_PIXEL;
        const y = (particle.y + particle.vy * t + 340 * t * t) / INTRO_PIXEL;
        const size = particle.size / INTRO_PIXEL;
        c.fillRect(Math.round(x), Math.round(y), size, size);
      }
      c.globalAlpha = 1;
      root.style.setProperty("--intro-title-y", `${-frame.pan * innerHeight * .9}px`);
      root.style.setProperty("--intro-copy-opacity", `${1 - frame.dissolve}`);
    }
    const skip = () => finish();
    const visibility = () => {
      // A completed background load should not make the user sit through a replay.
      if (!document.hidden && latest.current.view && readyAt !== null && latest.current.clock() - started > readyAt + 3000) finish();
    };
    measure(); frameId = requestAnimationFrame(draw);
    root.addEventListener("skip-intro", skip);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("resize", measure);
    return () => { complete = true; cancelAnimationFrame(frameId); boundsObserver?.disconnect(); root.removeEventListener("skip-intro", skip); document.removeEventListener("visibilitychange", visibility); window.removeEventListener("resize", measure); };
  }, []);
  return <section ref={scene} className="dig-intro" data-stage={error ? "error" : stage} aria-label="Opening your excavation">
    <canvas ref={canvas} className="dig-intro-canvas" aria-hidden="true" />
    <div className="dig-intro-title" aria-hidden={stage === "burst"}><h1>diggy<span>.</span></h1><p>There’s work to uncover.</p></div>
    {error ? <div className="dig-intro-error" role="alert"><h2>Couldn’t reach this dig.</h2><p>{error}</p><div><button className="button primary" onClick={() => location.reload()}>Try again</button><a className="button" href="/">Open local project</a></div></div>
      : <><p className="dig-intro-status" role="status">{stage === "burst" ? "Breaking ground…" : stage === "pan" ? ready ? "Going underground…" : "Finding your dig…" : "A little less scheduling. A little more digging."}</p>
        <button type="button" className="dig-intro-skip" disabled={!ready} onClick={() => scene.current.dispatchEvent(new Event("skip-intro"))}>Skip intro <span aria-hidden="true">→</span></button></>}
  </section>;
}
