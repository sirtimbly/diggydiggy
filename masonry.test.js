import test from 'node:test';
import assert from 'node:assert/strict';
import { MASONRY, RESIZE_LIMITS, blockDimensions, footprint, excavationRects, applyMasonry, layoutMasonry, intersects, previewMove, previewResize, dependenciesOf, dependencyOrder, canAddDependency } from './masonry.js';

const block = (id, size = 'medium', uncertainty = 24) => ({ id, size, uncertainty, x: 48, y: 180, done: false });
function assertStructure(layout, cavities = []) {
  const slots = [...layout.placements.values()].map(p => p.slot);
  for (let i = 0; i < slots.length; i++) {
    const a = slots[i];
    assert.ok(a.x >= layout.left && a.x + a.width <= layout.right);
    for (const other of [...slots.slice(i + 1), ...cavities]) assert.equal(intersects(a, other), false, 'solid bodies never overlap work or excavated ground');
    assert.ok(a.y === MASONRY.top || [...slots, ...cavities].some(b => b.y + b.height === a.y && b.x < a.x + a.width && b.x + b.width > a.x), 'a slot must touch the surface or an existing course');
  }
}
test('packs mixed sizes and uncertainty into supported, non-overlapping masonry', () => {
  const blocks = Array.from({ length: 60 }, (_, i) => block(String(i), ['small', 'medium', 'large'][i % 3], i % 13 * 4));
  const result = layoutMasonry(blocks);
  assertStructure(result);
  assert.ok(result.height > 1160, 'large projects extend the world');
  assert.deepEqual(result, layoutMasonry(blocks), 'packing is deterministic');
});
test('extraction reserves the exact footprint and leaves other positions unchanged', () => {
  const project = { blocks: Array.from({ length: 8 }, (_, i) => block(String(i))) };
  const before = applyMasonry(project), first = project.blocks[0];
  first.done = true;
  project.excavations.push({ blockId: first.id, ...first.slot });
  const after = applyMasonry(project);
  for (const [id, placement] of after.placements) assert.deepEqual(placement, before.placements.get(id));
  assertStructure(after, project.excavations);
  assert.equal(project.excavations.length, 1);
});
test('dragging reorders and snaps without filling or moving excavated space', () => {
  const project = { blocks: Array.from({ length: 10 }, (_, i) => block(String(i), i % 2 ? 'small' : 'large', i % 4 * 12)) };
  applyMasonry(project);
  project.blocks[0].done = true;
  project.excavations.push({ blockId: '0', ...project.blocks[0].slot });
  applyMasonry(project);
  const holes = JSON.stringify(project.excavations);
  for (const [x, y] of [[48,104], [700,104], [400,600], [48,2000], [900,-100]]) {
    const preview = previewMove(project, '7', x, y);
    assertStructure(preview, project.excavations);
    assert.equal(JSON.stringify(project.excavations), holes);
    assert.equal(project.blocks.find(b => b.id === '7').pinnedColumn, undefined, 'preview does not mutate saved work');
  }
});
test('resizing and increasing unknown scope preserves cavities', () => {
  const project = { blocks: [block('a'), block('b'), block('c')] };
  applyMasonry(project);
  project.blocks[0].done = true;
  project.excavations.push({ blockId: 'a', ...project.blocks[0].slot });
  project.blocks[1].size = 'large'; project.blocks[1].uncertainty = 48;
  assertStructure(applyMasonry(project), project.excavations);
});
test('migration preserves old completion and creates its cavity only once', () => {
  const project = { blocks: [block('a'), { ...block('b'), done: true }, block('c')] };
  applyMasonry(project);
  const cavities = JSON.stringify(project.excavations);
  applyMasonry(project);
  assert.equal(project.excavations.length, 1);
  assert.equal(JSON.stringify(project.excavations), cavities);
  assert.equal(project.blocks.find(b => b.id === 'b').done, true);
});
test('all eight resize handles adjust the requested axes and preserve excavated ground', () => {
  const project = { blocks: Array.from({length:8}, (_,i)=>block(String(i))) };
  applyMasonry(project);
  project.blocks[0].done=true;project.excavations.push({blockId:'0',...project.blocks[0].slot});applyMasonry(project);
  const baseline=JSON.stringify(project),[w,h]=blockDimensions(project.blocks[3]);
  for(const edge of ['n','s','e','w','nw','ne','sw','se']){
    const preview=previewResize(project,'3',edge,edge.includes('w')?-40:40,edge.includes('n')?-40:40);
    const [width,height]=blockDimensions(preview.blocks.find(b=>b.id==='3'));
    assert.equal(width>w,/[ew]/.test(edge),edge+' changes width only when requested');
    assert.equal(height>h,/[ns]/.test(edge),edge+' changes height only when requested');
    assertStructure(preview,project.excavations);
    assert.equal(JSON.stringify(project),baseline,'resize preview and cancellation leave saved data intact');
  }
});
test('custom sizes clamp to readable and packable limits, and keyboard axes stay independent', () => {
  const project={blocks:[block('a'),block('b')]};applyMasonry(project);
  const tiny=previewResize(project,'a','se',-5000,-5000).blocks[0];
  assert.deepEqual(blockDimensions(tiny),[RESIZE_LIMITS.minWidth,RESIZE_LIMITS.minHeight]);
  const huge=previewResize(project,'a','se',5000,5000);
  assert.deepEqual(blockDimensions(huge.blocks[0]),[RESIZE_LIMITS.maxWidth,RESIZE_LIMITS.maxHeight]);assertStructure(huge);
  const horizontal=previewResize(project,'a','ne',8,0).blocks[0];
  assert.equal(horizontal.height,blockDimensions(project.blocks[0])[1]);
});
test('dragging grows columns in both directions without a fixed horizontal boundary', () => {
  const project={blocks:[block('a'),block('b'),block('c')]};applyMasonry(project);
  project.blocks[0].done=true;project.excavations.push({blockId:'a',...project.blocks[0].slot});applyMasonry(project);
  const holes=JSON.stringify(project.excavations);
  for(const column of [-1000,-40,-1,12,40,1000]){
    const preview=previewMove(project,'b',MASONRY.left+column*MASONRY.columnWidth,MASONRY.top);
    assert.equal(preview.placements.get('b').column,column);
    assertStructure(preview,project.excavations);
    assert.equal(JSON.stringify(project.excavations),holes);
    if(column<0)assert.ok(preview.left<0);
    if(column>12)assert.ok(preview.width>900);
  }
});
test('wide placements, their holes, and custom sizes survive save and reload', () => {
  const project={blocks:[block('a'),block('b')]};applyMasonry(project);
  project.blocks=previewMove(project,'a',MASONRY.left-35*MASONRY.columnWidth,MASONRY.top).blocks;applyMasonry(project);
  project.blocks.find(b=>b.id==='a').done=true;project.excavations.push({blockId:'a',...project.blocks.find(b=>b.id==='a').slot});
  const before=applyMasonry(project),restored=JSON.parse(JSON.stringify(project));
  assert.deepEqual(applyMasonry(restored),before);
  const resized=previewResize(restored,'b','nw',-64,-40);assertStructure(resized,restored.excavations);
});

