import { useLayoutEffect, useRef } from "react";
import { installBeaconLight } from "../../beacon-light.js";

export function BlockBarrier() {
  const light = useRef(null), beacon = useRef(null);
  useLayoutEffect(() => installBeaconLight(light.current, beacon.current), []);
  return <>
    <canvas ref={light} className="beacon-light" aria-hidden="true" />
    <div className="construction-barrier" aria-hidden="true">
    <svg className="barrier-frame" viewBox="0 0 112 44" shapeRendering="crispEdges">
      <path fill="#726047" d="M14 17h6v23h-6zm78 0h6v23h-6z" />
      <path fill="#403b2e" d="M8 40h18v4H8zm78 0h18v4H86z" />
      <path fill="#292e27" d="M4 12h104v20H4z" />
      <path fill="#edbd5b" d="M6 14h100v14H6z" />
      <path fill="#454532" d="m16 14-10 14h12l10-14zm28 0L34 28h12l10-14zm28 0L62 28h12l10-14zm28 0L90 28h12l4-6v-8z" />
      <path fill="#ffe3a0" d="M6 14h100v2H6z" />
      <path fill="#a77b36" d="M6 28h100v2H6z" />
    </svg>
    <span ref={beacon} className="barrier-beacon"><i className="beacon-reflector" /></span>
  </div></>;
}
