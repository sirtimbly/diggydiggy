// Ambient activity has its own clock and never touches task progress or saves.
export function createDiggerLife(seed,x,now=0){
  let value=seed>>>0;
  const random=()=>((value=(value*1664525+1013904223)>>>0)/4294967296);
  return {random,mode:'dig',since:now,duration:7000+random()*10000,tempo:155+random()*80,
    phase:random()*1500,x,from:x,target:x,facing:random()<.5?-1:1,lastBreak:null};
}
export function sampleDigger(life,now,bounds){
  const clamp=x=>Math.max(bounds.min,Math.min(bounds.max,x));
  life.x=clamp(life.x);life.from=clamp(life.from);life.target=clamp(life.target);
  let count=0;
  while(now>=life.since+life.duration&&count++<64){
    life.since+=life.duration;
    if(life.mode==='walk')life.x=life.target;
    if(life.mode!=='dig'){
      life.mode='dig';life.duration=11000+life.random()*15000;
    }else{
      const choices=['coffee','phone','walk'].filter(mode=>mode!==life.lastBreak);
      life.mode=choices[Math.floor(life.random()*choices.length)];
      if(life.mode==='walk'){
        const reach=18+life.random()*36,direction=life.random()<.5?-1:1;
        let target=clamp(life.x+reach*direction);
        if(Math.abs(target-life.x)<8)target=clamp(life.x-reach*direction);
        if(Math.abs(target-life.x)<8)life.mode='coffee';
        else {life.from=life.x;life.target=target;life.facing=target>life.x?1:-1;life.duration=Math.abs(target-life.x)/(15+life.random()*7)*1000;}
      }
      if(life.mode!=='walk')life.duration=life.mode==='coffee'?2800+life.random()*1600:3200+life.random()*2200;
      life.lastBreak=life.mode;
    }
  }
  if(count>64)life.since=now;
  const elapsed=Math.max(0,now-life.since),phase=Math.min(1,elapsed/life.duration);
  if(life.mode==='walk')life.x=life.from+(life.target-life.from)*phase;
  return {mode:life.mode,x:clamp(life.x),facing:life.facing,phase,frame:Math.floor((elapsed+life.phase)/(life.mode==='dig'?life.tempo:180))%4};
}
