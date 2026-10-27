import test from 'node:test';
import assert from 'node:assert/strict';
import { CREW_POSITION_KEY, installCrewPaletteDrag } from './crew-palette-drag.js';

class Surface extends EventTarget {
  constructor(props={}) {super();Object.assign(this,props);}
  fire(type, props={}) {
    const e = new Event(type,{cancelable:true});
    Object.assign(e,{button:0,pointerId:1,clientX:20,clientY:20,key:'',targetControl:false,...props});
    this.dispatchEvent(e);return e;
  }
}
function setup(saved=null, blocked=false) {
  const win=new Surface({innerWidth:1000,Event});
  let observer, captures=new Set(), writes=0, moves=0, focused=0;
  win.ResizeObserver=class {constructor(fn){observer=fn;}observe(){}disconnect(){observer=null;}};
  const doc=new Surface({defaultView:win,hidden:false});
  const stage={clientWidth:1000,clientHeight:600};
  const panel=new Surface({parentElement:stage,ownerDocument:doc,offsetWidth:236,offsetHeight:160,style:{},dataset:{}});
  const handle=new Surface({focus(){focused++;}});
  const header=new Surface({closest:()=>null,setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>captures.delete(id)});
  const storage={getItem(key){assert.equal(key,CREW_POSITION_KEY);if(blocked)throw Error();return saved;},
    setItem(key,value){if(blocked)throw Error();saved=value;writes++;},removeItem(){saved=null;writes++;}};
  panel.addEventListener('crew-palette-move',()=>moves++);
  const dispose=installCrewPaletteDrag(panel,header,handle,storage);
  const down=(props={})=>header.fire('pointerdown',props);
  return {win,doc,stage,panel,header,handle,down,dispose,resize:()=>observer?.(),
    get xy(){return [parseFloat(panel.style.left),parseFloat(panel.style.top)];},
    get saved(){return JSON.parse(saved);},get writes(){return writes;},get moves(){return moves;},get focused(){return focused;},get captures(){return captures.size;}};
}

test('crew header drag moves in screen space, clamps, and remembers only a completed gesture',()=>{
  const a=setup(); assert.deepEqual(a.xy,[12,10]);
  assert.equal(a.down().defaultPrevented,true);assert.equal(a.focused,1);
  a.header.fire('pointermove',{clientX:22});assert.deepEqual(a.xy,[12,10]);
  a.header.fire('pointermove',{clientX:320,clientY:120});assert.deepEqual(a.xy,[312,110]);
  assert.equal(a.writes,0);assert.equal(a.panel.dataset.moving,'true');
  a.header.fire('pointermove',{clientX:3000,clientY:3000});assert.deepEqual(a.xy,[756,432]);
  a.header.fire('pointerup');assert.equal(a.writes,1);assert.equal(a.captures,0);
  assert.equal(a.panel.dataset.moving,undefined);assert.deepEqual(a.saved,{version:1,x:1,y:1});
  assert.ok(a.moves>1);
  a.dispose();
});

test('other controls and pointer identities retain their own interactions',()=>{
  const a=setup();
  a.header.closest=(selector)=>selector === "button,a,input";
  assert.equal(a.down().defaultPrevented,false);assert.equal(a.captures,0);
  a.header.closest=()=>null;
  for(const props of [{button:2},{isPrimary:false},{metaKey:true},{ctrlKey:true},{altKey:true}])assert.equal(a.down(props).defaultPrevented,false);
  a.down();a.header.fire('pointermove',{pointerId:2,clientX:400});a.header.fire('pointerup',{pointerId:2});
  assert.deepEqual(a.xy,[12,10]);assert.equal(a.captures,1);
  a.header.fire('pointerup');assert.equal(a.writes,0);a.dispose();
});

test('cancel, lost capture, Escape, blur, hidden document, and resize restore the origin without saving',()=>{
  for(const cancel of [a=>a.header.fire('pointercancel'),a=>a.header.fire('lostpointercapture'),a=>a.handle.fire('keydown',{key:'Escape'}),a=>a.win.fire('blur'),a=>{a.doc.hidden=true;a.doc.fire('visibilitychange');},a=>a.resize()]) {
    const a=setup();a.down();a.header.fire('pointermove',{clientX:200,clientY:200});cancel(a);
    assert.deepEqual(a.xy,[12,10]);assert.equal(a.writes,0);assert.equal(a.captures,0);assert.equal(a.panel.dataset.moving,undefined);a.dispose();
  }
});

test('keyboard movement, reset, and responsive dimensions keep the tray accessible',()=>{
  const a=setup();a.handle.fire('keydown',{key:'ArrowRight'});a.handle.fire('keydown',{key:'ArrowDown',shiftKey:true});
  assert.deepEqual(a.xy,[20,42]);assert.equal(a.writes,2);
  const b=setup(JSON.stringify(a.saved));assert.deepEqual(b.xy,a.xy);
  b.stage.clientWidth=320;b.stage.clientHeight=200;b.win.innerWidth=320;b.resize();
  assert.ok(b.xy[0]>=8 && b.xy[0]+236<=312);assert.ok(b.xy[1]>=8 && b.xy[1]+160<=192);
  b.panel.offsetHeight=40;b.resize();assert.ok(b.xy[1]+40<=192);
  b.handle.fire('keydown',{key:'Home'});assert.deepEqual(b.xy,[8,10]);assert.equal(b.saved,null);
  a.dispose();b.dispose();
});

test('invalid or unavailable storage does not prevent movement and cleanup removes every input hook',()=>{
  for(const saved of ['bad json','{"version":1,"x":null,"y":1}','{"version":1,"x":2,"y":1}']) {
    const a=setup(saved);assert.deepEqual(a.xy,[12,10]);a.dispose();
  }
  const a=setup(null,true);a.handle.fire('keydown',{key:'ArrowRight'});a.resize();assert.deepEqual(a.xy,[20,10]);
  a.down();a.header.fire('pointermove',{clientX:200});a.dispose();assert.deepEqual(a.xy,[20,10]);assert.equal(a.captures,0);
  a.down();a.handle.fire('keydown',{key:'ArrowRight'});a.win.fire('resize');assert.deepEqual(a.xy,[20,10]);
});
