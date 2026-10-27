import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";
import { blockNumber } from "../project/project.js";

export function ClearedMenu({ view, actions }) {
  const [query,setQuery] = useState("");
  const input = useRef(null);
  const menu = useRef(null);
  useEffect(() => {
    const outside = (event) => {if (!menu.current.contains(event.target)) menu.current.open=false;};
    document.addEventListener("pointerdown",outside,true);
    return () => document.removeEventListener("pointerdown",outside,true);
  }, []);
  const done = view.state.blocks.filter((block) => block.done);
  const needle = query.trim().toLocaleLowerCase();
  const matches = done.filter((block) => `${block.code} ${block.title}`.toLocaleLowerCase().includes(needle));
  return <details ref={menu} className="cleared-menu" onToggle={(event) => {if (event.currentTarget.open) input.current?.focus({preventScroll:true});}}
    onKeyDown={(event) => {if (event.key==="Escape") {event.preventDefault();event.stopPropagation();menu.current.open=false;menu.current.querySelector("summary").focus({preventScroll:true});}}}>
    <summary>Cleared <span id="cleared-count">{done.length}</span></summary>
    <div id="cleared-list">
      {done.length ? <>
        <div className="cleared-search"><Icon name="search" />
          <input ref={input} type="search" aria-label="Search cleared blocks" placeholder="Search cleared work…" value={query} onChange={(event) => setQuery(event.target.value)} />
          {query && <button type="button" className="icon-button" aria-label="Clear cleared-block search" onClick={() => {setQuery("");input.current.focus();}}><Icon name="close" /></button>}
        </div>
        <p className="cleared-result-count" role="status">{matches.length} of {done.length} cleared<span>Show on canvas</span></p>
        <ul className="cleared-results">
          {matches.map((block) => {
            const visible = view.visibleClearedIds.has(block.id);
            return <li key={block.id} className="cleared-row" data-cleared-row={block.id}>
              <button type="button" className="cleared-entry" data-cleared={block.id} aria-label={`View cleared block ${block.title}`}>
                <Icon name="check" /><span className="cleared-entry-copy"><small>{blockNumber(block)}</small><span>{block.title}</span></span>
              </button>
              <button type="button" className="icon-button cleared-eye" aria-label={`${visible ? "Hide" : "Show"} cleared block ${block.title}`} aria-pressed={visible}
                title={`${visible ? "Hide" : "Show"} on your canvas`} onClick={() => actions.toggleClearedVisibility(block.id)}><Icon name={visible ? "eye" : "eyeOff"} /></button>
            </li>;
          })}
        </ul>
        {!matches.length && <p className="cleared-no-results">No cleared work matches “{query.trim()}”.</p>}
        <p className="cleared-view-note">Visibility is just for your view. Work stays cleared.</p>
      </> : <p className="cleared-empty">The first breakthrough is ahead.</p>}
    </div>
  </details>;
}
