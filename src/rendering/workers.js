import { PEOPLE } from "../project/project.js";
import { createDiggerLife, sampleDigger } from "../../digger-life.js";
import { hash } from "./random.js";
import { drawSprite } from "./pixels.js";
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

export function createWorkerAnimator({ getDrag, reducedMotion }) {
  let spriteCache = [];
  const diggerLives = new Map(),
    spriteEntries = new WeakMap(),
    activityNames = {
      dig: "digging",
      walk: "finding a new spot",
      coffee: "coffee break",
      phone: "checking phone",
      idle: "ready",
    };
  function paintWorker(s, time) {
    const button = s.canvas.closest(".block-digger");
    const lifeKey = button ? `${s.person.id}:${button.dataset.source}` : null;
    if (s.working && (!s.visible || document.hidden)) {
      const life = diggerLives.get(lifeKey);
      if (life && life.pausedAt === undefined) life.pausedAt = time;
      return;
    }
    let pose = { mode: "idle", frame: 0, facing: 1, phase: 0 };
    if (s.working && !reducedMotion.matches) {
      let life = diggerLives.get(lifeKey);
      if (!life) {
        life = createDiggerLife(hash(lifeKey), s.baseX, time);
        diggerLives.set(lifeKey, life);
      }
      if (life.pausedAt !== undefined) {
        life.since += time - life.pausedAt;
        delete life.pausedAt;
      }
      if (getDrag() && ["block", "resize", "digger"].includes(getDrag().kind)) {
        pose = { mode: "dig", frame: 0, facing: life.facing, phase: 0 };
        button.style.transform = "";
      } else {
        pose = sampleDigger(life, time, {
          min: +button.dataset.walkMin,
          max: +button.dataset.walkMax,
        });
        button.style.transform = `translateX(${Math.round(pose.x - s.baseX)}px)`;
        button.dataset.position = pose.x;
      }
    }
    if (button) {
      const activity = activityNames[pose.mode];
      button.dataset.activity = pose.mode;
      const label = $(".digger-label", button);
      if (label) label.textContent = `${s.person.name} · ${activity}`;
    }
    const key = `${pose.mode}:${pose.frame}:${pose.facing}:${pose.mode === "coffee" ? Math.round(pose.phase * 20) : 0}`;
    if (key !== s.drawn) {
      drawSprite(s.canvas, s.person, pose);
      s.drawn = key;
    }
  }
  const spriteVisibility = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const s = spriteEntries.get(entry.target);
      if (!s) continue;
      s.visible = entry.isIntersecting;
      paintWorker(s, performance.now());
    }
  });
  function cacheSprites() {
    const now = performance.now();
    for (const life of diggerLives.values())
      if (life.pausedAt === undefined) life.pausedAt = now;
    spriteVisibility.disconnect();
    spriteCache = $$("canvas[data-person]").map((canvas) => {
      const s = {
        canvas,
        person: PEOPLE.find((p) => p.id === canvas.dataset.person),
        working: canvas.dataset.working === "true",
        baseX: parseFloat(canvas.closest(".block-digger")?.style.left) || 0,
      };
      s.visible = !s.working;
      spriteEntries.set(canvas, s);
      if (s.working) spriteVisibility.observe(canvas);
      return s;
    });
    spriteCache.forEach((s) => paintWorker(s, now));
  }

  return {
    cacheSprites,
    paint(time) {
      spriteCache.forEach((s) => paintWorker(s, time));
    },
    pause() {
      for (const life of diggerLives.values())
        if (life.pausedAt === undefined) life.pausedAt = performance.now();
    },
    dispose() {
      spriteVisibility.disconnect();
      spriteCache = [];
      diggerLives.clear();
    },
  };
}
