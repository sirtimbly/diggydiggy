import test from 'node:test';
import assert from 'node:assert/strict';
import { fractureField, visibleFractures } from './fractures.js';
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<.001;

test('fractures grow from the boundary through connected tips and smaller forks',()=>{
  for(const [width,height] of [[176,132],[300,172],[640,640]]){
    const field=fractureField(width,height,42);
    assert.deepEqual(field,fractureField(width,height,42));
    assert.notDeepEqual(field,fractureField(width,height,43));
    assert.ok(field.some(e=>e.depth===2),'secondary forks exist');
    for(const e of field){
      for(const p of [e.a,e.b]){assert.ok(p.x>=0&&p.x<width);assert.ok(p.y>=0&&p.y<height);}
      assert.ok(e.end>e.at&&e.end<=1);
      const parent=field.find(p=>p.root===e.root&&near(p.b,e.a)&&p.end<=e.at+.0001);
      assert.ok(parent||e.a.x===0||e.a.y===0||e.a.x===width-1||e.a.y===height-1,'every fracture begins at an edge or a grown parent tip');
    }
    assert.deepEqual(visibleFractures(field,0),[]);
    const lengths=[5,20,50,90,100].map(progress=>visibleFractures(field,progress).reduce((sum,e)=>sum+Math.hypot(e.b.x-e.a.x,e.b.y-e.a.y),0));
    assert.ok(lengths.every((length,i)=>i===0||length>lengths[i-1]),'progress grows the network instead of changing line thickness');
  }
});

test('a visible fork never appears before its parent reaches the branching point',()=>{
  const field=fractureField(300,220,87);
  for(const progress of [1,10,30,55,75,99]){
    const visible=visibleFractures(field,progress);
    for(const edge of visible){
      const parent=field.find(p=>p.root===edge.root&&near(p.b,edge.a)&&p.end<=edge.at+.0001);
      if(parent)assert.ok(visible.some(p=>near(p.b,edge.a)),'branch tip stays attached to visible parent');
    }
  }
});