function assertDependencyDepth(project,layout){
  for(const block of project.blocks.filter(b=>!b.done))for(const id of dependenciesOf(block)){
    const parent=layout.placements.get(id)?.slot??project.excavations?.find(h=>h.blockId===id);
    if(parent)assert.ok(layout.placements.get(block.id).slot.y>=parent.y+parent.height,block.id+' stays below '+id);
  }
}
test('dragging a dependent above its prerequisite preserves dependency depth in every column',()=>{
  const project={blocks:[block('parent'),{...block('child'),dependency:'parent'},block('other')]};applyMasonry(project);
  for(const x of [-2000,48,440,4000]){
    const preview=previewMove(project,'child',x,-500);
    assertDependencyDepth({...project,blocks:preview.blocks},preview);
    assert.equal(preview.placements.get('child').column,Math.round((x-MASONRY.left)/MASONRY.columnWidth));
  }
});
test('moving or resizing prerequisites carries every downstream branch below them',()=>{
  const project={blocks:[block('a'),block('other'),{...block('b'),dependencies:['a']},{...block('c'),dependencies:['a','b']},{...block('d'),dependencies:['c']}]};applyMasonry(project);
  const moved=previewMove(project,'a',48,1600);assertDependencyDepth({...project,blocks:moved.blocks},moved);
  const resized=previewResize(project,'a','se',200,400);assertDependencyDepth({...project,blocks:resized.blocks},resized);
  const reloaded=JSON.parse(JSON.stringify({...project,blocks:moved.blocks}));assertDependencyDepth(reloaded,applyMasonry(reloaded));
});
test('dependency links reject self, duplicate, and transitive cycles',()=>{
  const blocks=[block('a'),{...block('b'),dependencies:['a']},{...block('c'),dependencies:['b']}];
  assert.equal(canAddDependency(blocks,'a','a').ok,false);
  assert.equal(canAddDependency(blocks,'a','b').ok,false);
  assert.equal(canAddDependency(blocks,'c','a').ok,false);
  assert.equal(canAddDependency(blocks,'a','c').ok,true);
  assert.throws(()=>dependencyOrder([{...block('a'),dependencies:['b']},{...block('b'),dependencies:['a']}]),/cycle/);
});
test('cleared prerequisite holes retain their vertical ordering constraint',()=>{
  const project={blocks:[block('a'),{...block('b'),dependency:'a'}]};applyMasonry(project);
  project.blocks[0].done=true;project.excavations.push({blockId:'a',...project.blocks[0].slot});applyMasonry(project);
  const preview=previewMove(project,'b',2000,-500);assertDependencyDepth({...project,blocks:preview.blocks},preview);
});

