import { MASONRY } from "../../masonry.js";
import { pixelLine } from "./pixels.js";

// Decorative world coordinates stay fixed as the viewport pans and zooms.
export const FOSSIL_TOP = MASONRY.surface + 60 * MASONRY.unit;
export const DWARF_TOP = MASONRY.surface + 180 * MASONRY.unit;
export const BALROG_TOP = MASONRY.surface + 240 * MASONRY.unit;
export const BALROG_HEIGHT = 248;

export function drawDinosaurFossil(c) {
  c.save();
  c.translate(328, FOSSIL_TOP);
  c.globalAlpha = .45;
  const bone = "#a2947b", light = "#c0af90", shade = "#625747";
  const rect = (x, y, w, h, color = bone) => {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  };
  function joint(x, y, size = 12) {
    rect(x - size / 2, y - 4, size, 8);
    rect(x - size / 2 + 4, y - 8, size - 8, 16);
    rect(x - size / 2, y - 4, size - 4, 4, light);
  }
  function limb(points, width = 8) {
    for (let i = 1; i < points.length; i++) {
      const [x, y] = points[i - 1], [ex, ey] = points[i];
      pixelLine(c, x, y + 4, ex, ey + 4, shade, width);
      pixelLine(c, x, y, ex, ey, bone, width);
    }
    for (const [x, y] of points) joint(x + width / 2, y + width / 2);
  }
  // Only a few separated finds remain: a broken tail, two ribs, and one thigh.
  limb([[36, 144], [64, 132], [88, 124]], 4);
  rect(60, 124, 12, 12); rect(84, 116, 8, 12);
  limb([[248, 108], [260, 132], [256, 156]], 4);
  limb([[300, 100], [312, 124], [308, 144]], 4);
  limb([[196, 200], [220, 228]], 8);
  // Broad fossil skull: stepped snout, open eye socket, separated lower jaw.
  rect(460, 4, 52, 8); rect(448, 12, 84, 12);
  rect(444, 24, 108, 24); rect(456, 48, 96, 8);
  rect(452, 12, 44, 4, light); rect(496, 24, 52, 4, light);
  rect(456, 24, 24, 20, shade); rect(460, 20, 16, 28, shade);
  rect(520, 36, 16, 8, shade);
  rect(484, 44, 12, 12, shade);
  for (let x = 500; x < 548; x += 12) rect(x, 56, 4, 8, light);
  limb([[452, 56], [468, 76], [504, 80], [544, 72]], 4);
  for (let x = 496; x < 540; x += 12) rect(x, 68, 4, 8);
  joint(452, 52, 16);
  // A few missing fragments keep the discovery embedded rather than pristine.
  rect(184, 188, 8, 4, shade); rect(328, 208, 12, 4);
  rect(344, 216, 4, 4, light); rect(568, 68, 8, 4, shade);
  c.restore();
}

export function drawPortaPotty(c) {
  c.save();
  c.translate(840, 12);
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  };
  rect(0, 76, 60, 4, "#4e5b3d");
  // Pale molded roof, shaded side, inset door, vents, and vacant indicator.
  rect(8, 0, 40, 4, "#dedbc3");
  rect(4, 4, 52, 8, "#b9c5ba");
  rect(4, 12, 48, 60, "#4c8395");
  rect(44, 12, 12, 60, "#315d75");
  rect(4, 12, 4, 56, "#689ca8");
  rect(12, 16, 28, 52, "#315d75");
  rect(16, 20, 24, 44, "#5a91a3");
  rect(20, 24, 16, 4, "#294b60");
  rect(20, 32, 16, 4, "#294b60");
  rect(20, 40, 16, 4, "#294b60");
  rect(32, 48, 4, 8, "#e1d5a9");
  rect(20, 48, 8, 4, "#a3b87a");
  rect(0, 72, 60, 4, "#283f47");
  rect(4, 68, 52, 4, "#3c6a7d");
  rect(44, 20, 4, 44, "#3b6d83");
  c.restore();
}

