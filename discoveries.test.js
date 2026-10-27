import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutMasonry } from './masonry.js';
import { drawDinosaurFossil, drawDwarf, drawBalrog, clearDiscoveryObstacles, FOSSIL_TOP, DWARF_TOP, BALROG_TOP, BALROG_HEIGHT } from './src/rendering/terrain-props.js';

// A small alpha raster exercises the actual pixel artwork and its erasure.
function raster() {
  const pixels = new Map(), stack = [];
  let x = 0, y = 0;
  return {
    pixels, globalAlpha: 1, fillStyle: '',
    save() { stack.push([x, y, this.globalAlpha]); },
    restore() { [x, y, this.globalAlpha] = stack.pop(); },
    translate(dx, dy) { x += dx; y += dy; },
    fillRect(left, top, width, height) {
      for (let py = y + top; py < y + top + height; py++)
        for (let px = x + left; px < x + left + width; px++)
          pixels.set(`${px},${py}`, `${this.fillStyle}:${this.globalAlpha}`);
    },
    clearRect(left, top, width, height) {
      for (let py = y + top; py < y + top + height; py++)
        for (let px = x + left; px < x + left + width; px++) pixels.delete(`${px},${py}`);
    },
  };
}

test('unknown blocks and overlapping cavities completely hide discovery artwork', () => {
  const c = raster(); drawDinosaurFossil(c);
  const before = c.pixels.size;
  const slot = {x:772,y:FOSSIL_TOP,width:80,height:88};
  assert.ok([...c.pixels.keys()].some(key => { const [x,y]=key.split(',').map(Number); return x>=slot.x&&x<slot.x+slot.width&&y>=slot.y&&y<slot.y+slot.height; }));
  clearDiscoveryObstacles(c, new Map([['unknown', {slot, uncertainty:48}]]), [{x:816,y:FOSSIL_TOP+32,width:80,height:64}]);
  assert.ok(c.pixels.size > 0 && c.pixels.size < before, 'only covered fragments disappear');
  for (const key of c.pixels.keys()) {
    const [x,y] = key.split(',').map(Number);
    assert.equal(x>=772&&x<852&&y>=FOSSIL_TOP&&y<FOSSIL_TOP+88, false);
    assert.equal(x>=816&&x<896&&y>=FOSSIL_TOP+32&&y<FOSSIL_TOP+96, false);
  }
});

test('deep discoveries stay at their world depths and have deterministic animated poses', () => {
  assert.equal(FOSSIL_TOP, 576); assert.equal(DWARF_TOP, 1536); assert.equal(BALROG_TOP, 2016);
  for (const [draw, top] of [[drawDwarf,DWARF_TOP],[drawBalrog,BALROG_TOP]]) {
    const a=raster(), b=raster(), again=raster(); draw(a,0); draw(b,440); draw(again,0);
    assert.deepEqual(a.pixels,again.pixels);
    assert.notDeepEqual(a.pixels,b.pixels);
    assert.ok([...a.pixels.keys()].every(key=>Number(key.split(',')[1])>=top));
  }
});

test('small projects stop above deep discoveries; additional work extends the ground', () => {
  const block = i => ({id:String(i),size:'medium',pinnedX:48,done:false});
  assert.ok(layoutMasonry([block(1)]).height < DWARF_TOP);
  assert.ok(layoutMasonry(Array.from({length:15},(_,i)=>block(i))).height > BALROG_TOP+BALROG_HEIGHT);
});

test('balrog idle moves its body, loops cleanly, and stays inside its cave bounds', () => {
  const first = raster(), shifted = raster(), loop = raster();
  drawBalrog(first, 0); drawBalrog(shifted, 1080); drawBalrog(loop, 2880);
  assert.deepEqual(first.pixels, loop.pixels, 'the full idle cycle returns to its starting pose');
  const torso = c => [...c.pixels].filter(([,color]) => color.startsWith('#201f22')).map(([key]) => key).sort();
  assert.notDeepEqual(torso(first), torso(shifted), 'the creature moves as well as its flames');
  for (let phase = 0; phase < 8; phase++) {
    const frame = raster(); drawBalrog(frame, phase * 360);
    for (const key of frame.pixels.keys()) {
      const y = Number(key.split(',')[1]);
      assert.ok(y >= BALROG_TOP && y < BALROG_TOP + BALROG_HEIGHT, 'culling includes the cave and every idle pose');
    }
  }
});
