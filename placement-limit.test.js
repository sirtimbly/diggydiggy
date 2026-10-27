import test from 'node:test';
import assert from 'node:assert/strict';
import {demo, validProject, STORAGE} from './src/project/project.js';
import {placementLimit, setPlacementLimit} from './src/project/crew.js';
import {createProjectStore} from './src/project/store.js';
import {projectDocument, materializeProject, diffDocuments} from './src/project/changes.js';
import {applyCommand, canonicalProject} from './src/sync/protocol.js';
import {guardProjectEdits} from './src/project/edit-access.js';
import {applyMasonry} from './masonry.js';
const command=(before,after)=>({version:1,id:'crew-limit',projectId:'room',clientId:'tab',baseRevision:1,kind:'edit',label:'Change crew placement limit',changes:diffDocuments(projectDocument(before),projectDocument(after))});

test('legacy rooms default to two without rewriting their document, and only integer limits one through eight are valid',()=>{
  const p=demo();applyMasonry(p);
  assert.equal(placementLimit(p),2);assert.equal(Object.hasOwn(projectDocument(p),'maxPlacements'),false);
  for(const invalid of [0,9,-1,2.5,'3',null,false,{},NaN]){
    assert.throws(()=>setPlacementLimit(p,invalid),/whole number/);
    assert.equal(validProject({...p,maxPlacements:invalid}),false);
    assert.throws(()=>canonicalProject({...p,maxPlacements:invalid}),/Invalid project/);
  }
  for(const n of [1,2,3,8])assert.equal(validProject(setPlacementLimit(p,n)),true);
});

test('the shared placement limit survives reload, sync, and Undo/Redo as one field',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};
  const create=()=>createProjectStore({storage});const store=create(),before=store.getProject();
  store.commit(setPlacementLimit(before,3),{label:'Change crew placement limit'});
  assert.equal(placementLimit(create().getProject()),3);
  const change=command(before,store.getProject());assert.deepEqual(change.changes.map(c=>c.path),[['maxPlacements']]);
  assert.equal(materializeProject(applyCommand(projectDocument(before),change,'room')).maxPlacements,3);
  store.undo();assert.equal(placementLimit(store.getProject()),2);assert.equal(Object.hasOwn(store.getProject(),'maxPlacements'),false);
  store.redo();assert.equal(placementLimit(store.getProject()),3);
  assert.equal(JSON.parse(storage.getItem(STORAGE)).maxPlacements,3);
});

test('raising the limit permits additional assignments, while lowering cannot silently discard or overbook placements',()=>{
  const p=demo();applyMasonry(p);p.blocks.find(b=>b.id==='b2').people.push('maya');
  assert.equal(validProject(p),true);
  const three=setPlacementLimit(p,3);three.blocks=structuredClone(p.blocks);three.blocks.find(b=>b.id==='b3').people.push('maya');
  assert.equal(validProject(three),true);assert.equal(validProject({...three,maxPlacements:2}),false);
  assert.throws(()=>setPlacementLimit(three,2),/Maya has more than 2 placements/);
  assert.equal(three.blocks.filter(b=>b.people.includes('maya')).length,3);
  assert.throws(()=>applyCommand(projectDocument(three),command(three,{...three,maxPlacements:2}),'room'),/Invalid project/);
  const one=setPlacementLimit(demo(),1);one.blocks.find(b=>b.id==='b2').people.push('maya');assert.equal(validProject(one),false);
});

test('a racing assignment cannot overbook a newly lowered project limit',()=>{
  const before=demo();applyMasonry(before);
  const lowered=setPlacementLimit(before,1),assigned=structuredClone(before);assigned.blocks.find(b=>b.id==='b2').people.push('maya');
  assert.throws(()=>applyCommand(projectDocument(lowered),command(before,assigned),'room'),/Invalid project/);
  assert.throws(()=>applyCommand(projectDocument(assigned),command(before,lowered),'room'),/Invalid project/);
});

test('completed work does not consume slots, and a saved form rechecks sign-in',()=>{
  const p=demo();p.blocks.find(b=>b.id==='b2').people.push('maya');p.blocks.find(b=>b.id==='b1').done=true;
  assert.equal(placementLimit(setPlacementLimit(p,1)),1);
  let signedIn=true,writes=0,prompts=0;
  const actions=guardProjectEdits({setPlacementLimit:()=>writes++},()=>signedIn,()=>prompts++);
  actions.setPlacementLimit(3);signedIn=false;actions.setPlacementLimit(1);
  assert.equal(writes,1);assert.equal(prompts,1);
});
