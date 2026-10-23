// Stable lightning-like trees. Every new fork starts from an already-grown
// parent tip, so progress advances cracks inward rather than thickening a mesh.
export function fractureField(width,height,seed=1){
  let value=seed>>>0;
  const random=()=>((value=(value*1664525+1013904223)>>>0)/4294967296);
  const clamp=(v,max)=>Math.max(0,Math.min(max-1,Math.round(v)));
  const edges=[];
  function grow(start,target,birth,finish,depth,root){
    const dx=target.x-start.x,dy=target.y-start.y,length=Math.hypot(dx,dy);
    if(length<5)return;
    const steps=Math.max(3,Math.ceil(length/10)),nx=-dy/length,ny=dx/length;
    let previous=start;
    for(let i=1;i<=steps;i++){
      const t=i/steps,jitter=(random()-.5)*Math.min(18,length*.2)*Math.sin(Math.PI*t);
      const tip={x:clamp(start.x+dx*t+nx*jitter,width),y:clamp(start.y+dy*t+ny*jitter,height)};
      const at=birth+(finish-birth)*(i-1)/steps,end=birth+(finish-birth)*t;
      if(tip.x!==previous.x||tip.y!==previous.y)edges.push({a:previous,b:tip,at,end,depth,root});
      // The trunk continues past each split. Finer forks are shorter and later.
      const fork=depth===0 ? i===Math.floor(steps*.35)||i===Math.floor(steps*.68) : depth===1&&i===Math.floor(steps*.55)&&random()<.7;
      if(fork&&end<.94){
        const angle=Math.atan2(dy,dx)+(i%2?1:-1)*(.55+random()*.65);
        const reach=length*(depth===0?.28+random()*.2:.35);
        const to={x:clamp(tip.x+Math.cos(angle)*reach,width),y:clamp(tip.y+Math.sin(angle)*reach,height)};
        grow(tip,to,end,Math.min(1,end+(1-end)*(.65+random()*.3)),depth+1,root);
      }
      previous=tip;
    }
  }
  const roots=[
    {x:width*(.18+random()*.18),y:0},
    {x:width-1,y:height*(.3+random()*.3)},
    {x:width*(.55+random()*.25),y:height-1},
    {x:0,y:height*(.35+random()*.4)}
  ];
  if(width>320)roots.push({x:width*(.68+random()*.15),y:0},{x:width*(.15+random()*.18),y:height-1});
  if(height>320)roots.push({x:0,y:height*.2},{x:width-1,y:height*.8});
  roots.forEach((point,root)=>{
    const start={x:clamp(point.x,width),y:clamp(point.y,height)};
    const target={x:width*(.35+random()*.3),y:height*(.35+random()*.3)};
    grow(start,target,root*.025,.8+random()*.13,0,root);
  });
  return edges;
}

export function visibleFractures(field,progress){
  const amount=Math.max(0,Math.min(1,progress/100));
  return field.filter(e=>amount>e.at).map(e=>{
    const t=Math.min(1,(amount-e.at)/(e.end-e.at));
    return {...e,b:{x:e.a.x+(e.b.x-e.a.x)*t,y:e.a.y+(e.b.y-e.a.y)*t}};
  });
}
