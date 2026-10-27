import test from 'node:test';
import assert from 'node:assert/strict';
import { demo, STORAGE, validProject } from './src/project/project.js';
import { saveDivider, validDividers, dividerPosition } from './src/project/dividers.js';
import { layoutDividerLabels } from './divider-labels.js';
import { createProjectStore } from './src/project/store.js';
import { projectDocument, diffDocuments } from './src/project/changes.js';
import { applyCommand } from './src/sync/protocol.js';
const initial={label:'First playable',color:'mist',x:64,y:440};
function setup(){const data=new Map(); const storage={getItem:k=>data.get(k),setItem:(k,v)=>data.set(k,v)};const create=()=>createProjectStore({key:STORAGE,initial:demo,storage});return {store:create(),create};}
const command=(before,after)=>({version:1,id:'phase-edit',clientId:'test-client',projectId:'room',baseRevision:1,kind:'edit',label:'Edit divider',changes:diffDocuments(projectDocument(before),projectDocument(after))});

test('divider add, move, rename, and removal survive history/reload without moving the stone',()=>{
 const {store,create}=setup(),before=store.getProject();
 assert.deepEqual(before.dividers,[]);
 store.commit(saveDivider(before,null,initial),{label:'Add divider'});
 const divider=store.getProject().dividers[0];
 store.commit(saveDivider(store.getProject(),divider.id,{...divider,...dividerPosition(-210,633)}),{label:'Move divider'});
 assert.equal(create().getProject().dividers[0].y,632);
 assert.deepEqual(store.getProject().blocks,before.blocks);
 store.undo(); assert.equal(store.getProject().dividers[0].y,440);
 store.undo(); assert.deepEqual(store.getProject().dividers,[]);
 store.redo(); assert.equal(store.getProject().dividers[0].label,'First playable');
 const removed=store.getProject();removed.dividers=[];store.commit(removed,{label:'Remove divider'});store.undo();assert.equal(store.getProject().dividers[0].id,divider.id);
});

test('legacy rooms accept new dividers and independent stale label/position edits merge',()=>{
 const {store}=setup(),before=store.getProject(),after=saveDivider(before,null,initial),legacy=projectDocument(before);delete legacy.dividers;
 const saved=applyCommand(legacy,command(before,after),'room'),divider=after.dividers[0];
 assert.equal(saved.dividers[divider.id].label,initial.label);
 const renamed=saveDivider(after,divider.id,{...divider,label:'Beta available'}),moved=saveDivider(after,divider.id,{...divider,y:640});
 const current=applyCommand(saved,command(after,renamed),'room');
 const merged=applyCommand(current,command(after,moved),'room');
 assert.equal(merged.dividers[divider.id].label,'Beta available');assert.equal(merged.dividers[divider.id].y,640);
 assert.throws(()=>applyCommand(current,{...command(after,moved),changes:[{path:['dividers','different'],before:null,after:{value:divider}}]},'room'));
});

test('divider validation rejects invalid labels, positions, colors, fields, duplicate IDs, and excessive markers',()=>{
 const d={id:'phase',...initial};assert.equal(validDividers([d]),true);
 for(const invalid of [{label:''},{label:'x'.repeat(61)},{x:Infinity},{y:143},{y:1e8},{color:'red'},{id:'__proto__'},{extra:true}])assert.equal(validDividers([{...d,...invalid}]),false);
 assert.equal(validDividers([d,d]),false);assert.equal(validDividers(Array.from({length:51},(_,i)=>({...d,id:`phase${i}`}))),false);
 const p=demo();p.dividers=[{...d,color:'unknown'}];assert.equal(validProject(p),false);
 assert.deepEqual(dividerPosition(19,-900),{x:16,y:144});
});

function overlaps(a,b){return a.x < b.x+b.width+8 && a.x+a.width>b.x-8 && a.y < b.y+b.height+8 && a.y+a.height>b.y-8;}
test('phase labels repeat in clear soil with margins around colored faces and walking diggers',()=>{
 const bodies=[{x:48,y:144,width:250,height:180},{x:550,y:128,width:40,height:48}];
 const labels=layoutDividerLabels({...initial,y:270},bodies,{left:0,right:1440},130);
 assert.ok(labels.length>=2);
 for(const label of labels){assert.ok(label.x>=8&&label.x+label.width<=1432);for(const body of bodies)assert.equal(overlaps(label,body),false);}
 const workers=layoutDividerLabels({...initial,y:170},bodies,{left:0,right:1440},130);
 for(const label of workers)for(const body of bodies)assert.equal(overlaps(label,body),false);
});

test('a fully occupied course moves its caption above the stone and remains readable after panning',()=>{
 const bodies=[{x:-1000,y:144,width:3000,height:400}];
 for(const viewport of [{left:0,right:390},{left:-720,right:-330},{left:900,right:1290}]){
  const labels=layoutDividerLabels({...initial,y:440},bodies,viewport,200);
  assert.equal(labels.length,1);assert.equal(labels[0].y,108);assert.equal(overlaps(labels[0],bodies[0]),false);
  assert.ok(labels[0].x>=viewport.left+8&&labels[0].x+200<=viewport.right-8);
 }
});

test('zoom-compensated labels reserve their complete readable size instead of overlapping stone',()=>{
 const scale=1/.6,bodies=[{x:0,y:144,width:250,height:400}];
 const labels=layoutDividerLabels({...initial,y:440},bodies,{left:0,right:630},200*scale,{height:28*scale,gap:8*scale});
 assert.ok(labels.length);
 for(const label of labels){assert.equal(label.height,28*scale);for(const body of bodies)assert.equal(overlaps(label,body),false);}
});

test('compact captions keep their full multiline height and can fit above a wider lower course',()=>{
 const scale=1/.6,bodies=[{x:112,y:144,width:250,height:292},{x:496,y:144,width:300,height:172},
  {x:112,y:436,width:300,height:172},{x:496,y:464,width:250,height:148}];
 const labels=layoutDividerLabels({...initial,y:496},bodies,{left:0,right:630},200*scale,
  {height:28*scale,gap:8*scale,compactHeight:()=>78*scale});
 assert.equal(labels.length,1);assert.equal(labels[0].compact,true);assert.equal(labels[0].height,78*scale);
 assert.ok(labels[0].y+labels[0].height<436);
 for(const label of labels)for(const body of bodies)assert.equal(overlaps(label,body),false);
});
