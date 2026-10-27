import test from 'node:test';
import assert from 'node:assert/strict';
import { PALETTE, demo, emptyProject } from './src/project/project.js';
import { BLOCK_COLOR_KEY, createBlockColorPreference } from './src/project/color-preference.js';
import { createProjectStore } from './src/project/store.js';
import { applyMasonry } from './masonry.js';
import { canonicalProject } from './src/sync/protocol.js';

function memoryStorage() {
  const values=new Map();
  return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
}

test('explicit color picks persist between forms, reloads, projects, and browser tabs', () => {
  const storage=memoryStorage(), a=createBlockColorPreference(storage), b=createBlockColorPreference(storage);
  assert.equal(a.initialColor(),'amber');
  a.remember('teal');
  assert.equal(a.initialColor(),'teal');
  assert.equal(b.initialColor(),'teal');
  assert.equal(createBlockColorPreference(storage).initialColor(),'teal');
  b.remember('rose');
  assert.equal(a.initialColor(),'rose');
  assert.equal(storage.getItem(BLOCK_COLOR_KEY),'rose');
});

test('opening below a source overrides the form without replacing the last explicit choice', () => {
  const storage=memoryStorage(), colors=createBlockColorPreference(storage);
  colors.remember('slate');
  assert.equal(colors.initialColor('moss'),'moss');
  assert.equal(colors.initialColor(),'slate');
  assert.equal(storage.getItem(BLOCK_COLOR_KEY),'slate');
  colors.remember('lemon');
  assert.equal(colors.initialColor(),'lemon');
});

test('invalid preferences fall back safely and blocked storage retains choices within the tab', () => {
  const storage=memoryStorage(); storage.setItem(BLOCK_COLOR_KEY,'not-a-color');
  const colors=createBlockColorPreference(storage);
  assert.equal(colors.initialColor(),'amber');
  colors.remember('peach'); colors.remember('__proto__');
  assert.equal(colors.initialColor(),'peach');
  assert.equal(colors.initialColor('unknown'),'peach');
  const blocked=createBlockColorPreference({getItem(){throw Error('blocked');},setItem(){throw Error('blocked');}});
  assert.equal(blocked.initialColor(),'amber'); blocked.remember('rose');
  assert.equal(blocked.initialColor(),'rose'); assert.equal(blocked.initialColor('blue'),'blue');
  assert.equal(blocked.initialColor(),'rose');
  const readOnly=createBlockColorPreference({getItem(){return 'amber';},setItem(){throw Error('quota');}});
  readOnly.remember('teal');
  assert.equal(readOnly.initialColor(),'teal');
});

test('all ten block colors survive validation, local persistence, and undo/redo', () => {
  assert.equal(Object.keys(PALETTE).length,10);
  const storage=memoryStorage(), store=createProjectStore({storage,initial:emptyProject});
  const p=store.getProject();
  p.blocks=Object.keys(PALETTE).map((color,i)=>({...demo().blocks[0],id:`color-${i}`,code:`PAL-${i}`,color,people:[]}));
  applyMasonry(p); assert.doesNotThrow(()=>canonicalProject(p));
  store.commit(p,{label:'Add colored blocks'});
  assert.deepEqual(createProjectStore({storage}).getProject().blocks.map(b=>b.color),Object.keys(PALETTE));
  store.undo(); assert.equal(store.getProject().blocks.length,0);
  store.redo(); assert.deepEqual(store.getProject().blocks.map(b=>b.color),Object.keys(PALETTE));
});
