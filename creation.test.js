import test from 'node:test';
import assert from 'node:assert/strict';
import { MASONRY, applyMasonry, previewMove, blockDimensions } from './masonry.js';
import { demo, emptyProject, validProject } from './src/project/project.js';
import { belowBlockTarget, dirtColumnTarget, creationPlacement, insertCreatedBlock } from './src/project/creation.js';
import { createProjectStore } from './src/project/store.js';
import { projectDocument, materializeProject, diffDocuments } from './src/project/changes.js';
import { applyCommand } from './src/sync/protocol.js';

const newBlock = (target, id = 'new') => ({ ...demo().blocks[0], id, title:'New work', size:'medium', progress:0,
  people:[], dependency:'', color:target.color ?? 'amber', ...creationPlacement(target) });

test('adding below buried work inherits color and width, preserves old work and cavities, and creates no dependency', () => {
  const p = emptyProject();
  p.blocks = [newBlock({x:48,y:144,width:300},'roof'),
    {...newBlock({x:400,y:144,width:250,color:'lilac'},'buried'),dependency:'roof'}];
  p.excavations = [{blockId:'old',x:400,y:500,width:250,height:148}];
  applyMasonry(p);
  const before = structuredClone(p), source = p.blocks[1], target = belowBlockTarget(source);
  p.blocks=insertCreatedBlock(p,newBlock(target),target); applyMasonry(p);
  const added = p.blocks.at(-1);
  assert.equal(added.color,'lilac'); assert.equal(added.width,blockDimensions(source)[0]);
  assert.equal(added.x,source.x); assert.ok(added.y >= source.y + blockDimensions(source)[1]);
  assert.equal(added.dependency,''); assert.deepEqual(added.people,[]); assert.equal(added.progress,0);
  assert.deepEqual(p.blocks.slice(0,-1),before.blocks); assert.deepEqual(p.excavations,before.excavations);
  assert.equal(validProject(p),true);
});

test('inserting below a source puts the new body before later work and reflows that work without adding a prerequisite', () => {
  const p=emptyProject();
  p.blocks=[newBlock({x:48,y:144,width:250},'source'),newBlock({x:48,y:144,width:250},'later')];
  applyMasonry(p);
  const source=p.blocks[0], bottom=source.y+blockDimensions(source)[1], target=belowBlockTarget(source);
  p.blocks=insertCreatedBlock(p,newBlock(target),target); applyMasonry(p);
  assert.deepEqual(p.blocks.map(b=>b.id),['source','new','later']);
  assert.equal(p.blocks[1].y,bottom);
  assert.equal(p.blocks[2].y,bottom+blockDimensions(p.blocks[1])[1]);
  assert.equal(p.blocks[1].dependency,'');
});

test('column targets follow current excavation depth, avoid narrow gaps, and work to either side of the world', () => {
  const p=emptyProject();
  assert.deepEqual(dirtColumnTarget(p,100),{x:48,width:250,y:MASONRY.top});
  p.excavations=[{x:48,y:144,width:250,height:300}];
  assert.deepEqual(dirtColumnTarget(p,100),{x:48,width:250,y:444});
  p.blocks=[newBlock({x:320,y:144,width:250},'neighbor')]; applyMasonry(p);
  assert.equal(dirtColumnTarget(p,308),null);
  for(const x of [-900,1400]) {
    const target=dirtColumnTarget(p,x); assert.ok(target.x<=x && target.x+target.width>x);
    assert.equal(target.y,MASONRY.top);
  }
  assert.equal(dirtColumnTarget(p,NaN),null);
});

test('contextual placement survives shared commands, reload, undo and redo, and dragging releases its depth floor', () => {
  const values=new Map(), storage={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)};
  const store=createProjectStore({storage,initial:emptyProject});
  const before=store.getProject(), after=structuredClone(before);
  after.blocks.push(newBlock({x:-300,y:600,width:250})); applyMasonry(after);
  store.commit(after,{label:'Add block'});
  assert.equal(createProjectStore({storage}).getProject().blocks[0].y,600);
  const command={version:1,id:'new-work',clientId:'tab',projectId:'room',baseRevision:1,kind:'edit',label:'Add block',changes:diffDocuments(projectDocument(before),projectDocument(after))};
  assert.equal(materializeProject(applyCommand(projectDocument(before),command,'room')).blocks[0].y,600);
  store.undo(); assert.equal(store.getProject().blocks.length,0);
  store.redo(); assert.equal(store.getProject().blocks[0].y,600);
  const moved=previewMove(store.getProject(),'new',48,144);
  assert.equal(moved.blocks[0].pinnedY,undefined); assert.equal(moved.placements.get('new').y,144);
  for(const pinnedY of [-1,Infinity,NaN,1e8]) {
    const invalid=structuredClone(after); invalid.blocks[0].pinnedY=pinnedY;
    assert.equal(validProject(invalid),false);
  }
});
