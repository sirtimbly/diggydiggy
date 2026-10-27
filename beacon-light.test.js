import test from 'node:test';
import assert from 'node:assert/strict';
import { BEACON_LIGHT, beaconRotation, beaconLightPixels, installBeaconLight } from './beacon-light.js';
const width=BEACON_LIGHT.width/4, height=BEACON_LIGHT.height/4;
const alpha=(pixels,x,y)=>pixels[(y*width+x)*4+3];

test('one beam sweeps left and right through the center, turning white when facing the viewer',()=>{
  const front=beaconLightPixels(0),right=beaconLightPixels(1500),back=beaconLightPixels(3000),left=beaconLightPixels(4500);
  const at=(pixels,x,y)=>alpha(pixels,width/2+x,height/2+y);
  assert.deepEqual(beaconLightPixels(6000),front);
  assert.ok(at(right,24,0)>at(right,-24,0)*4,'right-facing cone projects to the right');
  assert.ok(at(left,-24,0)>at(left,24,0)*4,'left-facing cone projects to the left');
  assert.ok(at(back,6,0)>40,'the same beam remains visible through the rear half-turn');
  const center=((height/2)*width+width/2)*4;
  assert.ok(front[center+2]>back[center+2]+100,'front-facing light becomes white');
  assert.ok(at(front,0,0)>at(back,0,0),'front-facing center also becomes brighter');
  for(const pixels of [front,right,back,left]) {
    assert.ok(at(pixels,0,24)<at(right,24,0),'beam never rotates downward');
    assert.ok(at(pixels,0,-24)<at(left,-24,0),'beam never rotates upward');
    for(let x=0;x<width;x++){assert.equal(alpha(pixels,x,0),0);assert.equal(alpha(pixels,x,height-1),0);}
    for(let y=0;y<height;y++){assert.equal(alpha(pixels,0,y),0);assert.equal(alpha(pixels,width-1,y),0);}
  }
  assert.ok(at(right,6,0)>at(right,24,0));
  assert.ok(at(right,24,0)>at(right,60,0));
  assert.ok(beaconRotation(0).glare>beaconRotation(3000).glare);
  assert.ok(beaconRotation(1500).scale<beaconRotation(0).scale);
});

test('beam movement and brightness remain continuous throughout a full turn',()=>{
  let previous = null, largestStep = 0;
  const buffer = new Uint8ClampedArray(width*height*4);
  for(let time=0;time<=6000;time+=1000/60){
    const pixels=beaconLightPixels(time,false,buffer);
    let weight=0,center=0;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const value=alpha(pixels,x,y);weight+=value;center+=(x-width/2)*value;
    }
    const position=center/weight;
    if(previous!==null) largestStep=Math.max(largestStep,Math.abs(position-previous));
    assert.ok(weight>30000,'the beam never vanishes during the turn');
    previous=position;
  }
  assert.ok(largestStep<1,'the light footprint moves less than one pixel cell per frame');
});

test('reduced motion preserves a steady light pool and output buffers can be reused',()=>{
  assert.deepEqual(beaconLightPixels(0,true),beaconLightPixels(3100,true));
  const buffer=new Uint8ClampedArray(width*height*4);
  assert.equal(beaconLightPixels(0,false,buffer),buffer);
  assert.ok(alpha(beaconLightPixels(0,true),width/2+7,height/2)>0);
});

test('beacons stop offscreen and when hidden, respond to reduced motion, and fully dispose animation hooks',()=>{
  let id=0,frames=new Map(),observe,disconnected=false,paints=0;
  const properties=new Map();
  const motion=new EventTarget();motion.matches=false;
  const win={matchMedia:()=>motion,requestAnimationFrame(fn){frames.set(++id,fn);return id;},cancelAnimationFrame(key){frames.delete(key);},
    IntersectionObserver:class{constructor(fn){observe=fn;}observe(){}disconnect(){disconnected=true;}}};
  const doc=new EventTarget();doc.defaultView=win;doc.hidden=false;
  const canvas={ownerDocument:doc,getContext:()=>({createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){paints++;}})};
  const beacon={style:{setProperty(key,value){properties.set(key,value);}}};
  const dispose=installBeaconLight(canvas,beacon);
  assert.deepEqual([canvas.width,canvas.height],[144,108]);assert.equal(frames.size,0);
  observe([{isIntersecting:true}]);assert.equal(frames.size,1);assert.equal(properties.get('--beacon-face-opacity'),'1');
  function tick(time){const [key,fn]=frames.entries().next().value;frames.delete(key);fn(time);}
  tick(100);const painted=paints;tick(116);assert.equal(paints,painted+1,'paints on every animation frame');tick(132);assert.equal(paints,painted+2);
  doc.hidden=true;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0);
  doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,1);
  motion.matches=true;motion.dispatchEvent(new Event('change'));assert.equal(frames.size,0);
  motion.matches=false;motion.dispatchEvent(new Event('change'));assert.equal(frames.size,1);
  observe([{isIntersecting:false}]);assert.equal(frames.size,0);
  observe([{isIntersecting:true}]);dispose();assert.equal(frames.size,0);assert.equal(disconnected,true);
  const before=paints;doc.dispatchEvent(new Event('visibilitychange'));motion.dispatchEvent(new Event('change'));assert.equal(paints,before);
});
