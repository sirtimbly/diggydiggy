import { CrewPalette } from "./CrewPalette.jsx";
import { TaskBlock } from "./TaskBlock.jsx";
import { Icon } from "./Icon.jsx";
import { PhaseDividers } from "./PhaseDividers.jsx";
import { ClearedBlock } from "./ClearedBlock.jsx";
import { useEffect, useState } from "react";
import { MASONRY } from "../../masonry.js";
import { dirtColumnTarget } from "../project/creation.js";
import { projectName } from "../project/project.js";
import { GoToBlock } from "./GoToBlock.jsx";

export function ExcavationCanvas({ view, actions }) {
  const [addTarget, setAddTarget] = useState(null);
  useEffect(() => setAddTarget(null), [view.sceneRevision, view.zoom, view.world.left, view.mode, view.canEdit]);
  function hoverDirt(event) {
    if (!view.canEdit || event.pointerType === "touch" || event.target.closest(".column-add")) return;
    const viewport = event.currentTarget;
    if (view.mode !== "inspect" || viewport.matches(".pan-ready,.is-panning") ||
      event.target.closest("button,a,input,.task-block,.crew-panel,.phase-caption,.phase-line,.project-empty") ||
      viewport.querySelector(".is-dragging,.is-resizing,.is-moving,.moving-source")) {
      setAddTarget(null); return;
    }
    const world = viewport.querySelector("#pit-world").getBoundingClientRect();
    const y = (event.clientY - world.top) / view.zoom;
    if (y < MASONRY.surface) { setAddTarget(null); return; }
    const target = dirtColumnTarget(view.state, view.world.left + (event.clientX - world.left) / view.zoom);
    setAddTarget((previous) => previous?.x === target?.x && previous?.y === target?.y && previous?.width === target?.width ? previous : target);
  }
  return (
    <div className="canvas-stage">
      {view.goToOpen && <GoToBlock actions={actions} />}
      <CrewPalette view={view} actions={actions} />
      {!view.state.blocks.length && <div className="project-empty">
        <h2>Fresh ground.</h2>
        <p>{view.canEdit ? "Add your first block to start planning this project." : "Sign in to add the first block to this project."}</p>
        <button className="button" disabled={!view.canEdit} onClick={actions.openNew}><Icon name="plus" />Add your first block</button>
      </div>}
      <div className="pit-viewport" id="pit-viewport" onPointerMove={hoverDirt}
        onPointerLeave={() => setAddTarget(null)} onScroll={() => setAddTarget(null)}>
        <div className="pit-world" id="pit-world">
          <canvas id="terrain" width="900" height="1160" aria-hidden="true" />
          <canvas id="discoveries" aria-hidden="true" style={{position:"absolute",pointerEvents:"none"}} />
          <svg
            id="dependency-lines"
            className="dependency-lines"
            aria-hidden="true"
          />
          <button className="surface-sign" type="button" onClick={actions.openProjectDetails} disabled={!view.canEdit}
            aria-label={view.canEdit ? "Edit surface sign" : "Project surface sign"} title={[projectName(view.state), view.state.subtitle].filter(Boolean).join(" · ")}>
            <span className="sign-title">{projectName(view.state)}</span>
            {view.state.subtitle && <span className="sign-subtitle">{view.state.subtitle}</span>}
          </button>
          <div className="depth-label depth-first">SURFACE</div>
          <div className="depth-label depth-next">A LITTLE DEEPER</div>
          <div className="depth-label depth-later">UNCHARTED GROUND</div>
          <PhaseDividers view={view} actions={actions} />
          {/* A committed placement replaces the transient pointer-preview scene. */}
          <div id="task-layer" key={view.sceneRevision}>
            {(view.state.excavations ?? []).map((hole, index) => {
              const block = view.getBlock(hole.blockId),
                Marker = block ? "button" : "span";
              if (block?.done && view.visibleClearedIds.has(block.id)) return <ClearedBlock key={`${hole.blockId}:${index}`} block={block} hole={hole} view={view} />;
              return (
                <Marker
                  key={`${hole.blockId}:${index}`}
                  className="excavated-label"
                  style={{
                    left: hole.x + hole.width / 2 - view.world.left,
                    top: hole.y + hole.height / 2,
                  }}
                  data-cleared={block?.id}
                  aria-label={
                    block
                      ? `${block.title}, excavated. View cleared block.`
                      : undefined
                  }
                  aria-hidden={block ? undefined : true}
                >
                  <Icon name="check" />
                  <span>EXCAVATED</span>
                </Marker>
              );
            })}
            {view.state.blocks
              .filter((b) => !b.done)
              .map((block) => (
                <TaskBlock key={block.id} block={block} view={view} actions={actions} />
              ))}
          </div>
          {view.canEdit && addTarget && <button className="canvas-add column-add" type="button"
            aria-label="Add a block in this column" title="Add a block in this column"
            style={{left:addTarget.x + addTarget.width / 2 - view.world.left,top:addTarget.y + 16 / Math.min(1,view.zoom),"--add-scale":1 / Math.min(1,view.zoom)}}
            onClick={(event) => { event.stopPropagation(); actions.openNew(addTarget); setAddTarget(null); }}>
            <Icon name="plus" />
          </button>}
          <div className="undiscovered">
            <span className="unknown-pixels" aria-hidden="true">
              ?
            </span>
            <strong>There’s more down here.</strong>
            <span>We’ll know it when we find it.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
