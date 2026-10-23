import { CrewPalette } from "./CrewPalette.jsx";
import { TaskBlock } from "./TaskBlock.jsx";
import { Icon } from "./Icon.jsx";

export function ExcavationCanvas({ view, actions }) {
  return (
    <div className="canvas-stage">
      <CrewPalette view={view} actions={actions} />
      <div className="pit-viewport" id="pit-viewport">
        <div className="pit-world" id="pit-world">
          <canvas id="terrain" width="900" height="1160" aria-hidden="true" />
          <svg
            id="dependency-lines"
            className="dependency-lines"
            aria-hidden="true"
          />
          <div className="surface-sign">
            <span className="sign-title">THE NEXT RELEASE</span>
            <span>One block at a time.</span>
          </div>
          <div className="depth-label depth-first">SURFACE</div>
          <div className="depth-label depth-next">A LITTLE DEEPER</div>
          <div className="depth-label depth-later">UNCHARTED GROUND</div>
          {/* A committed placement replaces the transient pointer-preview scene. */}
          <div id="task-layer" key={view.sceneRevision}>
            {(view.state.excavations ?? []).map((hole, index) => {
              const block = view.getBlock(hole.blockId),
                Marker = block ? "button" : "span";
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
                <TaskBlock key={block.id} block={block} view={view} />
              ))}
          </div>
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
