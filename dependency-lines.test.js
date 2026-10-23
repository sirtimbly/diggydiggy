import test from 'node:test';
import assert from 'node:assert/strict';
import {routeDependency} from './dependency-lines.js';
test('dependency line takes a clear side channel around intervening work',()=>{
  const start={x:250,y:100},end={x:250,y:500},obstacle={x:160,y:200,width:180,height:160};
  const points=routeDependency(start,end,[obstacle]);
  assert.deepEqual(points[0],start);assert.deepEqual(points.at(-1),end);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];assert.ok(a.x===b.x||a.y===b.y,'links stay orthogonal');
    if(a.x===b.x&&a.x>obstacle.x&&a.x<obstacle.x+obstacle.width)assert.ok(Math.max(a.y,b.y)<=obstacle.y||Math.min(a.y,b.y)>=obstacle.y+obstacle.height,'vertical segments remain outside the block');
    if(a.y===b.y&&a.y>obstacle.y&&a.y<obstacle.y+obstacle.height)assert.ok(Math.max(a.x,b.x)<=obstacle.x||Math.min(a.x,b.x)>=obstacle.x+obstacle.width,'horizontal segments remain outside the block');
  }
});