export function drawDwarf(c, time = 0) {
  c.save();
  c.translate(768, DWARF_TOP);
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  };
  // A tiny hand-cut alcove and rubble nestle the miner into the soil.
  rect(-8, 16, 88, 76, "#252625");
  rect(0, 8, 60, 8, "#252625");
  rect(12, 0, 32, 8, "#252625");
  rect(-8, 92, 92, 4, "#67533c");
  rect(0, 40, 8, 36, "#30302a");
  const phase = Math.floor(time / 180) % 6;
  const lean = [0, -2, -4, 4, 2, 0][phase];
  const bob = [0, -2, -4, 2, 0, 0][phase];
  const [tipX, tipY, handX, handY] = [
    [80, 36, 58, 54], [60, 8, 48, 38], [36, 4, 40, 32],
    [96, 68, 68, 58], [88, 64, 64, 60], [84, 48, 60, 56],
  ][phase];
  // Wide planted boots stay put while his shoulders wind up and drive the pick.
  rect(12, 76, 16, 12, "#3c4747"); rect(44, 76, 16, 12, "#3c4747");
  rect(8, 88, 24, 8, "#242120"); rect(44, 88, 24, 8, "#242120");
  rect(12, 88, 16, 3, "#6e6451"); rect(48, 88, 16, 3, "#6e6451");
  c.save(); c.translate(lean, bob);
  rect(12, 48, 48, 32, "#496f65"); rect(16, 52, 8, 24, "#76917a");
  rect(12, 72, 48, 8, "#493a2d"); rect(52, 72, 8, 8, "#c39b50");
  rect(16, 52, 8, 20, "#77513a"); rect(48, 52, 8, 20, "#77513a");
  rect(16, 54, 8, 3, "#d0a15a"); rect(48, 54, 8, 3, "#d0a15a");
  // Sleeves sit behind the beard, leaving its full bushy silhouette readable.
  pixelLine(c, 16, 56, handX - 8 - lean, handY + 8 - bob, "#496f65", 8);
  pixelLine(c, 56, 52, handX - lean, handY - bob, "#76917a", 8);
  // Thick sideburns and a bushy copper silhouette read as hair, not a face extension.
  const beard = "#b7743d", beardDark = "#663e2c", beardLight = "#dda35b";
  rect(20, 28, 36, 24, "#c39771");
  rect(12, 36, 12, 28, beardDark); rect(52, 36, 12, 28, beardDark);
  rect(16, 44, 44, 24, beardDark); rect(20, 64, 36, 8, beardDark);
  rect(16, 48, 40, 16, beard); rect(20, 60, 32, 12, beard);
  rect(12, 44, 8, 12, beard); rect(56, 44, 8, 12, beard);
  rect(16, 52, 4, 12, beardLight); rect(24, 56, 4, 12, beardLight);
  rect(48, 52, 4, 12, beardLight); rect(52, 64, 4, 4, beard);
  // Two chunky braids have alternating locks, gold clasps, and loose tapered ends.
  for (const x of [24, 44]) {
    rect(x - 2, 64, 12, 16, beardDark);
    rect(x, 64, 8, 4, beardLight); rect(x - 2, 68, 8, 4, beard);
    rect(x + 2, 72, 8, 4, beardLight);
    rect(x, 76, 8, 4, "#c8a352"); rect(x + 2, 76, 4, 2, "#ead18b");
    rect(x, 80, 8, 4, beard); rect(x + 2, 84, 4, 2, beardLight);
  }
  // A cocked eyebrow, rosy cheeks, and a crooked toothy grin give him some mischief.
  rect(24, 32, 10, 3, beardDark); rect(44, 34, 10, 3, beardDark);
  rect(30, 36, 4, 4, "#29292a"); rect(46, 38, 4, 4, "#29292a");
  rect(26, 42, 8, 4, "#d58b64"); rect(50, 44, 6, 4, "#d58b64");
  rect(36, 40, 14, 8, "#e0ad7c"); rect(42, 44, 10, 4, "#d68d62");
  rect(34, 50, 18, 6, "#4a3028"); rect(44, 50, 6, 3, "#f1ddaf");
  // A sweeping moustache curls upward at each end and breaks away from the braids.
  rect(24, 46, 14, 4, beardLight); rect(20, 48, 12, 4, beardLight);
  rect(16, 44, 4, 8, beardLight); rect(46, 48, 12, 4, beardLight);
  rect(56, 44, 4, 8, beardLight); rect(28, 50, 8, 4, beard);
  rect(24, 12, 24, 4, "#9baba5"); rect(20, 16, 32, 8, "#758b89");
  rect(16, 24, 40, 8, "#758b89"); rect(12, 28, 48, 4, "#b6b9a0");
  rect(32, 12, 8, 16, "#b1bba8");
  rect(20, 24, 4, 4, "#d1c197"); rect(48, 24, 4, 4, "#d1c197");
  c.restore();
  // Both hands grip the haft: anticipation, overhead lift, a hard strike, recovery.
  pixelLine(c, handX - 16, handY + 16, tipX, tipY, "#a98a59", 4);
  pixelLine(c, tipX - 12, tipY - 4, tipX + 8, tipY + 4, "#a8b6ae", 4);
  rect(tipX - 12, tipY - 4, 8, 2, "#d4d8bd");
  rect(handX - 4, handY, 8, 8, "#c39771");
  rect(handX - 12, handY + 8, 8, 8, "#d4a77a");
  rect(84, 84, 12, 8, "#695645"); rect(96, 76, 8, 8, "#584b3d");
  if (phase === 3 || phase === 4) {
    rect(104, 60, 4, 4, "#e8c279"); rect(108, 72, 4, 4, "#cda364");
    rect(96, 80, 4, 4, "#ac8a5d");
  }
  c.restore();
}

