import { projectPalette } from "../project/color-legend.js";
import { blockNumber } from "../project/project.js";
import { Icon } from "./Icon.jsx";
import { RemoteSelection } from "./Collaborators.jsx";

export function ClearedBlock({ block, hole, view }) {
  return <button type="button" className={`cleared-block${view.state.selected===block.id ? " is-selected" : ""}`}
    data-cleared={block.id} aria-label={`${blockNumber(block)}: ${block.title}. Cleared, 100% complete. View details.`}
    style={{left:hole.x-view.world.left,top:hole.y,width:hole.width,height:hole.height,"--cleared-color":projectPalette(view.state)[block.color].fill}}>
    <RemoteSelection blockId={block.id} presence={view.presence} />
    <span className="cleared-block-code">{blockNumber(block)}</span>
    <span className="cleared-block-title">{block.title}</span>
    <span className="cleared-block-status"><Icon name="check" />Cleared<span>100%</span></span>
  </button>;
}
