import { useLayoutEffect, useRef, useState } from "react";
import { DIVIDER_COLORS } from "../project/dividers.js";
import { layoutDividerLabels } from "../../divider-labels.js";
import { Icon } from "./Icon.jsx";

function wrappedHeight(text, width, context) {
  const measure = (value) => context?.measureText(value).width ?? value.length*7;
  let line="", lines=1;
  for (const word of text.trim().split(/\s+/)) {
    if (measure(word)>width) {
      if (line) {lines++;line="";}
      for (const character of word) {
        if (line && measure(line+character)>width) {lines++;line="";}
        line+=character;
      }
    } else if (line && measure(`${line} ${word}`)>width) {lines++;line=word;}
    else line+=(line ? " " : "")+word;
  }
  return Math.max(28,Math.min(4,lines)*16+14);
}

export function PhaseDividers({ view, actions }) {
  const [viewport, setViewport] = useState({left:0, right:900});
  const measure = useRef(null);
  useLayoutEffect(() => {
    const canvas = document.createElement("canvas");
    measure.current = canvas.getContext("2d");
    const element = document.getElementById("pit-viewport");
    const crewElement = document.querySelector(".crew-panel");
    let alive = true;
    const update = () => {
      if (!alive) return;
      const crew=crewElement.getBoundingClientRect(),
        world=document.getElementById("pit-world").getBoundingClientRect();
      if (alive) setViewport({left:view.world.left + element.scrollLeft / view.zoom,
        right:view.world.left + (element.scrollLeft + element.clientWidth) / view.zoom,
        overlays:[{x:view.world.left+(crew.left-world.left)/view.zoom,y:(crew.top-world.top)/view.zoom,
          width:crew.width/view.zoom,height:crew.height/view.zoom}]});
    };
    update();
    document.fonts.ready.then(update);
    element.addEventListener("scroll", update, {passive:true});
    crewElement.addEventListener("crew-palette-move", update);
    const observer = new ResizeObserver(update); observer.observe(element); observer.observe(document.querySelector(".crew-panel"));
    return () => {alive=false; element.removeEventListener("scroll",update); crewElement.removeEventListener("crew-palette-move",update); observer.disconnect();};
  }, [view.world.left, view.zoom, view.crewCollapsed]);
  const scale = 1 / Math.min(1,view.zoom);
  const obstacles = [...view.dividerObstacles,...(viewport.overlays ?? [])];
  return <div className="phase-layer" aria-label="Phase dividers" style={{"--annotation-scale":scale}}>
    <span id="divider-controls-hint" className="sr-only">Drag the line or label to move it. Arrow keys nudge; hold Shift for larger steps. Enter edits the label and color.</span>
    {(view.state.dividers ?? []).map((saved) => {
      const divider = view.dividerPreview?.id === saved.id ? view.dividerPreview : saved;
      if (measure.current) measure.current.font = "600 12px DM";
      const wantedWidth = Math.max(96, Math.min(300, Math.ceil(measure.current?.measureText(divider.label).width ?? divider.label.length*7) + 44))*scale;
      const width = Math.min(wantedWidth,Math.max(64*scale,viewport.right-viewport.left-16*scale));
      const labels = layoutDividerLabels(divider, obstacles, viewport, width, {height:28*scale,gap:8*scale,
        compactHeight:(space) => wrappedHeight(divider.label,space/scale-16,measure.current)*scale});
      obstacles.push(...labels);
      return <div key={divider.id} className={`phase-divider${view.dividerPreview?.id === divider.id ? " is-moving" : ""}`} data-phase={divider.id}
        style={{top:divider.y, "--phase-color":DIVIDER_COLORS[divider.color].ink}}>
        <button className="phase-line" disabled={!view.canEdit} data-divider-drag={divider.id} type="button" tabIndex={-1} aria-hidden="true"
          title={`${divider.label} · drag to move; click to edit`} onClick={(event) => actions.openDivider(divider.id,event.currentTarget)} />
        {labels.map((label, index) => <div key={index} className="phase-caption" style={{left:label.x-view.world.left, top:label.y-divider.y, width:label.width,height:label.height}}>
          {label.y+label.height < divider.y-8 && <span className="phase-leader" aria-hidden="true" style={{top:label.height,height:divider.y-label.y-label.height}} />}
          <button className={`phase-label${label.compact ? " is-compact" : ""}`} disabled={!view.canEdit} data-divider-drag={divider.id} aria-label={view.canEdit ? `Edit divider: ${divider.label}` : `Divider: ${divider.label}`}
            aria-describedby="divider-controls-hint" tabIndex={index ? -1 : 0} aria-hidden={index ? true : undefined}
            title={`${divider.label} · drag to move; click to edit`} onClick={(event) => actions.openDivider(divider.id,event.currentTarget)}
            onKeyDown={(event) => {if (event.key.startsWith("Arrow") && !event.metaKey && !event.ctrlKey && !event.altKey) {event.preventDefault(); actions.nudgeDivider(divider.id,event.key,event.shiftKey);}}}>
            <Icon name="move" /><span>{divider.label}</span>
          </button>
        </div>)}
      </div>;
    })}
  </div>;
}

