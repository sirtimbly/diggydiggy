// Prefer a short elbow; take a side channel when intervening work would hide it.
export function routeDependency(start,end,obstacles) {
  const blocked=points=>points.slice(1).some((b,i)=>{
    const a=points[i];return obstacles.some(r=>a.x===b.x
      ?a.x>r.x-6&&a.x<r.x+r.width+6&&Math.max(a.y,b.y)>r.y-6&&Math.min(a.y,b.y)<r.y+r.height+6
      :a.y>r.y-6&&a.y<r.y+r.height+6&&Math.max(a.x,b.x)>r.x-6&&Math.min(a.x,b.x)<r.x+r.width+6);
  });
  const middle=(start.y+end.y)/2;
  const direct=[start,{x:start.x,y:middle},{x:end.x,y:middle},end];
  if(!blocked(direct))return direct;
  const channels=[...new Set([start.x,end.x,...obstacles.flatMap(r=>[r.x-12,r.x+r.width+12])])];
  let best=null,bestLength=Infinity;
  for(const x of channels){
    const points=[start,{x:start.x,y:start.y+8},{x,y:start.y+8},{x,y:end.y-8},{x:end.x,y:end.y-8},end];
    if(blocked(points))continue;
    const length=points.slice(1).reduce((sum,p,i)=>sum+Math.abs(p.x-points[i].x)+Math.abs(p.y-points[i].y),0);
    if(length<bestLength){best=points;bestLength=length;}
  }
  return best??direct;
}
