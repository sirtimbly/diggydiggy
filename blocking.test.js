import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, validProject } from './src/project/project.js';
import { setBlockBlocked } from './src/project/blocking.js';
import { createProjectStore } from './src/project/store.js';
import { projectDocument, materializeProject, diffDocuments } from './src/project/changes.js';
import { canonicalProject, applyCommand } from './src/sync/protocol.js';
import { guardProjectEdits } from './src/project/edit-access.js';
import { applyMasonry } from './masonry.js';

function setup() {
  const data=new Map();
  const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
  const create=()=>createProjectStore({storage});
  return {store:create(),create};
}
function command(before,after) {
  return {version:1,id:'block-site',projectId:'room',clientId:'browser',baseRevision:1,kind:'edit',label:'Block work site',changes:diffDocuments(projectDocument(before),projectDocument(after))};
}

test('blocking frees only that site’s diggers, leaves the work intact, and unblocking does not reassign them',()=>{
  const p=demo(),b=p.blocks[0],original=structuredClone(b),other=structuredClone(p.blocks[1]);
  assert.equal(setBlockBlocked(b,true),true);
  assert.deepEqual(b,{...original,blocked:true,people:[]});assert.deepEqual(p.blocks[1],other);
  assert.equal(setBlockBlocked(b,true),false);
  assert.equal(setBlockBlocked(b,false),true);assert.deepEqual(b.people,[]);assert.equal(b.progress,original.progress);
  b.done=true;assert.equal(setBlockBlocked(b,true),false);assert.equal(setBlockBlocked(null,true),false);
});

test('one blocked edit survives reload and sync, and Undo/Redo restores assignments atomically',()=>{
  const {store,create}=setup(),before=store.getProject(),after=structuredClone(before);
  setBlockBlocked(after.blocks[0],true);store.commit(after,{label:'Block work site'});
  assert.equal(create().getProject().blocks[0].blocked,true);assert.deepEqual(create().getProject().blocks[0].people,[]);
  const changes=command(before,after);
  assert.deepEqual(changes.changes.map(c=>c.path.at(-1)).sort(),['blocked','people']);
  const synced=materializeProject(applyCommand(projectDocument(before),changes,'room'));
  assert.equal(synced.blocks[0].blocked,true);assert.deepEqual(synced.blocks[0].people,[]);
  store.undo();assert.deepEqual(store.getProject().blocks[0],before.blocks[0]);
  store.redo();assert.deepEqual(store.getProject().blocks[0],after.blocks[0]);
});

test('legacy blocks stay compatible, while invalid flags and assignments to blocked sites are rejected at persistence and protocol boundaries',()=>{
  const legacy=demo();applyMasonry(legacy);assert.equal(validProject(legacy),true);assert.equal(canonicalProject(legacy).blocks[0].blocked,undefined);
  for(const value of ['true',1,null,{},[]]) {
    const invalid=structuredClone(legacy);invalid.blocks[0].blocked=value;
    assert.equal(validProject(invalid),false);assert.throws(()=>canonicalProject(invalid),/Invalid project/);
  }
  const blocked=structuredClone(legacy);setBlockBlocked(blocked.blocks[0],true);
  const {store}=setup();store.commit(blocked);
  for(const invalid of [{...blocked.blocks[0],people:['maya']},{...blocked.blocks[0],done:true}]) {
    const next=structuredClone(blocked);next.blocks[0]=invalid;
    assert.equal(validProject(next),false);
    assert.throws(()=>store.commit(next),/invalid project/);
    assert.throws(()=>applyCommand(projectDocument(blocked),command(blocked,next),'room'),/Invalid project/);
  }
});

test('a racing assignment cannot sneak into a blocked site or remove its closure',()=>{
  const before=demo();applyMasonry(before);before.blocks[0].people=[];
  const blocked=structuredClone(before);setBlockBlocked(blocked.blocks[0],true);
  const assigned=structuredClone(before);assigned.blocks[0].people=['maya'];
  assert.throws(()=>applyCommand(projectDocument(blocked),command(before,assigned),'room'),/Invalid project/);
  assert.throws(()=>applyCommand(projectDocument(assigned),command(before,blocked),'room'),/Invalid project/);
});

test('the blocked toggle rechecks sign-in even when its inspector was opened earlier',()=>{
  let signedIn=true,changes=0,prompts=0;
  const actions=guardProjectEdits({setBlocked:()=>changes++},()=>signedIn,()=>prompts++);
  actions.setBlocked();signedIn=false;actions.setBlocked();
  assert.equal(changes,1);assert.equal(prompts,1);
});