export function DividerEditor({ view, actions }) {
  const popup = useRef(null);
  useLayoutEffect(() => {
    if (!view.dividerEditor) {if (popup.current.matches(":popover-open")) popup.current.hidePopover(); return;}
    const node=popup.current, anchor=view.dividerEditor.anchor;
    node.showPopover();
    node.style.left=`${Math.max(12,Math.min(innerWidth-node.offsetWidth-12,anchor.x))}px`;
    node.style.top=`${Math.max(12,Math.min(innerHeight-node.offsetHeight-12,anchor.y+8))}px`;
    const input=node.querySelector("input"); input.focus(); input.select();
  }, [view.dividerEditor]);
  return <div ref={popup} id="divider-editor" popover="auto" role="dialog" aria-labelledby="divider-editor-title"
    onToggle={(event) => {if (event.newState === "closed" && view.dividerEditor) actions.closeDivider();}}>
    {view.dividerEditor && <DividerForm key={view.dividerEditor.id ?? "new"} initial={view.dividerEditor} actions={actions} />}
  </div>;
}

function DividerForm({ initial, actions }) {
  const [label,setLabel]=useState(initial.label), [color,setColor]=useState(initial.color), [error,setError]=useState("");
  function submit(event) {
    event.preventDefault();
    if (!label.trim()) {setError("Give this boundary a name.");return;}
    try {actions.saveDivider(initial.id,{...initial,label,color});} catch(problem) {setError(problem.message);}
  }
  return <form onSubmit={submit}>
    <div className="divider-editor-heading"><h2 id="divider-editor-title">{initial.id ? "Edit divider" : "Add a divider"}</h2><button type="button" className="icon-button" aria-label="Close divider editor" onClick={() => actions.closeDivider(true)}><Icon name="close" /></button></div>
    <label className="field-label" htmlFor="divider-name">Phase or milestone</label>
    <input id="divider-name" className="field-input" value={label} onChange={(event) => {setLabel(event.target.value);setError("");}} maxLength={60} autoComplete="off" aria-invalid={Boolean(error)} aria-describedby={error ? "divider-error" : undefined} />
    <fieldset className="divider-colors"><legend>Marker color</legend>{Object.entries(DIVIDER_COLORS).map(([id,theme]) => <button type="button" key={id} style={{"--marker-color":theme.ink}}
      aria-label={`${theme.name} marker`} aria-pressed={color===id} onClick={() => setColor(id)}><span aria-hidden="true">{color===id && <Icon name="check" />}</span></button>)}</fieldset>
    <p className="divider-editor-hint">Drag a label or the line to move this boundary. It marks order, never a deadline.</p>
    {error && <p id="divider-error" role="alert">{error}</p>}
    <div className="divider-editor-actions">{initial.id && <button type="button" className="divider-delete" onClick={() => actions.deleteDivider(initial.id)}>Remove</button>}<button className="button primary" type="submit">{initial.id ? "Save changes" : "Add divider"}</button></div>
  </form>;
}