test('collision bounds exactly match the colored body and ignore visual uncertainty',()=>{
  assert.deepEqual(footprint(block('a','medium',0)),footprint(block('a','medium',48)));
  const blocks=Array.from({length:4},(_,i)=>block(String(i),'medium',i*12));
  const result=layoutMasonry(blocks);
  for(const b of blocks){
    const p=result.placements.get(b.id);assert.deepEqual([p.slot.width,p.slot.height],blockDimensions(b));
    assert.equal(p.x,p.slot.x);assert.equal(p.y,p.slot.y);
  }
  assert.equal(result.placements.get('1').x,result.placements.get('0').x+250,'neighboring edges can touch without a column-sized reservation');
  assert.equal(result.placements.get('3').y,MASONRY.top+148,'stacked stone has no invisible headroom between bodies');
});

test('only unobstructed portions of a top face open a shaft to the surface',()=>{
  const blocks=[{...block('roof'),width:176,pinnedX:48},{...block('lower'),width:352,pinnedX:48}];
  const result=layoutMasonry(blocks),face=result.access.get('lower');
  assert.deepEqual(face.ranges,[{x:224,width:176}]);assert.equal(face.reachable,true);
  assert.deepEqual(face.blockedBy,['roof']);
  for(const shaft of excavationRects(result.placements))for(const {slot} of result.placements.values())assert.equal(intersects(shaft,slot),false,'shafts never tunnel through unfinished stone');
});

test('removing a roof exposes the dependent without collapsing its position or refilling the hole',()=>{
  const project={blocks:[{...block('roof'),pinnedX:48},{...block('lower'),pinnedX:48,dependency:'roof'}]};
  const before=applyMasonry(project),lower=before.placements.get('lower');
  assert.equal(before.access.get('lower').reachable,false);
  const roof=project.blocks[0];roof.done=true;project.excavations.push({blockId:roof.id,...roof.slot});
  const after=applyMasonry(project);
  assert.deepEqual(after.placements.get('lower'),lower);
  assert.equal(after.access.get('lower').reachable,true);
  assert.deepEqual(after.access.get('lower').ranges,[{x:lower.x,width:250}]);
  const shaft=excavationRects(after.placements,project.excavations).find(r=>r.y===MASONRY.surface);
  assert.equal(shaft.y+shaft.height,lower.y);assert.equal(shaft.width,lower.slot.width);
});

test('overlapping overhead projections leave exact exposed ledges and reject narrow access',()=>{
  const blocks=[{...block('left'),width:176,pinnedX:48},{...block('right'),width:176,pinnedX:300},{...block('lower'),width:500,pinnedX:48}];
  const result=layoutMasonry(blocks);
  assert.deepEqual(result.access.get('lower').ranges,[{x:224,width:76},{x:476,width:72}]);
  const narrow=layoutMasonry([{...block('roof'),width:250,pinnedX:48},{...block('lower'),width:272,pinnedX:48}]);
  assert.equal(narrow.access.get('lower').reachable,false,'a 22px sliver cannot accommodate a digger');
});

test('migration shrinks old padded excavations to their actual colored bounds once',()=>{
  const project={layoutVersion:2,blocks:[{...block('done'),done:true,x:100,y:200},{...block('live'),pinnedColumn:8}],excavations:[{blockId:'done',x:48,y:104,width:384,height:248}]};
  applyMasonry(project);
  assert.deepEqual(project.excavations,[{blockId:'done',x:100,y:200,width:250,height:148}]);
  assert.equal(project.layoutVersion,3);const saved=JSON.stringify(project.excavations);
  applyMasonry(project);assert.equal(JSON.stringify(project.excavations),saved);
});

test('surface access stays collision-free across mixed sizes, dependencies, and resizing',()=>{
  const project={blocks:Array.from({length:35},(_,i)=>({...block(String(i),['small','large','medium'][i%3],i%13*4),...(i%4===0&&i>0?{dependency:String(i-1)}:{})}))};
  applyMasonry(project);
  const preview=previewResize(project,'5','se',176,232);
  for(const shaft of excavationRects(preview.placements))for(const {slot} of preview.placements.values())assert.equal(intersects(shaft,slot),false);
  assertDependencyDepth({...project,blocks:preview.blocks},preview);
});
