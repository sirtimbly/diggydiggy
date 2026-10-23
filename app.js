import { MASONRY, SIZES, RESIZE_LIMITS, blockDimensions, applyMasonry, previewMove, previewResize, excavationRects, dependenciesOf, dependencyOrder, canAddDependency } from './masonry.js';
import { routeDependency } from './dependency-lines.js';
import { installCanvasPanning } from './canvas-pan.js';
import { fractureField, visibleFractures } from './fractures.js';
import { createDiggerLife, sampleDigger } from './digger-life.js';

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const WORLD = { left: 0, right: 900, width: 900, height: 1160 };
const STORAGE = 'diggy-project-v1';
const PALETTE = {
  amber: { fill: '#ddb472', shade: '#a07f4b', name: 'Amber' },
  moss: { fill: '#a7bc83', shade: '#788e5c', name: 'Moss' },
  lilac: { fill: '#b4a6cf', shade: '#857598', name: 'Lilac' },
  coral: { fill: '#d9957d', shade: '#9e6959', name: 'Coral' },
  blue: { fill: '#8eb7c3', shade: '#5f8999', name: 'Blue' }
};
const PEOPLE = [
  { id: 'maya', name: 'Maya', color: '#deb969', shirt: '#a76a50', skin: '#d9a17b' },
  { id: 'theo', name: 'Theo', color: '#a5b99a', shirt: '#678e8a', skin: '#b87e5b' },
  { id: 'jun', name: 'Jun', color: '#bbb0d2', shirt: '#8a77ac', skin: '#e3bd91' },
  { id: 'sam', name: 'Sam', color: '#d49d89', shirt: '#b48166', skin: '#9a684a' }
];
function demo() {
  return { version: 1, selected: 'b1', blocks: [
    { id: 'b1', code: 'DIG-01', title: 'Authentication', note: 'A welcoming front door. Sign in, stay signed in, and find your way back when you forget.', x: 87, y: 206, size: 'medium', color: 'amber', uncertainty: 24, progress: 55, people: ['maya', 'theo'], dependency: '', done: false },
    { id: 'b2', code: 'DIG-02', title: 'Component library', note: 'The shared building blocks. Buttons, inputs, and all the little details that make things feel like us.', x: 493, y: 186, size: 'large', color: 'moss', uncertainty: 16, progress: 20, people: ['jun'], dependency: '', done: false },
    { id: 'b3', code: 'DIG-03', title: 'Permissions & roles', note: 'Who gets to do what? We know the basics, but the edge cases are still buried.', x: 138, y: 432, size: 'medium', color: 'lilac', uncertainty: 32, progress: 0, people: [], dependency: 'b1', done: false },
    { id: 'b4', code: 'DIG-04', title: 'Search that feels right', note: 'Find the right thing, even when you do not quite know what you are looking for.', x: 535, y: 450, size: 'medium', color: 'blue', uncertainty: 40, progress: 10, people: ['sam'], dependency: '', done: false },
    { id: 'b5', code: 'DIG-05', title: 'Bring your data', note: 'Import the things people already have. Formats and messy data could make this bigger than it looks.', x: 83, y: 675, size: 'large', color: 'coral', uncertainty: 36, progress: 0, people: [], dependency: '', done: false },
    { id: 'b6', code: 'DIG-06', title: 'Make it accessible', note: 'Keyboard journeys, readable contrast, and useful screen reader feedback. Dig through the whole experience.', x: 515, y: 691, size: 'medium', color: 'amber', uncertainty: 20, progress: 0, people: [], dependency: 'b2', done: false },
    { id: 'b7', code: 'DIG-07', title: 'The little details', note: 'The small things we will notice once the larger pieces fit together.', x: 225, y: 887, size: 'small', color: 'moss', uncertainty: 12, progress: 0, people: [], dependency: '', done: false },
    { id: 'b8', code: 'DIG-08', title: 'A faster first load', note: 'A lighter pack for the journey in. We will know more once the core experience is built.', x: 596, y: 896, size: 'small', color: 'lilac', uncertainty: 28, progress: 0, people: [], dependency: '', done: false }
  ] };
}
function validProject(p) {
  if (!p || p.version !== 1 || !Array.isArray(p.blocks) || p.blocks.length > 100) return false;
  const ids = new Set();
  for (const b of p.blocks) {
    if (!b || typeof b.id !== 'string' || ids.has(b.id) || typeof b.title !== 'string' || typeof b.note !== 'string' || typeof b.code !== 'string' || !SIZES[b.size] || !PALETTE[b.color]) return false;
    if (![b.x, b.y, b.progress, b.uncertainty].every(Number.isFinite) || b.progress < 0 || b.progress > 100 || b.uncertainty < 0 || b.uncertainty > 48 || !Array.isArray(b.people) || !b.people.every(id => PEOPLE.some(p => p.id === id))) return false;
    if (typeof b.done !== 'boolean' || typeof b.dependency !== 'string') return false;
    if(b.dependencies!==undefined&&(!Array.isArray(b.dependencies)||!b.dependencies.every(id=>typeof id==='string')))return false;
    ids.add(b.id);
  }
  if(p.excavations && (!Array.isArray(p.excavations) || !p.excavations.every(r => [r.x,r.y,r.width,r.height].every(Number.isFinite) && r.width>0 && r.y>=MASONRY.surface && r.height>0))) return false;
  for(const b of p.blocks){
    if(!Number.isInteger(b.pinnedColumn))delete b.pinnedColumn;
    if(b.pinnedX!==undefined&&!Number.isFinite(b.pinnedX))delete b.pinnedX;
    if(b.width!==undefined&&(!Number.isFinite(b.width)||b.width<RESIZE_LIMITS.minWidth||b.width>RESIZE_LIMITS.maxWidth))return false;
    if(b.height!==undefined&&(!Number.isFinite(b.height)||b.height<RESIZE_LIMITS.minHeight||b.height>RESIZE_LIMITS.maxHeight))return false;
  }
  try{dependencyOrder(p.blocks);}catch{return false;}
  return PEOPLE.every(person => p.blocks.filter(b => !b.done && b.people.includes(person.id)).length <= 2);
}
let state;
let storageAvailable = true;
try { const saved = JSON.parse(localStorage.getItem(STORAGE)); state = validProject(saved) ? saved : demo(); } catch { state = demo(); }
let selectedDigger = null;
let pendingLink = null;
let currentLayout=null;
let mode = 'inspect';
let zoom = 1;
let drag = null;
let toastTimer;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 1.8-2.5 3.5M12 17h.01"/>',
  move: '<path d="M12 3v18M3 12h18m-6-6-3-3-3 3m6 12-3 3-3-3M6 9l-3 3 3 3m12-6 3 3-3 3"/>',
  fit: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z"/>',
  down: '<path d="M12 3v18m-5-5 5 5 5-5"/>',
  pick: '<path d="m5 20 9-12m-6-5c5-1 10 2 12 8l-5-3-5-1-4-2z"/>',
  link: '<path d="M7 4v6a4 4 0 0 0 4 4h6m-4-4 4 4-4 4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  undo: '<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 7 7"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
  rock: '<path d="m5 4 12-1 5 9-5 9H6l-4-9zM5 4l7 8 5-9M2 12h10l5 9m-5-9 10 0"/>'
};
function icon(name) { return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.rock}</svg>`; }
$$('[data-icon]').forEach(el => el.innerHTML = icon(el.dataset.icon));
$('#help-button').innerHTML = icon('help'); $('#zoom-out').innerHTML = icon('minus'); $('#zoom-in').innerHTML = icon('plus'); $('#fit-view').innerHTML = icon('fit');
function escapeHTML(v) { return String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); storageAvailable = true; }
  catch { storageAvailable = false; }
  $('.local-label').innerHTML = `<span class="status-dot"></span>${storageAvailable ? 'Saved on this device' : 'Session only — storage unavailable'}`;
}
function notify(message) { const el = $('#toast'); el.textContent = message; el.classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('visible'), 3500); }
function getBlock(id) { return state.blocks.find(b => b.id === id); }
function waitingDependencies(b){return dependenciesOf(b).filter(id=>state.blocks.some(a=>a.id===id&&!a.done));}
function isBlocked(b) { return waitingDependencies(b).length>0||currentLayout?.access.get(b.id)?.reachable===false; }
function blockedReason(b){return waitingDependencies(b).length?'Another block comes first.':'Clear the stone above to reach this surface.';}
function placedDiggers(b,layout=currentLayout){
  if(waitingDependencies(b).length||!layout?.access.get(b.id)?.reachable)return [];
  const spots=[];
  for(const [index,r] of layout.access.get(b.id).ranges.entries())for(let x=r.x;x+32<=r.x+r.width;x+=40)spots.push({x:x-layout.placements.get(b.id).x,range:index,min:r.x-layout.placements.get(b.id).x,max:r.x+r.width-32-layout.placements.get(b.id).x});
  const count=Math.min(b.people.length,spots.length);
  const selected=Array.from({length:count},(_,i)=>spots[Math.min(spots.length-1,Math.floor((i+.5)*spots.length/count))]);
  return selected.map((spot,i)=>{
    const before=selected[i-1],after=selected[i+1];
    const min=before?.range===spot.range?(before.x+spot.x)/2+20:spot.min;
    const max=after?.range===spot.range?(after.x+spot.x)/2-20:spot.max;
    return {id:b.people[i],x:Math.max(min,Math.min(max,spot.x)),min,max};
  });
}
function setDependencies(block,ids){block.dependencies=[...new Set(ids)];block.dependency=block.dependencies[0]??'';}
function addDependency(sourceId,targetId){
  const result=canAddDependency(state.blocks,sourceId,targetId);pendingLink=null;
  if(!result.ok){notify(result.reason);drawDependencies();return false;}
  const b=getBlock(targetId);setDependencies(b,[...dependenciesOf(b),sourceId]);state.selected=b.id;mode='inspect';render();save();
  notify(`${getBlock(sourceId).title} comes before ${b.title}.`);return true;
}
function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
function hash(s) { return [...s].reduce((n, c) => ((n << 5) - n + c.charCodeAt(0)) | 0, 0) >>> 0; }

function syncWorldBounds(layout, growOnly=false) {
  const view=$('#pit-viewport'),oldLeft=WORLD.left;
  WORLD.left=growOnly?Math.min(WORLD.left,layout.left):layout.left;
  WORLD.right=growOnly?Math.max(WORLD.right,layout.right):layout.right;
  WORLD.width=WORLD.right-WORLD.left;WORLD.height=growOnly?Math.max(WORLD.height,layout.height??WORLD.height):layout.height;
  Object.assign($('#pit-world').style,{width:`${WORLD.width}px`,height:`${WORLD.height}px`});
  const shift=oldLeft-WORLD.left;
  if(shift){
    $$('.task-block,.excavated-label,#placement-preview,.effect-canvas').forEach(node=>{node.style.left=`${parseFloat(node.style.left)+shift}px`;});
    view.scrollLeft+=shift*zoom;
  }
  $('.surface-sign').style.left=`${(innerWidth<=680?45:58)-WORLD.left}px`;
  $$('.depth-label').forEach(node=>node.style.left=`${15-WORLD.left}px`);
  Object.assign($('.undiscovered').style,{left:`${280-WORLD.left}px`,top:`${WORLD.height-126}px`});
}
let terrainPending=false;
function scheduleTerrain(){if(terrainPending)return;terrainPending=true;requestAnimationFrame(()=>{terrainPending=false;drawTerrain();});}

// The scene is deliberately made from integer rectangles: no sprite package or build step.
function drawTerrain() {
  const view=$('#pit-viewport'),canvas=$('#terrain');
  const x=Math.max(0,Math.floor(view.scrollLeft/zoom/128)*128-128),y=Math.max(0,Math.floor(view.scrollTop/zoom/128)*128-128);
  const width=Math.max(1,Math.min(WORLD.width-x,Math.ceil(view.clientWidth/zoom)+384));
  const height=Math.max(1,Math.min(WORLD.height-y,Math.ceil(view.clientHeight/zoom)+384));
  canvas.width=width;canvas.height=height;Object.assign(canvas.style,{inset:'auto',left:`${x}px`,top:`${y}px`,width:`${width}px`,height:`${height}px`});
  const paint={left:WORLD.left+x,top:y,right:WORLD.left+x+width,bottom:y+height,width,height};
  const c = canvas.getContext('2d'); const random = rng(84);
  c.translate(-paint.left,-paint.top);
  c.fillStyle = '#332d2b'; c.fillRect(paint.left,paint.top,width,height);
  c.fillStyle = '#3e332d'; c.fillRect(paint.left, 110, width, 210);
  c.fillStyle = '#382f2a'; c.fillRect(paint.left, 320, width, 320);
  c.fillStyle = '#302c2c'; c.fillRect(paint.left, 640, width, WORLD.height-640);
  for (let y = Math.max(115,Math.floor(paint.top/16)*16+3); y < paint.bottom; y += 16) for (let x = Math.floor(paint.left/16)*16; x < paint.right; x += 16) {
    const random=rng(hash(`${x}:${y}`));
    const v = random(); c.fillStyle = v < .15 ? '#534236' : v < .32 ? '#473a32' : v < .6 ? '#2f2927' : '#3b312b';
    c.globalAlpha = y > 650 ? .4 : .55;
    if (v < .52) c.fillRect(x + (y % 32 ? 8 : 0), y, 12 + Math.floor(random() * 10), 4 + Math.floor(random() * 8));
  }
  c.globalAlpha = 1;
  for (let i = 0; i < 95; i++) {
    const x = Math.floor(random() * 225) * 4, y = 130 + Math.floor(random() * 230) * 4;
    c.fillStyle = '#605044'; c.fillRect(x, y, 8, 4); c.fillStyle = '#241f22'; c.fillRect(x + 4, y + 4, 8, 4);
  }
  c.fillStyle = '#78825b'; c.fillRect(paint.left, 0, width, 100);
  c.fillStyle = '#677650';
  for (let x = Math.floor(paint.left/20)*20; x < paint.right; x += 20) { const random=rng(hash(`hill:${x}`));const h = 12 + Math.floor(random() * 30 / 4) * 4; c.fillRect(x, 100 - h, 24, h); }
  c.fillStyle = '#536a42'; c.fillRect(paint.left, 88, width, 16);
  for (let x = Math.floor(paint.left/8)*8; x < paint.right; x += 8) {
    const random=rng(hash(`grass:${x}`));
    c.fillStyle = random() > .5 ? '#8d9d5b' : '#a0ab68'; c.fillRect(x, 88 + (random() > .5 ? -4 : 0), 8, 8);
    c.fillStyle = '#70854b'; c.fillRect(x, 96, 8, 4 + Math.floor(random() * 4) * 4);
    if (random() > .8) { c.fillStyle = '#a4b46c'; c.fillRect(x, 76, 4, 12); }
  }
  // A small timber sign, grass tufts, fence, and the forgotten shovel at the surface.
  c.fillStyle = '#514b34'; c.fillRect(44, 17, 242, 54); c.fillRect(60, 65, 8, 25); c.fillRect(257, 65, 8, 25);
  c.fillStyle = '#9c9970'; c.fillRect(44, 17, 242, 3); c.fillRect(44, 17, 3, 54);
  c.fillStyle = '#525f3d'; for (let x = 620; x < 880; x += 58) { c.fillRect(x, 58, 6, 31); } c.fillRect(620, 66, 238, 5); c.fillRect(620, 79, 238, 4);
  pixelLine(c, 420, 47, 438, 83, '#b6a077', 4); c.fillStyle = '#a9afa0'; c.fillRect(431, 76, 12, 9); c.fillRect(435, 84, 8, 4);
  for (let i = 0; i < 25; i++) { const x = Math.floor(random() * 215) * 4, y = Math.floor(random() * 16) * 4; c.fillStyle = '#8c9567'; c.fillRect(x, y, 4, 4); }
  // Embedded mineral seams remain subdued so work blocks carry the color.
  for (const [x,y,color] of [[35,530,'#8d784d'],[840,365,'#76836b'],[437,805,'#82708c'],[50,980,'#7b6858'],[820,1020,'#688188']]) {
    c.globalAlpha = .7; for (let i = 0; i < 7; i++) { c.fillStyle = color; c.fillRect(x + Math.floor(random() * 10) * 4, y + Math.floor(random() * 7) * 4, 4, 4); } c.globalAlpha = 1;
  }
  drawGeology(c,paint);
  drawDependencies();
}
function drawDependencies(){
  const root=$('#dependency-lines');if(!root)return;
  const canvas=$('#terrain'),x=parseFloat(canvas.style.left)||0,y=parseFloat(canvas.style.top)||0,w=canvas.width,h=canvas.height;
  Object.assign(root.style,{left:`${x}px`,top:`${y}px`,width:`${w}px`,height:`${h}px`});root.setAttribute('viewBox',`${WORLD.left+x} ${y} ${w} ${h}`);
  function anchor(id,end){
    const node=$(`[data-block="${CSS.escape(id)}"]`);
    if(node)return {x:node.offsetLeft+WORLD.left+node.offsetWidth-20,y:node.offsetTop+(end?node.offsetHeight-20:20)};
    const hole=state.excavations?.find(h=>h.blockId===id);return hole?{x:hole.x+hole.width*.75,y:hole.y+(end?hole.height:0)}:null;
  }
  function path(a,b,sourceId,targetId){
    const obstacles=$$('.task-block').filter(n=>n.dataset.block!==sourceId&&n.dataset.block!==targetId).map(n=>({x:n.offsetLeft+WORLD.left,y:n.offsetTop,width:n.offsetWidth,height:n.offsetHeight}));
    const points=routeDependency(a,b,sourceId?obstacles:[]);return points.map((p,i)=>`${i?'L':'M'} ${p.x} ${p.y}`).join(' ');
  }
  const markers={normal:'#bdc9a2',active:'#f1e6ab',invalid:'#e69d84'};
  let paths='<defs>'+Object.entries(markers).map(([name,color])=>`<marker id="dependency-arrow-${name}" viewBox="0 0 10 10" refX="6" refY="5" markerUnits="userSpaceOnUse" markerWidth="9" markerHeight="9" orient="auto"><path d="M 3 2 L 6 5 L 3 8" fill="none" stroke="#1d2523" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M 3 2 L 6 5 L 3 8" fill="none" stroke="${color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></marker>`).join('')+'</defs>';
  for(const b of state.blocks.filter(b=>!b.done))for(const id of dependenciesOf(b)){
    const a=anchor(id,true),end=anchor(b.id,false);if(!a||!end)continue;
    const d=path(a,end,id,b.id),active=state.selected===b.id||state.selected===id;
    paths+=`<path class="dependency-shadow" d="${d}"/><path class="dependency-line ${active?'is-active':''}" d="${d}" marker-end="url(#dependency-arrow-${active?'active':'normal'})" data-from="${escapeHTML(id)}" data-to="${escapeHTML(b.id)}"><title>${escapeHTML(getBlock(id)?.title??'Cleared work')} must precede ${escapeHTML(b.title)}</title></path>`;
  }
  const sourceId=drag?.kind==='link'?drag.id:pendingLink,source=sourceId?anchor(sourceId,true):null;
  if(source){
    const pointer=drag?.kind==='link'?drag.lastPointer:null;
    if(pointer){const r=$('#pit-world').getBoundingClientRect(),end={x:(pointer.clientX-r.left)/zoom+WORLD.left,y:(pointer.clientY-r.top)/zoom};paths+=`<path class="dependency-draft ${drag.invalidTarget?'is-invalid':''}" d="${path(source,end)}" marker-end="url(#dependency-arrow-${drag.invalidTarget?'invalid':'active'})"/>`;}
    else paths+=`<circle cx="${source.x}" cy="${source.y}" r="9" fill="none" stroke="#f6e8a6" stroke-width="2"/>`;
  }
  root.innerHTML=paths;
  $$('.dependency-port').forEach(p=>p.classList.toggle('is-link-source',p.dataset.linkOut===pendingLink));
}
function drawGeology(c,paint) {
  const rectangles=excavationRects((drag?.preview??currentLayout)?.placements??new Map(),state.excavations);
  // One clipped union keeps shafts and extracted cavities visually connected.
  c.save();c.beginPath();
  for(const r of rectangles)c.rect(r.x,r.y,r.width,r.height);
  c.clip();
  const unit=4,cells=new Set();
  for(const r of rectangles){
    const startX=Math.floor(Math.max(r.x,paint.left-unit)/unit)*unit,endX=Math.min(r.x+r.width,paint.right+unit);
    const startY=Math.floor(Math.max(r.y,paint.top-unit)/unit)*unit,endY=Math.min(r.y+r.height,paint.bottom+unit);
    for(let y=startY;y<endY;y+=unit)for(let x=startX;x<endX;x+=unit)cells.add(`${x},${y}`);
  }
  for(const cell of cells){
    const [x,y]=cell.split(',').map(Number);
    c.fillStyle='#1d2221';c.fillRect(x,y,unit,unit);
    // Only union boundaries get a rim. Adjacent removed blocks form a single hole.
    if(!cells.has(`${x-unit},${y}`)){c.fillStyle='#151a1a';c.fillRect(x,y,2,unit);}
    if(!cells.has(`${x+unit},${y}`)){c.fillStyle='#72604a';c.fillRect(x+unit-2,y,2,unit);}
    if(!cells.has(`${x},${y+unit}`)){c.fillStyle='#8c7452';c.fillRect(x,y+unit-2,unit,2);}
    if(!cells.has(`${x},${y-unit}`)&&y>96){c.fillStyle='#111818';c.fillRect(x,y,unit,2);}
  }
  c.restore();
}
function pixelLine(c, x1, y1, x2, y2, color, pixel = 2) {
  c.fillStyle = color; const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let i = 0; i <= steps; i += pixel) { const p = steps ? i / steps : 0; c.fillRect(Math.round((x1 + (x2 - x1) * p) / pixel) * pixel, Math.round((y1 + (y2 - y1) * p) / pixel) * pixel, pixel, pixel); }
}
function drawSprite(canvas, person, pose = {mode:'idle',frame:0,facing:1,phase:0}) {
  const {mode,frame,facing,phase}=pose,c=canvas.getContext('2d');c.clearRect(0,0,32,40);c.save();
  if(facing<0){c.translate(32,0);c.scale(-1,1);}
  const bob=(mode==='dig'&&frame===2)||(mode==='walk'&&frame%2)?1:0;
  const rows=[
    '     hhhhh      ', '    hhhhhhh     ', '   hhhhhhhhh    ', '   hhhlhhhhh    ',
    '  hhhhhhhhhhh   ', '    ssssdd      ', '    ssssd       ', '    ssesd       ',
    '     ssss       ', '    tttttt      ', '   tttttttt     ', '   stttttts     ',
    '   stttttts     ', '    tttttt      ', '    pppppp      ', '    pp  pp      ',
    '    pp  pp      ', '   bbb  bbb     '
  ];
  const colors={h:person.color,l:'#f7e6a0',s:person.skin,d:'#714f3e',e:'#2a2e2b',t:person.shirt,p:'#3c4244',b:'#292b2b'};
  rows.forEach((row,y)=>[...row].forEach((v,x)=>{if(colors[v]&&!(mode==='walk'&&y>=14)){c.fillStyle=colors[v];c.fillRect(x*2,y*2+3+(y<14?bob:0),2,2);}}));
  if(mode==='walk'){
    const stride=[-3,0,3,0][frame];
    pixelLine(c,12,30,12+stride,36,'#3c4244',3);pixelLine(c,19,30,19-stride,36,'#3c4244',3);
    c.fillStyle='#292b2b';c.fillRect(10+stride,37,6,3);c.fillRect(17-stride,37,6,3);
    pixelLine(c,24,24+bob,25-stride,29,person.skin,2);
  }else if(mode==='dig'){
    const poses=[[23,13,29,5],[24,14,30,9],[24,23,31,28],[24,20,31,24]];
    const [x,y,ex,ey]=poses[frame];
    pixelLine(c,22,24+bob,ex,ey,'#c3a373',2);pixelLine(c,ex-5,ey-2,ex+3,ey+2,'#bec3b3',2);
    c.fillStyle=person.skin;c.fillRect(x-2,y+4,4,4);
    if(frame===2){c.fillStyle='#e9cb86';c.fillRect(29,33,2,2);c.fillRect(25,36,2,2);}
  }else if(mode==='coffee'){
    const y=26-Math.round(Math.sin(phase*Math.PI)*8);
    pixelLine(c,24,26,26,y+4,person.skin,3);
    c.fillStyle='#ece0b5';c.fillRect(25,y,5,6);c.fillRect(30,y+1,2,4);
    c.fillStyle='#765141';c.fillRect(26,y,3,1);
    c.fillStyle='#d6d5bd';c.fillRect(27+(frame%2),y-5,1,2);c.fillRect(26,y-8-(frame%2),1,2);
  }else if(mode==='phone'){
    pixelLine(c,24,26,27,29,person.skin,3);
    c.fillStyle='#202a2e';c.fillRect(25,23,6,10);
    c.fillStyle='#9ab8b6';c.fillRect(26,24,4,6);
    c.fillStyle='#d5dfc8';c.fillRect(27,25+frame%3,2,1);
    c.fillStyle=person.skin;c.fillRect(24,28+frame%2,3,2);
  }
  c.restore();
}
function spriteMarkup(person,working=false){return `<canvas class="crew-sprite" width="32" height="40" data-person="${person.id}" data-working="${working}" aria-hidden="true"></canvas>`;}
let spriteCache=[];
const diggerLives=new Map(),spriteEntries=new WeakMap(),activityNames={dig:'digging',walk:'finding a new spot',coffee:'coffee break',phone:'checking phone',idle:'ready'};
function paintWorker(s,time){
  const button=s.canvas.closest('.block-digger');
  const lifeKey=button?`${s.person.id}:${button.dataset.source}`:null;
  if(s.working&&(!s.visible||document.hidden)){
    const life=diggerLives.get(lifeKey);if(life&&life.pausedAt===undefined)life.pausedAt=time;
    return;
  }
  let pose={mode:'idle',frame:0,facing:1,phase:0};
  if(s.working&&!reducedMotion.matches){
    let life=diggerLives.get(lifeKey);
    if(!life){life=createDiggerLife(hash(lifeKey),s.baseX,time);diggerLives.set(lifeKey,life);}
    if(life.pausedAt!==undefined){life.since+=time-life.pausedAt;delete life.pausedAt;}
    if(drag&&['block','resize','digger'].includes(drag.kind)){pose={mode:'dig',frame:0,facing:life.facing,phase:0};button.style.transform='';}
    else{
      pose=sampleDigger(life,time,{min:+button.dataset.walkMin,max:+button.dataset.walkMax});
      button.style.transform=`translateX(${Math.round(pose.x-s.baseX)}px)`;button.dataset.position=pose.x;
    }
  }
  if(button){
    const activity=activityNames[pose.mode];
    button.dataset.activity=pose.mode;
    const label=$('.digger-label',button);if(label)label.textContent=`${s.person.name} · ${activity}`;
  }
  const key=`${pose.mode}:${pose.frame}:${pose.facing}:${pose.mode==='coffee'?Math.round(pose.phase*20):0}`;
  if(key!==s.drawn){drawSprite(s.canvas,s.person,pose);s.drawn=key;}
}
const spriteVisibility=new IntersectionObserver(entries=>{
  for(const entry of entries){const s=spriteEntries.get(entry.target);if(!s)continue;s.visible=entry.isIntersecting;paintWorker(s,performance.now());}
});
function cacheSprites(){
  const now=performance.now();
  for(const life of diggerLives.values())if(life.pausedAt===undefined)life.pausedAt=now;
  spriteVisibility.disconnect();
  spriteCache=$$('canvas[data-person]').map(canvas=>{
    const s={canvas,person:PEOPLE.find(p=>p.id===canvas.dataset.person),working:canvas.dataset.working==='true',baseX:parseFloat(canvas.closest('.block-digger')?.style.left)||0};
    s.visible=!s.working;spriteEntries.set(canvas,s);if(s.working)spriteVisibility.observe(canvas);return s;
  });
  spriteCache.forEach(s=>paintWorker(s,now));
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)for(const life of diggerLives.values())if(life.pausedAt===undefined)life.pausedAt=performance.now();});
let lastSpriteTime=-1;
function animate(time){
  panWhileDragging(time);
  if(drag?.moved&&['block','resize'].includes(drag.kind))drawDependencies();
  if(time-lastSpriteTime>=70){spriteCache.forEach(s=>paintWorker(s,time));lastSpriteTime=time;}
  requestAnimationFrame(animate);
}
function drawUncertainty(node,block){
  const face=$('.block-surface',node),[w,h]=blockDimensions(block),amount=block.uncertainty/48;
  if(!amount){face.style.maskImage='none';return;}
  const mask=document.createElement('canvas');mask.width=w;mask.height=h;
  const c=mask.getContext('2d'),pixel=4;
  const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
  const end=h-12,start=Math.max(12,end*(1-amount)),fade=Math.min(28,Math.max(4,(end-start)*.35));
  for(let y=0;y<h;y+=pixel){
    // An increasingly long absence between the known beginning and a returning bottom rim.
    const down=Math.max(0,Math.min(1,1-(y-start)/fade));
    const up=Math.max(0,Math.min(1,(y-(h-12))/8));
    const coverage=Math.max(down,up);
    for(let x=0;x<w;x+=pixel)if(coverage>(bayer[(y/pixel%4)*4+x/pixel%4]+.5)/16)c.fillRect(x,y,pixel,pixel);
  }
  face.style.maskImage=`url("${mask.toDataURL()}")`;
}
const crackFields=new Map();
function drawCracks(canvas, block) {
  const [w,h]=blockDimensions(block);canvas.width=w;canvas.height=h;
  if(block.progress<1)return;
  let field=crackFields.get(block.id);
  if(!field||field.w!==w||field.h!==h){field={w,h,edges:fractureField(w,h,hash(block.id)+6)};crackFields.set(block.id,field);}
  const c=canvas.getContext('2d');
  for(const {a,b,depth} of visibleFractures(field.edges,block.progress)){
    c.globalAlpha=depth===0?.9:.65;
    pixelLine(c,a.x+1,a.y+1,b.x+1,b.y+1,'#f6dfb766',1);
    pixelLine(c,a.x,a.y,b.x,b.y,'#403129',depth===0?2:1);
  }
}
function renderCrew() {
  $('#crew-list').innerHTML = PEOPLE.map(p => {
    const tasks = state.blocks.filter(b => !b.done && b.people.includes(p.id));
    const focus = tasks.length ? tasks.map(b => b.title).join(' + ') : 'Ready for a new dig';
    return `<div class="crew-person"><button class="crew-button ${selectedDigger === p.id ? 'selected-digger' : ''}" data-digger="${p.id}" aria-pressed="${selectedDigger === p.id}" aria-label="Assign ${p.name}. ${tasks.length} of 2 work sites. ${escapeHTML(focus)}">${spriteMarkup(p)}<span class="crew-copy"><span class="crew-name">${p.name}</span><span class="crew-focus" title="${escapeHTML(focus)}">${escapeHTML(focus)}</span></span></button><i class="crew-color" style="background:${p.shirt}"></i></div>`;
  }).join('');
  const active = PEOPLE.filter(p => state.blocks.some(b => !b.done && !isBlocked(b) && b.people.includes(p.id))).length;
  $('#active-count').textContent = active;
  const done = state.blocks.filter(b => b.done);
  $('#cleared-count').textContent = done.length;
  $('#cleared-list').innerHTML = done.length ? done.map(b => `<button class="cleared-entry" data-cleared="${escapeHTML(b.id)}">${icon('check')}<span>${escapeHTML(b.title)}</span></button>`).join('') : '<p class="cleared-empty">The first breakthrough is ahead.</p>';
}
function renderBoard() {
  const layout=applyMasonry(state);currentLayout=layout;syncWorldBounds(layout,true);
  drawTerrain();
  const layer = $('#task-layer'); layer.replaceChildren();
  for(const hole of state.excavations){
    const b=getBlock(hole.blockId),marker=document.createElement(b?'button':'span');
    marker.className='excavated-label';marker.style.cssText=`left:${hole.x+hole.width/2-WORLD.left}px;top:${hole.y+hole.height/2}px`;
    marker.innerHTML=`${icon('check')}<span>EXCAVATED</span>`;
    if(b){marker.dataset.cleared=b.id;marker.setAttribute('aria-label',`${b.title}, excavated. View cleared block.`);}
    else marker.setAttribute('aria-hidden','true');
    layer.append(marker);
  }
  for (const b of state.blocks.filter(b => !b.done)) {
    const [w,h] = blockDimensions(b);
    const node = document.createElement('div'); node.className = `task-block ${b.uncertainty?'has-unknown':''} ${state.selected === b.id ? 'is-selected' : ''}`;
    node.dataset.block = b.id; node.style.cssText = `left:${b.x-WORLD.left}px;top:${b.y}px;width:${w}px;height:${h}px;--block:${PALETTE[b.color].fill};--shade:${PALETTE[b.color].shade}`;
    const status = isBlocked(b) ? `${icon('lock')}${waitingDependencies(b).length?'Waiting to uncover':'Buried surface'}` : b.people.length ? `${icon('pick')}${b.people.length === 1 ? 'Digging in' : 'Digging together'}` : 'Ready to explore';
    node.innerHTML = `<button class="block-hit" aria-label="${escapeHTML(b.code + ': ' + b.title)}. ${b.progress}% complete. ${Math.round(b.uncertainty/48*100)}% unknown. ${isBlocked(b) ? escapeHTML(waitingDependencies(b).length?'Waiting on '+waitingDependencies(b).map(id=>getBlock(id)?.title??'').join(', '):'Buried beneath overhead work') : 'Ready'}." style="position:absolute;inset:0;background:none;border:0;cursor:inherit;z-index:3"></button><div class="block-decoration"></div><canvas class="crack-canvas" aria-hidden="true"></canvas><div class="task-content"><span class="block-id">${escapeHTML(b.code)}</span><span class="block-name">${escapeHTML(b.title)}</span><span class="block-status">${status}</span></div>${b.progress ? `<span class="block-progress">${b.progress}%</span>` : ''}<div class="block-diggers">${placedDiggers(b).map(({id,x,min,max}) => { const p = PEOPLE.find(p => p.id === id); return `<button class="block-digger" style="left:${x}px" data-walk-min="${min}" data-walk-max="${max}" data-digger="${id}" data-source="${escapeHTML(b.id)}" aria-label="${p.name}, working on ${escapeHTML(b.title)}. Select to assign another work site.">${spriteMarkup(p, !isBlocked(b))}<span class="digger-label">${p.name}</span></button>`; }).join('')}</div>`;
    const edgeNames={n:'top',s:'bottom',e:'right',w:'left',nw:'top left corner',ne:'top right corner',sw:'bottom left corner',se:'bottom right corner'};
    for(const [edge,name] of Object.entries(edgeNames)){
      const handle=document.createElement('button');handle.className=`resize-handle resize-${edge}`;handle.dataset.resize=edge;
      handle.setAttribute('aria-label',`Resize ${name} of ${b.title}`);handle.title=`Drag to resize ${name}. Arrow keys resize; Shift takes bigger steps.`;
      node.append(handle);
    }
    node.insertAdjacentHTML('beforeend',`<button class="dependency-port dependency-in" data-link-in="${escapeHTML(b.id)}" aria-label="Link a prerequisite to ${escapeHTML(b.title)}" title="Drop a prerequisite line here"><span></span></button><button class="dependency-port dependency-out" data-link-out="${escapeHTML(b.id)}" aria-label="Draw dependency from ${escapeHTML(b.title)}" title="Drag to work that depends on this block">${icon('link')}</button>`);
    const surface=document.createElement('div');surface.className='block-surface';
    surface.append($('.block-decoration',node),$('.crack-canvas',node));node.prepend(surface);
    drawUncertainty(node,b);drawCracks($('.crack-canvas',node), b); layer.append(node);
  }
  drawDependencies();
}
function renderInspector() {
  const root = $('#inspector'), b = getBlock(state.selected);
  if (mode === 'new' || mode === 'edit') { renderForm(root, mode === 'edit' ? b : null); return; }
  if (!b) { root.innerHTML = `<div class="inspector-empty">${icon('rock')}<h2>What’s under here?</h2><p>Select a block to explore its scope,<br>progress, and people.</p><button class="button" id="empty-new">${icon('plus')}Add a block</button></div>`; $('#empty-new').onclick = openNew; return; }
  const blocked = isBlocked(b);
  root.innerHTML = `<div class="inspector-header"><span>${escapeHTML(b.code)} / ${b.done ? 'CLEARED' : blocked ? 'WAITING' : b.people.length ? 'IN THE WORKS' : 'UNEXPLORED'}</span><button class="icon-button" id="edit-block" aria-label="Edit block">${icon('edit')}</button></div><h2>${escapeHTML(b.title)}</h2><p class="task-note">${escapeHTML(b.note)}</p>
    <section class="inspector-section"><div class="field-label"><span>A little progress</span><output>${b.progress}%</output></div><div class="progress-track" role="progressbar" aria-label="Reported progress" aria-valuenow="${b.progress}" aria-valuemin="0" aria-valuemax="100"><div style="width:${b.progress}%"></div></div><div class="progress-label"><span>${b.done ? 'Out of the ground.' : blocked ? blockedReason(b) : 'Every chip counts.'}</span>${icon(b.done ? 'check' : 'pick')}</div><div class="progress-actions"><button class="button primary" id="chip-block" ${b.done || blocked ? 'disabled' : ''}>${icon('pick')}Chip away +10%</button><button class="button" id="undo-chip" aria-label="Reduce progress by 10 percent" ${!b.progress || b.done ? 'disabled' : ''}>${icon('undo')}</button></div>${b.done ? '<button class="text-button" id="reopen-block" style="margin-top:12px">Put back in the ground</button>' : '<p class="section-caption">You set the progress. The pickaxe just shows someone is here.</p>'}</section>
    <section class="inspector-section"><div class="field-label"><label for="uncertainty">Room for the unknown</label><output id="uncertainty-value">${uncertaintyName(b.uncertainty)}</output></div><input type="range" id="uncertainty" min="0" max="48" step="4" aria-valuetext="${uncertaintyName(b.uncertainty)}" value="${b.uncertainty}" ${b.done ? 'disabled' : ''}><div class="range-ends"><span>Well understood</span><span>Still a mystery</span></div><p class="section-caption">The dithered gap is scope we haven’t uncovered. More uncertainty hides more of the block.</p></section>
    <section class="inspector-section"><div class="field-label">The part we know <output id="size-kind">${b.width!==undefined||b.height!==undefined?'Custom':''}</output></div><div class="size-options" role="group" aria-label="Known block size">${Object.keys(SIZES).map(s => `<button class="size-option ${b.width===undefined&&b.height===undefined&&b.size === s ? 'active' : ''}" data-size="${s}" aria-pressed="${b.width===undefined&&b.height===undefined&&b.size === s}" ${b.done ? 'disabled' : ''}>${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div><p class="section-caption">Drag any edge or corner to reshape the block.</p></section>
    <section class="inspector-section"><div class="field-label">Digging here <span>${b.people.length} ${b.people.length === 1 ? 'person' : 'people'}</span></div>${b.people.length ? b.people.map(id => { const p=PEOPLE.find(p=>p.id===id);return `<div class="assigned-person">${spriteMarkup(p)}<span>${p.name}</span><button class="icon-button" data-unassign="${id}" aria-label="Remove ${p.name} from this block">${icon('close')}</button></div>`; }).join('') : `<p class="assignment-empty">${b.done ? 'A job well dug.' : 'A quiet spot. Bring a digger over.'}</p>`}${!b.done ? `<select class="assign-select" id="assign-person" aria-label="Assign a digger"><option value="">+ Add a digger</option>${PEOPLE.filter(p=>!b.people.includes(p.id)).map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>` : ''}</section>
    <section class="inspector-section"><div class="field-label">Prerequisites <span>${dependenciesOf(b).length}</span></div><div class="dependency-list">${dependenciesOf(b).map(id=>`<div class="dependency-row"><span>${escapeHTML(getBlock(id)?.title??'Removed work')}${getBlock(id)?.done?' · cleared':''}</span><button class="icon-button" data-remove-dependency="${escapeHTML(id)}" aria-label="Remove dependency on ${escapeHTML(getBlock(id)?.title??'removed work')}" ${b.done?'disabled':''}>${icon('close')}</button></div>`).join('')||'<p class="assignment-empty">This work can start independently.</p>'}</div><label for="dependency" class="field-label dependency-add-label">Add a prerequisite</label><select class="assign-select dependency-select" id="dependency" ${b.done?'disabled':''}><option value="">+ Link a block</option>${state.blocks.filter(a=>canAddDependency(state.blocks,a.id,b.id).ok).map(a=>`<option value="${escapeHTML(a.id)}">${escapeHTML(a.title)}${a.done?' (cleared)':''}</option>`).join('')}</select><p class="section-caption">Or drag a block’s lower link dot onto the work that depends on it. Prerequisites always stay above.</p></section>
    <div class="inspector-bottom"><p class="inspector-footnote">A block has a shape, not a schedule.<br>Move it as your understanding changes.</p></div>`;
  $('#edit-block').onclick = () => { mode='edit';renderInspector();cacheSprites(); };
  $('#chip-block').onclick = () => changeProgress(b, 10);
  $('#undo-chip').onclick = () => changeProgress(b, -10);
  $('#uncertainty').oninput = e => { b.uncertainty=+e.target.value;e.target.setAttribute('aria-valuetext',uncertaintyName(b.uncertainty));$('#uncertainty-value').textContent=uncertaintyName(b.uncertainty);renderBoard();cacheSprites();save(); };
  $$('[data-size]',root).forEach(el=>el.onclick=()=>{b.size=el.dataset.size;delete b.width;delete b.height;render();save();});
  $$('[data-unassign]',root).forEach(el=>el.onclick=()=>{b.people=b.people.filter(id=>id!==el.dataset.unassign);render();save();notify('A little room to breathe. Digger unassigned.');});
  if ($('#assign-person')) $('#assign-person').onchange = e => { if(e.target.value)assignPerson(e.target.value,b.id); };
  $('#dependency').onchange=e=>{if(e.target.value)addDependency(e.target.value,b.id);};
  $$('[data-remove-dependency]',root).forEach(button=>button.onclick=()=>{setDependencies(b,dependenciesOf(b).filter(id=>id!==button.dataset.removeDependency));render();save();notify('Dependency removed.');});
  if ($('#reopen-block')) $('#reopen-block').onclick = () => {state.excavations=state.excavations.filter(h=>h.blockId!==b.id);b.done=false;b.progress=90;render();save();notify('Work reopened. Its excavated space can hold work again.');};
}
function uncertaintyName(p) { return `${Math.round(p/48*100)}% unknown`; }

function renderForm(root,b) {
  root.innerHTML=`<div class="inspector-header"><span>${b?'RESHAPE THE WORK':'SOMETHING TO UNCOVER'}</span><button class="icon-button" id="cancel-form" aria-label="Cancel editing">${icon('close')}</button></div><h2>${b?'A clearer picture.':'Plant a new block.'}</h2><p class="task-note">Start with what you know. Leave some room for what you don’t.</p><form id="block-form"><label class="field-label" for="block-title">What’s the work?</label><input class="field-input" id="block-title" name="title" maxlength="65" required placeholder="Give this block a name" value="${escapeHTML(b?.title||'')}"><label class="field-label" for="block-note">A little context</label><textarea class="field-input" id="block-note" name="note" maxlength="600" placeholder="What do we know so far?">${escapeHTML(b?.note||'')}</textarea><div class="field-label">A color in the ground</div><div class="color-options" role="group" aria-label="Block color">${Object.entries(PALETTE).map(([key,p])=>`<button type="button" class="color-option ${key===(b?.color||'amber')?'active':''}" data-color="${key}" style="background:${p.fill}" aria-label="${p.name}" aria-pressed="${key===(b?.color||'amber')}"></button>`).join('')}</div><input type="hidden" name="color" value="${b?.color||'amber'}"><button class="button primary" type="submit">${icon(b?'check':'plus')}${b?'Save changes':'Add to the ground'}</button>${b?'<div><button type="button" class="text-button delete-button" id="delete-block">Remove this block</button></div>':''}</form>`;
  $('#cancel-form').onclick=()=>{mode='inspect';renderInspector();cacheSprites();};
  $$('[data-color]',root).forEach(el=>el.onclick=()=>{$$('[data-color]',root).forEach(a=>{a.classList.toggle('active',a===el);a.setAttribute('aria-pressed',a===el);});$('[name=color]',root).value=el.dataset.color;});
  $('#block-form').onsubmit=e=>{
    e.preventDefault();const data=new FormData(e.target),title=data.get('title').trim();if(!title){$('#block-title').setCustomValidity('Give the work a name.');$('#block-title').reportValidity();return;}
    if(b){b.title=title;b.note=data.get('note').trim();b.color=data.get('color');}
    else { const maxCode=Math.max(0,...state.blocks.map(t=>Number(t.code.replace('DIG-',''))||0));const rect=$('#pit-viewport');const nb={id:crypto.randomUUID(),code:`DIG-${String(maxCode+1).padStart(2,'0')}`,title,note:data.get('note').trim(),color:data.get('color'),size:'medium',x:150+(maxCode%3)*50,y:Math.max(170,Math.min(830,Math.round(rect.scrollTop/zoom+200))),uncertainty:24,progress:0,people:[],dependency:'',done:false};state.blocks.push(nb);state.selected=nb.id; }
    mode='inspect';render();save();notify(b?'The shape of the work is a little clearer.':'A new block, ready to explore.');revealSelected();
  };
  $('#block-title').oninput=e=>e.target.setCustomValidity('');
  if(b)$('#delete-block').onclick=()=>{ const button=$('#delete-block');if(button.dataset.confirm!=='true'){button.dataset.confirm='true';button.textContent='Remove it? Click again to confirm';return;}state.blocks=state.blocks.filter(a=>a.id!==b.id);state.blocks.forEach(a=>setDependencies(a,dependenciesOf(a).filter(id=>id!==b.id)));state.selected=null;mode='inspect';render();save();notify('Block removed.'); };
  requestAnimationFrame(()=>$('#block-title')?.focus({preventScroll:true}));
}
function render() {
  const focused=document.activeElement;
  const focusId=focused?.id;
  const focusResize=focused?.dataset.resize;
  const resizeBlock=focusResize?focused.closest('[data-block]').dataset.block:null;
  const focusBlock=focused?.classList.contains('block-hit') ? focused.closest('[data-block]').dataset.block : null;
  renderBoard();renderCrew();renderInspector();cacheSprites();
  const replacement=focusId ? document.getElementById(focusId) : focusResize ? $(`[data-block="${CSS.escape(resizeBlock)}"] [data-resize="${focusResize}"]`) : focusBlock ? $(`[data-block="${CSS.escape(focusBlock)}"] .block-hit`) : null;
  if(replacement&&!replacement.disabled)replacement.focus({preventScroll:true});
}
function selectBlock(id) {
  if(selectedDigger){assignPerson(selectedDigger,id);return;}
  state.selected=id;mode='inspect';render();save();
  if(innerWidth<=680)$('#inspector').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'});
}
function openNew() { selectedDigger=null;mode='new';renderCrew();renderInspector();cacheSprites();if(innerWidth<=680)$('#inspector').scrollIntoView({behavior:reducedMotion.matches?'instant':'smooth',block:'start'}); }
function assignPerson(personId,blockId,sourceId=null) {
  const b=getBlock(blockId),p=PEOPLE.find(p=>p.id===personId);if(!b||b.done)return;
  if(b.people.includes(personId)){selectedDigger=null;state.selected=b.id;mode='inspect';render();return;}
  const sites=state.blocks.filter(a=>!a.done&&a.id!==sourceId&&a.people.includes(personId));
  if(sites.length>=2){notify(`${p.name} is already digging in two places. Remove one assignment first.`);return;}
  if(sourceId){const source=getBlock(sourceId);if(source)source.people=source.people.filter(id=>id!==personId);}
  b.people.push(personId);selectedDigger=null;state.selected=b.id;mode='inspect';render();save();notify(`${p.name} ${isBlocked(b)?'is lined up here when the way is clear.':'has found a new spot to dig.'}`);
}
function changeProgress(b,amount) {
  if(b.done||(amount>0&&isBlocked(b)))return;
  b.progress=Math.max(0,Math.min(100,b.progress+amount));
  if(b.progress===100){state.excavations.push({blockId:b.id,...b.slot});b.done=true;b.people=[];explode(b);notify(`${b.title} is out of the ground. Its space stays open.`);}
  render();save();
}
function revealSelected() { const b=getBlock(state.selected);if(!b||b.done)return;const view=$('#pit-viewport');view.scrollTo({left:Math.max(0,(b.x-WORLD.left-50)*zoom),top:Math.max(0,(b.y-140)*zoom),behavior:reducedMotion.matches?'instant':'smooth'}); }
function setZoom(value) {
  zoom=Math.min(1.35,Math.max(.6,value));const world=$('#pit-world');
  // CSS zoom also sizes the scroll area, avoiding a phantom unscaled canvas.
  world.style.zoom=zoom;$('#zoom-level').value=`${Math.round(zoom*100)}%`;$('#zoom-out').disabled=zoom<=.6;$('#zoom-in').disabled=zoom>=1.35;
  scheduleTerrain();
}
function fit() { setZoom(Math.min(1,$('#pit-viewport').clientWidth/900)); }
function explode(b) {
  if(reducedMotion.matches)return;const canvas=document.createElement('canvas'),[w,h]=blockDimensions(b);canvas.className='effect-canvas';canvas.width=w+256;canvas.height=h+256;
  Object.assign(canvas.style,{inset:'auto',left:`${b.x-WORLD.left-128}px`,top:`${b.y-128}px`,width:`${canvas.width}px`,height:`${canvas.height}px`,zIndex:20});$('#pit-world').append(canvas);
  const c=canvas.getContext('2d'),random=rng(hash(b.id)),particles=Array.from({length:50},()=>({x:128+random()*w,y:128+random()*h,vx:(random()-.5)*6,vy:-random()*6,size:3+Math.floor(random()*3)*2}));
  let start;function step(t){start??=t;const age=(t-start)/1000;c.clearRect(0,0,canvas.width,canvas.height);c.globalAlpha=Math.max(0,1-age);c.fillStyle=PALETTE[b.color].fill;for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.25;c.fillRect(Math.round(p.x/2)*2,Math.round(p.y/2)*2,p.size,p.size);}if(age<1)requestAnimationFrame(step);else canvas.remove();}requestAnimationFrame(step);
}

const canvasPanning=installCanvasPanning($('#pit-viewport'),{
  canStart:()=>!drag,
  onEnd:()=>{suppressClickUntil=performance.now()+200;},
  onMove(dx,dy){
    const view=$('#pit-viewport');
    // Grow before either horizontal boundary while preserving the grabbed point.
    if(dx>0&&view.scrollLeft-dx<128)syncWorldBounds({left:WORLD.left-Math.max(256,Math.ceil(dx/zoom)),right:WORLD.right,height:WORLD.height},true);
    if(dx<0&&view.scrollLeft-dx+view.clientWidth>view.scrollWidth-128)syncWorldBounds({left:WORLD.left,right:WORLD.right+Math.max(256,Math.ceil(-dx/zoom)),height:WORLD.height},true);
    if(dy<0&&view.scrollTop-dy+view.clientHeight>view.scrollHeight-128)syncWorldBounds({left:WORLD.left,right:WORLD.right,height:WORLD.height+Math.max(320,Math.ceil(-dy/zoom))},true);
    view.scrollLeft-=dx;view.scrollTop-=dy;scheduleTerrain();
  }
});

// Canvas navigation takes priority over grabbing blocks, handles, links, or diggers.
document.addEventListener('pointerdown',e=>{
  suppressClickUntil=0;
  if(e.button!==0||e.target.closest('input,select,textarea'))return;
  const digger=e.target.closest('[data-digger]'),block=e.target.closest('.task-block');
  const resize=e.target.closest('[data-resize]');
  const link=e.target.closest('[data-link-out]');
  if(!digger&&!block)return;
  if(!digger&&!resize&&!link&&!e.target.closest('.block-hit'))return;
  const el=link||resize||digger||block,rect=$('#pit-world').getBoundingClientRect();
  drag={kind:link?'link':resize?'resize':digger?'digger':'block',edge:resize?.dataset.resize,id:digger?.dataset.digger||block.dataset.block,sourceId:digger?.dataset.source||null,el,startX:e.clientX,startY:e.clientY,moved:false,pointerId:e.pointerId,offsetX:(e.clientX-rect.left)/zoom+WORLD.left-(block?getBlock(block.dataset.block).x:0),offsetY:(e.clientY-rect.top)/zoom-(block?getBlock(block.dataset.block).y:0)};
  if(!digger){drag.baseline=structuredClone(state);}
  el.setPointerCapture(e.pointerId);
});
function updateDrag(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  if(!drag.moved&&Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)<5)return;
  e.preventDefault?.();drag.lastPointer={pointerId:e.pointerId,clientX:e.clientX,clientY:e.clientY};
  pendingLink=null;
  if(drag.kind==='link'){
    drag.moved=true;pendingLink=null;
    $$('.is-link-target,.is-invalid-link-target').forEach(node=>node.classList.remove('is-link-target','is-invalid-link-target'));
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-block]');
    drag.invalidTarget=!!target&&!canAddDependency(state.blocks,drag.id,target.dataset.block).ok;
    target?.classList.add(drag.invalidTarget?'is-invalid-link-target':'is-link-target');drawDependencies();return;
  }
  if(drag.kind==='resize'){
    drag.moved=true;
    drag.preview=previewResize(drag.baseline,drag.id,drag.edge,(e.clientX-drag.startX)/zoom,(e.clientY-drag.startY)/zoom);
    showPlacementPreview(drag.preview,drag.id,false);
    const b=drag.preview.blocks.find(b=>b.id===drag.id),p=drag.preview.placements.get(b.id),[w,h]=blockDimensions(b),node=drag.el.closest('.task-block');
    node.classList.add('is-resizing');Object.assign(node.style,{left:`${p.x-WORLD.left}px`,top:`${p.y}px`,width:`${w}px`,height:`${h}px`});
    drawUncertainty(node,b);drawCracks($('.crack-canvas',node),b);
    drawDependencies();
    return;
  }
  if(!drag.moved){drag.moved=true;drag.el.classList.add(drag.kind==='block'?'is-dragging':'moving-source');if(drag.kind==='digger'){const ghost=document.createElement('div');ghost.className='drag-ghost';ghost.innerHTML=spriteMarkup(PEOPLE.find(p=>p.id===drag.id));document.body.append(ghost);drag.ghost=ghost;drawSprite($('canvas',ghost),PEOPLE.find(p=>p.id===drag.id));}}
  if(drag.kind==='block'){
    const b=getBlock(drag.id),rect=$('#pit-world').getBoundingClientRect(),x=(e.clientX-rect.left)/zoom+WORLD.left-drag.offsetX,y=(e.clientY-rect.top)/zoom-drag.offsetY;
    const slotX=x,slotY=y;
    drag.preview=previewMove(drag.baseline,b.id,slotX,slotY);
    showPlacementPreview(drag.preview,b.id);
    const p=drag.preview.placements.get(b.id);
    drag.orderLimited=dependenciesOf(b).length>0&&p.y>y+8;
    const hint=$('#placement-preview span');if(hint)hint.textContent=drag.orderLimited?'PREREQUISITE COMES FIRST':'SNAP INTO THE GROUND';
    const visibleX=p.x,visibleY=p.y;
    drag.el.style.left=`${visibleX-WORLD.left}px`;drag.el.style.top=`${visibleY}px`;
    pendingLink=null;drawDependencies();
  }else{
    Object.assign(drag.ghost.style,{left:`${e.clientX}px`,top:`${e.clientY}px`});$$('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));
    const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.task-block');if(target)target.classList.add('is-drop-target');
  }
}
document.addEventListener('pointermove',updateDrag);
function panWhileDragging(time){
  if(!drag?.moved||!['block','link'].includes(drag.kind)||!drag.lastPointer)return;
  const view=$('#pit-viewport'),r=view.getBoundingClientRect(),pointer=drag.lastPointer;
  if(pointer.clientY<r.top-32||pointer.clientY>r.bottom+32||pointer.clientX<r.left-32||pointer.clientX>r.right+32)return;
  const hot=64,dt=Math.min(32,time-(drag.panTime??time));drag.panTime=time;
  const speed=(start,end)=>start<hot?-Math.min(1.5,Math.max(.15,(hot-start)/hot)):end<hot?Math.min(1.5,Math.max(.15,(hot-end)/hot)):0;
  const dx=speed(pointer.clientX-r.left,r.right-pointer.clientX)*dt*.7;
  const dy=speed(pointer.clientY-r.top,r.bottom-pointer.clientY)*dt*.7;
  if(!dx&&!dy)return;
  if(dx<0&&view.scrollLeft<128)syncWorldBounds({left:WORLD.left-256,right:WORLD.right,height:WORLD.height},true);
  if(dx>0&&view.scrollLeft+view.clientWidth>view.scrollWidth-128)syncWorldBounds({left:WORLD.left,right:WORLD.right+256,height:WORLD.height},true);
  if(dy>0&&view.scrollTop+view.clientHeight>view.scrollHeight-128)syncWorldBounds({left:WORLD.left,right:WORLD.right,height:WORLD.height+320},true);
  view.scrollLeft+=dx;view.scrollTop+=dy;
  updateDrag(pointer);scheduleTerrain();
}
function finishDrag(e,cancel=false){
  if(!drag||e.pointerId!==drag.pointerId)return;
  const d=drag;drag=null;d.el.classList.remove('is-dragging','moving-source');d.ghost?.remove();$$('.is-drop-target').forEach(el=>el.classList.remove('is-drop-target'));
  $$('.is-link-target,.is-invalid-link-target').forEach(el=>el.classList.remove('is-link-target','is-invalid-link-target'));
  if(d.el.hasPointerCapture(e.pointerId))d.el.releasePointerCapture(e.pointerId);
  if(d.moved){
    suppressClickUntil=performance.now()+200;
    if(d.kind==='link'){
      const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('[data-block]');
      if(!cancel&&target)addDependency(d.id,target.dataset.block);else{drawDependencies();if(!cancel)notify('Drop the line onto the block that depends on this work.');}
    }
    else if(d.kind==='block'||d.kind==='resize'){
      if(!cancel&&d.preview)state.blocks=d.preview.blocks;
      $('#placement-preview')?.remove();state.selected=d.id;mode='inspect';render();save();
      if(!cancel&&d.kind==='block'&&d.orderLimited)notify('This block stays below its prerequisites.');
    }
    else if(!cancel){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.task-block');if(target)assignPerson(d.id,target.dataset.block,d.sourceId);else notify('Drop onto a colored block to assign a work site.');}
  }
}
document.addEventListener('pointerup',e=>finishDrag(e));document.addEventListener('pointercancel',e=>finishDrag(e,true));
function showPlacementPreview(preview,movingId,showMarker=true){
  syncWorldBounds(preview,true);scheduleTerrain();
  for(const [id,p] of preview.placements){
    const block=getBlock(id),node=$(`[data-block="${CSS.escape(id)}"]`);
    if(!node)continue;
    const spots=placedDiggers(block,preview);
    $$('.block-digger',node).forEach(el=>{const spot=spots.find(s=>s.id===el.dataset.digger);el.hidden=!spot;if(spot){el.style.left=`${spot.x}px`;el.dataset.walkMin=spot.min;el.dataset.walkMax=spot.max;}});
    if(id===movingId)continue;
    node.classList.add('is-reflowing');node.style.left=`${p.x-WORLD.left}px`;node.style.top=`${p.y}px`;
  }
  if(!showMarker)return;
  let marker=$('#placement-preview');if(!marker){marker=document.createElement('div');marker.id='placement-preview';marker.innerHTML='<span>SNAP INTO THE GROUND</span>';$('#task-layer').append(marker);}
  const p=preview.placements.get(movingId).slot;marker.style.cssText=`left:${p.x-WORLD.left}px;top:${p.y}px;width:${p.width}px;height:${p.height}px`;
}
let suppressClickUntil=0;
document.addEventListener('click',e=>{
  if(canvasPanning.ready||canvasPanning.active||performance.now()<suppressClickUntil)return;
  const source=e.target.closest('[data-link-out]');
  if(source){pendingLink=pendingLink===source.dataset.linkOut?null:source.dataset.linkOut;drawDependencies();if(pendingLink)notify('Prerequisite selected. Choose the block that depends on it.');return;}
  if(e.target.closest('[data-resize]'))return;
  const digger=e.target.closest('[data-digger]');
  if(digger){selectedDigger=selectedDigger===digger.dataset.digger?null:digger.dataset.digger;renderCrew();cacheSprites();if(selectedDigger)notify(`${PEOPLE.find(p=>p.id===selectedDigger).name} selected. Pick a block to dig.`);return;}
  const block=e.target.closest('.task-block');if(block){if(pendingLink)addDependency(pendingLink,block.dataset.block);else selectBlock(block.dataset.block);return;}
  const cleared=e.target.closest('[data-cleared]');if(cleared){state.selected=cleared.dataset.cleared;mode='inspect';render();save();}
});
document.addEventListener('keydown',e=>{
  if(e.key==='Escape'&&drag){finishDrag({pointerId:drag.pointerId,clientX:drag.startX,clientY:drag.startY},true);return;}
  if(e.key==='Escape'){selectedDigger=null;pendingLink=null;drawDependencies();renderCrew();cacheSprites();if(mode!=='inspect'){mode='inspect';renderInspector();cacheSprites();}}
  const target=e.target.closest('.block-hit'),vectors={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  const handle=e.target.closest('[data-resize]');
  if(handle&&vectors[e.key]){
    e.preventDefault();const b=getBlock(handle.closest('[data-block]').dataset.block),[dx,dy]=vectors[e.key],step=e.shiftKey?32:8;
    const preview=previewResize(state,b.id,handle.dataset.resize,dx*step,dy*step);state.blocks=preview.blocks;state.selected=b.id;render();save();return;
  }
  if(target&&vectors[e.key]){
    e.preventDefault();const b=getBlock(target.closest('[data-block]').dataset.block),[dx,dy]=vectors[e.key];
    if(dx){delete b.pinnedX;b.pinnedColumn=b.column+dx*(e.shiftKey?3:1);}
    if(dy){const index=state.blocks.indexOf(b),step=e.shiftKey?3:1;state.blocks.splice(index,1);state.blocks.splice(Math.max(0,Math.min(state.blocks.length,index+dy*step)),0,b);}
    render();save();if(dx)revealSelected();
  }
});
$('#new-block').onclick=openNew;
$('#help-button').onclick=()=>$('#help-dialog').showModal();
$('#zoom-out').onclick=()=>setZoom(zoom-.1);$('#zoom-in').onclick=()=>setZoom(zoom+.1);$('#fit-view').onclick=()=>{fit();$('#pit-viewport').scrollTo({left:-WORLD.left*zoom,top:0,behavior:reducedMotion.matches?'instant':'smooth'});};
function confirmReset(container){
  if($('.reset-question',container))return;
  const div=document.createElement('div');div.innerHTML='<p class="reset-question">Replace local changes with the demo?</p><div class="reset-row"><button class="button" id="confirm-reset">Reset</button><button class="text-button" id="cancel-reset">Keep digging</button></div>';container.append(div);
  $('#cancel-reset').onclick=()=>div.remove();$('#confirm-reset').onclick=()=>{state=demo();mode='inspect';selectedDigger=null;render();save();div.remove();notify('Fresh ground. The demo is reset.');};
}
$('#reset-project').onclick=()=>confirmReset($('.sidebar-bottom'));
$('#help-reset').onclick=()=>confirmReset($('#help-reset-container'));
$('#pit-viewport').addEventListener('scroll',()=>{
  const view=$('#pit-viewport');
  if(view.scrollTop>0&&view.scrollTop+view.clientHeight>view.scrollHeight-128)syncWorldBounds({left:WORLD.left,right:WORLD.right,height:WORLD.height+480},true);
  scheduleTerrain();
},{passive:true});
render();save();fit();requestAnimationFrame(animate);
const brand=$('.brand-pick').getContext('2d');pixelLine(brand,6,28,23,6,'#68794b',4);pixelLine(brand,7,4,27,12,'#344d34',4);pixelLine(brand,11,2,19,2,'#344d34',4);pixelLine(brand,27,12,27,16,'#344d34',4);
let previousWidth=$('#pit-viewport').clientWidth;
new ResizeObserver(entries=>{const width=entries[0].contentRect.width;if(Math.abs(width-previousWidth)>20){previousWidth=width;fit();}}).observe($('#pit-viewport'));
