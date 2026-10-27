import test from 'node:test';
import assert from 'node:assert/strict';
import {drawSprite} from './src/rendering/pixels.js';
import {DEFAULT_CREW} from './src/project/crew.js';

function raster(person,pose) {
  const pixels=Array(40*48).fill(null),stack=[];
  let sx=1,tx=0;
  const c={fillStyle:'',clearRect(){pixels.fill(null);},save(){stack.push([sx,tx]);},restore(){[sx,tx]=stack.pop();},
    translate(x){tx+=x*sx;},scale(x){sx*=x;},fillRect(x,y,w,h){
      const left=Math.min(tx+sx*x,tx+sx*(x+w));
      for(let row=y;row<y+h;row++)for(let col=left;col<left+w;col++)if(col>=0&&col<40&&row>=0&&row<48)pixels[row*40+col]=this.fillStyle;
    }};
  drawSprite({getContext:()=>c},person,pose);
  return {pixels,at:(x,y)=>pixels[y*40+x]};
}

test('both forward-facing eyes stay visible and centered in their lenses across poses, directions, hair, and headphones',()=>{
  for(const facing of [1,-1])for(const mode of ['idle','walk','dig','coffee','phone'])for(const glasses of [false,true])for(const headphones of [false,true])for(const hairLength of ['none','short','medium','long']) {
    const pose={mode,frame:mode==='dig'?2:1,facing,phase:.5};
    const image=raster({...DEFAULT_CREW[0],glasses,headphones,hairLength},pose);
    const eyes=image.pixels.flatMap((color,index)=>color==='#2a2e2b'?[{x:index%40,y:Math.floor(index/40)}]:[]);
    assert.equal(eyes.length,8,JSON.stringify({pose,glasses,headphones,hairLength}));
    const top=Math.min(...eyes.map(p=>p.y)),xs=eyes.filter(p=>p.y===top).map(p=>p.x);
    assert.deepEqual(xs,[xs[0],xs[0]+1,xs[0]+8,xs[0]+9]);
    if(glasses)for(const x of [xs[0],xs[2]]) {
      assert.equal(image.at(x-2,top-2),'#293335');
      assert.equal(image.at(x+3,top+3),'#293335');
      assert.equal(image.at(x-1,top),DEFAULT_CREW[0].skin);
      assert.equal(image.at(x+2,top),DEFAULT_CREW[0].skin);
    }
  }
});

test('headphones leave the entire hardhat visible while ear cups remain below the brim in every pose and direction',()=>{
  for(const facing of [1,-1])for(const mode of ['idle','walk','dig','coffee','phone'])for(const frame of [0,1,2,3])for(const glasses of [false,true]) {
    const pose={mode,frame,facing,phase:.5};
    const without=raster({...DEFAULT_CREW[0],glasses,headphones:false},pose);
    const withHeadphones=raster({...DEFAULT_CREW[0],glasses,headphones:true},pose);
    const bob=(mode==='dig'&&frame===2)||(mode==='walk'&&frame%2)?1:0;
    assert.deepEqual(withHeadphones.pixels.slice(0,(15+bob)*40),without.pixels.slice(0,(15+bob)*40));
    assert.ok(withHeadphones.pixels.slice((15+bob)*40).includes('#8ca9a5'),'ear cups still show below the hat');
  }
});
