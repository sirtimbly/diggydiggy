import test from "node:test";
import assert from "node:assert/strict";
import { introFrame, introRects, dirtParticles } from "./src/rendering/intro.js";
import { emptyProject } from "./src/project/project.js";

test("intro waits for real data, then completes; reduced motion skips pan and particles", () => {
  assert.equal(introFrame(20_000, null).done, false);
  assert.equal(introFrame(20_000, null).bursting, false);
  const loading = introFrame(3000, 2900);
  assert.equal(loading.bursting, false);
  assert.equal(introFrame(4500, 2900).done, true);
  assert.equal(introFrame(2200, 0).bursting, true);
  assert.equal(introFrame(3500, 0).done, true);
  assert.deepEqual({...introFrame(200, 0, true), burstTime:0}, {pan:0, bursting:false, burstTime:0, dissolve:1, done:true});
});
test("reveal uses current custom dimensions and permanent cavities in screen space, clipped to the visible dig", () => {
  const project = {...emptyProject(), blocks:[{id:"a",x:-100,y:200,width:400,height:240,size:"medium",done:false},
    {id:"removed",x:700,y:300,size:"large",done:true}],excavations:[{x:500,y:400,width:200,height:160}]};
  const original = structuredClone(project);
  const viewport = {left:0,top:100,right:800,bottom:600};
  const rectangles = introRects(project,{left:-20,top:100,zoom:.5,worldLeft:-200,viewport});
  assert.ok(rectangles.some(r=>r.x===30&&r.y===200&&r.width===200&&r.height===120));
  assert.ok(rectangles.some(r=>r.x===330&&r.y===300&&r.width===100&&r.height===80));
  assert.ok(rectangles.every(r=>r.x>=0&&r.y>=100&&r.x+r.width<=800&&r.y+r.height<=600));
  assert.deepEqual(project,original);
});
test("empty projects reveal cleanly and dirt sampling stays bounded and repeatable", () => {
  assert.deepEqual(introRects(emptyProject(),{left:0,top:0,zoom:1,worldLeft:0,viewport:{left:0,top:0,right:800,bottom:600}}),[]);
  const shape=[{x:0,y:100,width:3000,height:2000}];
  const particles=dirtParticles(shape,260);
  assert.ok(particles.length<=260 && particles.length>0);
  assert.deepEqual(particles,dirtParticles(shape,260));
  assert.ok(particles.every(p=>p.vy<0));
});