export function drawBalrog(c, time = 0) {
  c.save();
  c.translate(464, BALROG_TOP);
  const rect = (x, y, w, h, color) => {
    c.fillStyle = color; c.fillRect(x, y, w, h);
  };
  // A stepped rock arch encloses the creature, with a soot-dark chamber inside.
  for (const [x, y, w, h] of [[64, 0, 112, 240], [32, 8, 176, 232],
    [8, 24, 224, 216], [-12, 44, 264, 196], [-24, 76, 288, 164],
    [-32, 108, 304, 124]]) rect(x, y, w, h, "#3b3430");
  for (const [x, y, w, h] of [[64, 12, 112, 216], [36, 24, 168, 204],
    [16, 44, 208, 184], [0, 76, 240, 152], [-16, 112, 272, 116]])
    rect(x, y, w, h, "#171c1c");
  // Individual broken stones and warm inner facets keep the cave part of the soil.
  for (const [x, y, w, h, color] of [
    [64, 0, 40, 8, "#52453a"], [132, 4, 40, 8, "#493c33"],
    [32, 12, 24, 8, "#4a4037"], [8, 32, 20, 8, "#4a4037"],
    [-12, 60, 16, 24, "#473c33"], [-28, 116, 12, 32, "#4c3e33"],
    [204, 32, 20, 12, "#513c30"], [232, 60, 12, 24, "#50392d"],
    [248, 120, 12, 40, "#50372c"], [-12, 184, 12, 32, "#44392f"],
    [236, 188, 16, 28, "#51392d"], [44, 28, 4, 28, "#352c28"],
    [184, 36, 4, 20, "#3d2e27"], [4, 88, 4, 36, "#302925"],
  ]) rect(x, y, w, h, color);
  rect(-24, 228, 288, 12, "#41352d");
  rect(-8, 236, 256, 8, "#2a2926");
  for (const [x, y, w] of [[-12, 224, 24], [24, 232, 20], [64, 228, 16],
    [172, 232, 24], [212, 224, 28], [248, 232, 16]]) {
    rect(x, y, w, 8, "#584333"); rect(x, y, w - 4, 4, "#6c4b34");
  }
  // One slow eight-pose idle: inhale, lean, settle, exhale, and shift back.
  const cycle = ((time % 2880) + 2880) % 2880;
  const phase = Math.floor(cycle / 360), fire = Math.floor(cycle / 180) % 4;
  const shift = [0, 4, 4, 4, 0, -4, -4, -4][phase];
  const breath = [0, -2, -4, -2, 0, 2, 4, 2][phase];
  const spread = [0, 4, 8, 4, 0, -4, -8, -4][phase];
  const wingDrop = [0, 0, 4, 8, 8, 4, 0, 0][phase];
  const arm = [0, -2, 0, 2, 4, 2, 0, 0][phase];
  // Boots stay planted while bent legs follow the shifting torso.
  pixelLine(c, 100 + shift, 164 + breath, 100, 204, "#242124", 8);
  pixelLine(c, 144 + shift, 164 + breath, 148, 204, "#242124", 8);
  rect(84, 204, 32, 12, "#242124"); rect(132, 204, 32, 12, "#242124");
  rect(88, 212, 20, 4, "#41302a"); rect(140, 212, 20, 4, "#41302a");
  c.save(); c.translate(shift, 24 + breath);
  const wing = [[0, 76, 24, 12], [12, 64, 40, 12], [28, 52, 40, 12],
    [48, 64, 32, 12], [64, 76, 28, 48], [36, 84, 32, 12],
    [12, 96, 24, 12], [28, 108, 24, 12], [52, 120, 24, 16]];
  for (const [x, y, w, h] of wing) {
    rect(x - spread, y + wingDrop, w, h, "#282426");
    rect(240 - x - w + spread, y + wingDrop, w, h, "#282426");
  }
  rect(72, 88, 24, 40, "#282426"); rect(144, 88, 24, 40, "#282426");
  pixelLine(c, 88, 96, 36 - spread, 68 + wingDrop, "#3a2c2b", 4);
  pixelLine(c, 152, 96, 204 + spread, 68 + wingDrop, "#3a2c2b", 4);
  for (const [i, x] of [80, 96, 112, 128, 144].entries()) {
    const top = 12 + ((i + fire) % 4) * 8;
    rect(x, top, 12, 84 - top, "#71372b");
    rect(x + 4, top + 12, 8, 72 - top, "#ae512f");
    rect(x + 4, top + 28, 4, 48 - top, "#d7873d");
  }
  // Expanding shoulders and a slow head turn make the body breathe with the fire.
  rect(88 - (breath < 0 ? 4 : 0), 80, 64 + (breath < 0 ? 8 : 0), 64, "#201f22");
  rect(96, 64, 48, 32, "#272224");
  c.save(); c.translate([0, 0, 2, 4, 4, 2, 0, 0][phase], 0);
  rect(100, 48, 40, 28, "#242124");
  for (const points of [[[104, 52], [84, 40], [76, 20], [84, 8]],
    [[136, 52], [156, 40], [164, 20], [156, 8]]]) {
    for (let i = 1; i < points.length; i++)
      pixelLine(c, ...points[i - 1], ...points[i], "#74604b", 8);
  }
  rect(104, 60, 12, phase === 6 ? 2 : 4, "#f3bb59");
  rect(128, 60, 12, phase === 6 ? 2 : 4, "#f3bb59");
  rect(112, 76, 20, 4, "#c16a36");
  c.restore();
  pixelLine(c, 120, 88, 116, 116, breath < 0 ? "#c46c35" : "#a24a30", 4);
  pixelLine(c, 116, 108, 128, 128, "#c46c35", 4);
  rect(76, 92, 20, 44 + arm, "#242124"); rect(148, 92, 20, 44 + arm, "#242124");
  rect(68, 128 + arm, 24, 16, "#332629"); rect(156, 128 + arm, 24, 16, "#332629");
  const sway = [0, 4, 8, 12, 8, 4, 0, -4][phase];
  const whip = [[176, 136 + arm], [208, 124 + sway], [228 + sway, 144],
    [224 + sway, 168 - sway], [204, 172 - sway]];
  for (let i = 1; i < whip.length; i++)
    pixelLine(c, ...whip[i - 1], ...whip[i], "#a65431", 4);
  for (let i = 0; i < 3; i++) {
    const rise = (fire * 12 + i * 20) % 56;
    rect(80 + i * 32, 44 - rise, 4, 4, i === fire % 3 ? "#c47c3e" : "#713b2a");
  }
  c.restore();
  for (let i = 0; i < 7; i++) {
    const x = 64 + i * 20;
    rect(x, 224 + (i % 2) * 4, 8, 4, (i + fire) % 3 ? "#6d3b2c" : "#bf6e36");
  }
  c.restore();
}

// Clear the complete bodies, not their alpha masks: uncertainty must never
// reveal a fossil or creature through a work block. Clearing overlaps is safe.
export function clearDiscoveryObstacles(c, placements, cavities) {
  for (const { slot } of placements.values()) c.clearRect(slot.x, slot.y, slot.width, slot.height);
  for (const r of cavities) c.clearRect(r.x, r.y, r.width, r.height);
}
