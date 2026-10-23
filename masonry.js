// The excavation has a shared geological grid. Completed footprints are permanent
// obstacles to packing: rearranging work must never silently refill a hole.
export const MASONRY = Object.freeze({ left: 48, surface: 96, top: 144, columns: 12, columnWidth: 64, unit: 8, headroom: 48, joint: 0 });
export const SIZES = Object.freeze({ small: [210, 132], medium: [250, 148], large: [300, 172] });
export const RESIZE_LIMITS = Object.freeze({ minWidth: 176, maxWidth: 640, minHeight: 132, maxHeight: 640 });
export function blockDimensions(block) {
  const preset = SIZES[block.size];
  return [block.width ?? preset[0], block.height ?? preset[1]];
}
export function dependenciesOf(block) {
  return [...new Set(Array.isArray(block.dependencies) ? block.dependencies : block.dependency ? [block.dependency] : [])];
}
export function dependencyOrder(blocks) {
  const pending=[...blocks],ordered=[],ids=new Set(blocks.map(b=>b.id));
  while(pending.length){
    const index=pending.findIndex(b=>dependenciesOf(b).every(id=>!ids.has(id)));
    if(index<0)throw new Error('Dependency cycle');
    const [block]=pending.splice(index,1);ids.delete(block.id);ordered.push(block);
  }
  return ordered;
}
export function canAddDependency(blocks, prerequisiteId, dependentId) {
  const byId=new Map(blocks.map(b=>[b.id,b])),source=byId.get(prerequisiteId),target=byId.get(dependentId);
  if(!source||!target)return {ok:false,reason:'Choose two work blocks.'};
  if(prerequisiteId===dependentId)return {ok:false,reason:'A block cannot depend on itself.'};
  if(target.done)return {ok:false,reason:'Reopen this block before adding a prerequisite.'};
  if(dependenciesOf(target).includes(prerequisiteId))return {ok:false,reason:'These blocks are already linked.'};
  const seen=new Set(),queue=[prerequisiteId];
  while(queue.length){const id=queue.pop();if(id===dependentId)return {ok:false,reason:'That link would create a dependency loop.'};if(seen.has(id))continue;seen.add(id);queue.push(...dependenciesOf(byId.get(id)??{}));}
  return {ok:true};
}
export function footprint(block) {
  const [width, height] = blockDimensions(block);
  return { width, height, columns: Math.ceil(width / MASONRY.columnWidth) };
}
export function intersects(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function landingY(x, width, height, occupied, minimumY=MASONRY.top) {
  let y = minimumY;
  // Every collision advances to an existing lower edge. Bodies settle against
  // the surface course, an earlier rectangle, or their prerequisite depth floor.
  for (;;) {
    const collisions = occupied.filter(rect => intersects({ x, y, width, height }, rect));
    if (!collisions.length) return y;
    y = Math.max(...collisions.map(rect => rect.y + rect.height));
  }
}
export function layoutMasonry(blocks, excavations = []) {
  const occupied = excavations.map(rect => ({ ...rect }));
  const placements = new Map();
  for (const block of dependencyOrder(blocks.filter(block => !block.done))) {
    const minimumY=Math.max(MASONRY.top,...dependenciesOf(block).map(id=>{
      const parent=placements.get(id)?.slot??excavations.find(h=>h.blockId===id);
      return parent?parent.y+parent.height:MASONRY.top;
    }));
    const shape = footprint(block), maxColumn = Math.max(0, MASONRY.columns - shape.columns);
    const preferred = block.slot ? block.x : MASONRY.left + Math.max(0, Math.min(maxColumn, Math.round(block.column ?? 0))) * MASONRY.columnWidth;
    // Auto placement tries contact edges as well as the shared grid. The body,
    // not a padded proxy, collides with existing stone and reserved cavities.
    const candidates = Number.isFinite(block.pinnedX) ? [block.pinnedX]
      : Number.isInteger(block.pinnedColumn) ? [MASONRY.left + block.pinnedColumn * MASONRY.columnWidth]
      : [...new Set([preferred,MASONRY.left,...occupied.flatMap(r=>[r.x,r.x+r.width,r.x-shape.width]),
          ...Array.from({length:maxColumn+1},(_,i)=>MASONRY.left+i*MASONRY.columnWidth)])]
        .filter(x=>x>=MASONRY.left&&x+shape.width<=MASONRY.left+MASONRY.columns*MASONRY.columnWidth);
    let best;
    for (const x of candidates) {
      const y = landingY(x, shape.width, shape.height, occupied,minimumY);
      const score = y * 1000000 + Math.abs(x - preferred);
      if (!best || score < best.score) best = { x, y, column:Math.round((x-MASONRY.left)/MASONRY.columnWidth), score, width: shape.width, height: shape.height };
    }
    const slot = { x: best.x, y: best.y, width: best.width, height: best.height };
    placements.set(block.id, { slot, column: best.column, x: best.x, y: best.y });
    occupied.push(slot);
  }
  const left = Math.min(0, ...occupied.map(rect => rect.x - MASONRY.left));
  const right = Math.max(900, ...occupied.map(rect => rect.x + rect.width + 84));
  return { placements, access:surfaceAccess(placements), left, right, width: right - left, height: Math.max(1160, ...occupied.map(rect => rect.y + rect.height + 176)) };
}
// Vertical rays from the surface determine the exposed parts of each top face.
// Cavities are empty; every live rectangle above a face is an actual obstruction.
export function surfaceAccess(placements,surfaces=placements){
  const access=new Map();
  for(const [id,{slot:body}] of surfaces){
    let ranges=[{x:body.x,width:body.width}];const blockedBy=[];
    for(const [otherId,{slot:roof}] of placements){
      if(id===otherId||roof.y+roof.height>body.y||roof.x>=body.x+body.width||roof.x+roof.width<=body.x)continue;
      blockedBy.push(otherId);
      ranges=ranges.flatMap(r=>{
        const end=r.x+r.width,left=Math.max(r.x,roof.x),right=Math.min(end,roof.x+roof.width);
        if(left>=right)return [r];
        return [...(left>r.x?[{x:r.x,width:left-r.x}]:[]),...(right<end?[{x:right,width:end-right}]:[])];
      });
    }
    access.set(id,{ranges,blockedBy,reachable:ranges.some(r=>r.width>=32)});
  }
  return access;
}
export function excavationRects(placements,excavations=[]){
  // Removed bodies remain shaft targets even when there is no live work below.
  // Only live stone occludes access; cavities never act as roofs for each other.
  const surfaces=new Map(placements);
  for(const hole of excavations)surfaces.set(Symbol('excavation'),{slot:hole,y:hole.y});
  const access=surfaceAccess(placements,surfaces),shafts=[];
  for(const [id,face] of access)for(const range of face.ranges){
    const y=surfaces.get(id).y;
    if(y>MASONRY.surface)shafts.push({...range,y:MASONRY.surface,height:y-MASONRY.surface});
  }
  return [...excavations,...shafts];
}
export function migrateMasonry(project) {
  if (project.layoutVersion === 3 && Array.isArray(project.excavations)) return;
  if(project.layoutVersion===2&&Array.isArray(project.excavations)){
    project.excavations=project.excavations.map(h=>{
      const b=project.blocks.find(b=>b.id===h.blockId);
      if(!b)return h;
      const [width,height]=blockDimensions(b);return {blockId:h.blockId,x:b.x,y:b.y,width,height};
    });
    project.blocks.forEach(b=>{delete b.slot;});
    project.layoutVersion=3;return;
  }
  project.blocks.sort((a, b) => a.y - b.y || a.x - b.x);
  project.blocks.forEach(block => { block.column = Math.round((block.x - MASONRY.left) / MASONRY.columnWidth); });
  // Include already-completed work once, to recover its original packed cavity.
  const initial = layoutMasonry(project.blocks.map(block => ({ ...block, done: false })));
  project.excavations = project.blocks.filter(block => block.done).map(block => ({ blockId: block.id, ...initial.placements.get(block.id).slot }));
  project.layoutVersion = 3;
}
export function applyMasonry(project) {
  migrateMasonry(project);
  const layout = layoutMasonry(project.blocks, project.excavations);
  for (const block of project.blocks) {
    const placement = layout.placements.get(block.id);
    if (placement) Object.assign(block, placement);
  }
  return layout;
}
export function previewMove(project, id, x, y) {
  const moving = project.blocks.find(block => block.id === id);
  const others = project.blocks.filter(block => block.id !== id);
  const live = others.filter(block => !block.done);
  const shape = footprint(moving);
  const edges=[MASONRY.left,...[...live.map(b=>b.slot),...project.excavations].flatMap(r=>[r.x,r.x+r.width,r.x-shape.width,r.x+r.width-shape.width])];
  const nearest=edges.reduce((a,b)=>Math.abs(b-x)<Math.abs(a-x)?b:a,edges[0]);
  const pinnedX=Math.abs(nearest-x)<=12?nearest:MASONRY.left+Math.round((x-MASONRY.left)/MASONRY.unit)*MASONRY.unit;
  const column = Math.round((pinnedX - MASONRY.left) / MASONRY.columnWidth);
  let index = live.length;
  let closest = Infinity;
  // The cursor's slot center chooses a neighbor; crossing its midpoint changes
  // order. The frozen start-of-drag list makes identical gestures deterministic.
  live.forEach((block, i) => {
    const slot = block.slot;
    const distance = Math.hypot(x + shape.width / 2 - slot.x - slot.width / 2, y + shape.height / 2 - slot.y - slot.height / 2);
    if (distance < closest) { closest = distance; index = i + (y + shape.height / 2 > slot.y + slot.height / 2 ? 1 : 0); }
  });
  const next = { ...moving, pinnedX, pinnedColumn: column, column };
  const liveOrder = [...live.slice(0, index), next, ...live.slice(index)];
  const blocks = [...liveOrder, ...others.filter(block => block.done)];
  return { blocks, ...layoutMasonry(blocks, project.excavations) };
}

export function previewResize(project, id, edge, dx, dy) {
  const block = project.blocks.find(b => b.id === id);
  const [oldWidth, oldHeight] = blockDimensions(block);
  const clamp = (value, low, high) => Math.max(low, Math.min(high, Math.round(value / 8) * 8));
  const width = /[ew]/.test(edge) && dx !== 0
    ? clamp(oldWidth + (edge.includes('w') ? -dx : dx), RESIZE_LIMITS.minWidth, RESIZE_LIMITS.maxWidth) : oldWidth;
  const height = /[ns]/.test(edge) && dy !== 0
    ? clamp(oldHeight + (edge.includes('n') ? -dy : dy), RESIZE_LIMITS.minHeight, RESIZE_LIMITS.maxHeight) : oldHeight;
  // West handles keep the right body edge fixed. Vertical placement remains
  // constrained by collisions and the dependency floor.
  const pinnedX=block.x+(edge.includes('w')?oldWidth-width:0);
  const next = { ...block, width, height, pinnedX, pinnedColumn: Math.round((pinnedX-MASONRY.left)/MASONRY.columnWidth) };
  const blocks = project.blocks.map(b => b.id === id ? next : b);
  return { blocks, ...layoutMasonry(blocks, project.excavations) };
}
