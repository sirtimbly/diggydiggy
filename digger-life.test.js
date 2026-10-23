import test from 'node:test';
import assert from 'node:assert/strict';
import { createDiggerLife, sampleDigger } from './digger-life.js';

test('workers have independent phases and alternate work with short ambient activities',()=>{
  const workers=[1,42,777,9001].map(seed=>createDiggerLife(seed,45));
  assert.ok(new Set(workers.map(life=>sampleDigger(life,0,{min:0,max:100}).frame)).size>1,'pickaxes do not all strike together');
  for(const life of workers){
    const modes=new Set();let walkingPositions=new Set();
    for(let now=0;now<180000;now+=100){
      const pose=sampleDigger(life,now,{min:0,max:100});modes.add(pose.mode);
      assert.ok(pose.x>=0&&pose.x<=100);
      if(pose.mode==='walk')walkingPositions.add(Math.round(pose.x));
      else if(pose.mode!=='dig')assert.ok(life.duration>=2800&&life.duration<=5400,'breaks last a few seconds');
    }
    assert.deepEqual([...modes].sort(),['coffee','dig','phone','walk']);assert.ok(walkingPositions.size>10);
  }
});

test('walking reacts safely to resized ledges and never leaves its personal bounds',()=>{
  const life=createDiggerLife(777,50);
  for(let now=0;now<60000;now+=80){
    const bounds=now<20000?{min:0,max:100}:now<40000?{min:40,max:60}:{min:10,max:10};
    const pose=sampleDigger(life,now,bounds);
    assert.ok(pose.x>=bounds.min&&pose.x<=bounds.max);
  }
  assert.equal(sampleDigger(life,60000,{min:10,max:10}).x,10);
});

test('sampling a seeded timeline is stable across renders and tab time gaps',()=>{
  const a=createDiggerLife(56,30),b=createDiggerLife(56,30),bounds={min:0,max:100};
  for(let now=0;now<=120000;now+=100)sampleDigger(a,now,bounds);
  const actual=sampleDigger(a,120000,bounds),jump=sampleDigger(b,120000,bounds);
  assert.deepEqual(actual,jump,'render frequency does not change the activity sequence');
});
