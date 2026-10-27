import test from 'node:test';
import assert from 'node:assert/strict';
import { drawUncertainty } from './src/rendering/pixels.js';
import { demo } from './src/project/project.js';

test('unknown ground retains a translucent body at every slider level, while known areas stay solid', () => {
  const original=globalThis.document;
  let canvas;
  globalThis.document={createElement(){
    canvas={width:0,height:0,pixels:[],getContext(){
      const context={globalAlpha:1,fillRect(x,y,w,h){
        for(let row=y;row<Math.min(canvas.height,y+h);row++) for(let col=x;col<Math.min(canvas.width,x+w);col++) {
          const index=row*canvas.width+col;
          canvas.pixels[index]=context.globalAlpha+(canvas.pixels[index]??0)*(1-context.globalAlpha);
        }
      }};
      return context;
    },toDataURL(){return 'data:image/png;base64,mask';}};
    return canvas;
  }};
  try {
    const face={style:{}},node={querySelector:()=>face};
    const block={...demo().blocks[0],width:257,height:201};
    const means=[];
    for(const uncertainty of [1,24,48]) {
      drawUncertainty(node,{...block,uncertainty});
      assert.equal(canvas.pixels.length,257*201);
      assert.ok(canvas.pixels.every(alpha=>alpha>0 && alpha<=1),'the obscured body never becomes an empty hole');
      assert.ok(canvas.pixels.some(alpha=>alpha===1),'known material stays opaque');
      assert.ok(canvas.pixels.some(alpha=>alpha<1),'unknown material reveals soil beneath');
      means.push(canvas.pixels.reduce((sum,alpha)=>sum+alpha,0)/canvas.pixels.length);
    }
    assert.ok(means[0]>means[1] && means[1]>means[2],'increasing unknown obscures more of the same footprint');
    drawUncertainty(node,{...block,uncertainty:0});
    assert.equal(face.style.maskImage,'none','fully known material has no uncertainty mask');
  } finally {globalThis.document=original;}
});
