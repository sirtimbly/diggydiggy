import test from 'node:test';
import assert from 'node:assert/strict';
import { installCanvasZoom, wheelZoomPlan } from './canvas-zoom.js';

function setup() {
  let listener, zoom=1, allowed=true, writes=0;
  const view={clientWidth:800,clientHeight:600,scrollLeft:400,scrollTop:300,
    getBoundingClientRect:()=>({left:20,top:40}),
    addEventListener(type,fn,options){assert.equal(type,'wheel');assert.equal(options.passive,false);listener=fn;},
    removeEventListener(type,fn){if(listener===fn)listener=null;}};
  const dispose=installCanvasZoom(view,{getZoom:()=>zoom,setZoom:z=>{zoom=z;writes++;},canZoom:()=>allowed});
  return {view,dispose,get zoom(){return zoom;},get writes(){return writes;},block(){allowed=false;},
    wheel(props={}){const e={deltaY:100,deltaMode:0,clientX:320,clientY:240,prevented:false,preventDefault(){this.prevented=true;},...props};listener?.(e);return e;}};
}

test('Command-scroll zooms the board around the cursor and preserves ordinary scrolling',()=>{
  const a=setup();
  assert.equal(a.wheel().prevented,false); assert.equal(a.writes,0);
  const worldX=(a.view.scrollLeft+300)/a.zoom,worldY=(a.view.scrollTop+200)/a.zoom;
  assert.equal(a.wheel({metaKey:true,deltaY:-80}).prevented,true);
  assert.ok(a.zoom>1);
  assert.ok(Math.abs((a.view.scrollLeft+300)/a.zoom-worldX)<1e-9);
  assert.ok(Math.abs((a.view.scrollTop+200)/a.zoom-worldY)<1e-9);
  a.wheel({metaKey:true,deltaY:160}); assert.ok(a.zoom<1);
  a.dispose(); assert.equal(a.wheel({metaKey:true}).prevented,false);
});

test('modified wheels normalize line/page units, respect limits, and never fall through to browser zoom',()=>{
  const a=setup();
  const pixel=wheelZoomPlan(1,{deltaY:48,deltaMode:0,clientX:300,clientY:200},a.view);
  const line=wheelZoomPlan(1,{deltaY:3,deltaMode:1,clientX:300,clientY:200},a.view);
  assert.equal(pixel.zoom,line.zoom);
  assert.equal(wheelZoomPlan(1,{deltaY:1,deltaMode:2,clientX:300,clientY:200},a.view).zoom,0.6);
  a.wheel({ctrlKey:true,deltaY:-10000});assert.equal(a.zoom,1.35);
  assert.equal(a.wheel({metaKey:true,deltaY:-10000}).prevented,true);assert.equal(a.zoom,1.35);
  a.wheel({metaKey:true,deltaY:10000});assert.equal(a.zoom,0.6);
  const writes=a.writes;a.block();assert.equal(a.wheel({metaKey:true}).prevented,true);assert.equal(a.writes,writes);
});
