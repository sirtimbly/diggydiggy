import { creaturePaths } from "../rendering/creatures.js";

export function CreatureAvatar({ creature }) {
  return <svg className="creature-pixels" viewBox="0 0 16 16" shapeRendering="crispEdges" aria-hidden="true">
    {creaturePaths(creature).map(({ fill, d }) => <path key={fill} fill={fill} d={d} />)}
  </svg>;
}
