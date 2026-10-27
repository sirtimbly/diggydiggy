import { useEffect, useRef, useState } from "react";
import { PALETTE } from "../project/project.js";
import { COLOR_LABEL_LIMIT, projectPalette } from "../project/color-legend.js";
import { Icon } from "./Icon.jsx";

export function ColorLegend({ project, canEdit, actions }) {
  const editor = useRef(null);
  const [draft, setDraft] = useState({});
  const palette = projectPalette(project);
  const entries = Object.entries(palette).filter(([, value]) => value.label);
  useEffect(() => { if (!canEdit) editor.current?.hidePopover(); }, [canEdit]);
  function update(key, field, value) {
    setDraft((previous) => ({ ...previous, [key]: {
      ...previous[key], [field]: value,
    } }));
  }
  function save(event) {
    event.preventDefault();
    if (!canEdit) return;
    const values = Object.fromEntries(Object.entries(draft).map(([key, value]) => [key, { color: value.color ?? palette[key].fill, label: (value.label ?? palette[key].label).trim() }]));
    if (actions.saveColorLegend(values) !== false) editor.current.hidePopover();
  }
  return <div className="project-color-legend">
    {entries.length > 0 && <ul className="color-legend-items" aria-label="Project color legend">
      {entries.map(([key, entry]) => <li key={key} title={entry.label}><i style={{ background: entry.fill }} aria-hidden="true" /><span>{entry.label}</span></li>)}
    </ul>}
    {canEdit && <button type="button" className={`color-legend-trigger${entries.length ? " has-entries" : ""}`}
      popoverTarget="color-legend-editor" aria-label={entries.length ? "Edit color legend" : "Add color legend"} title="Edit project colors and labels">
      {entries.length ? <Icon name="edit" /> : <><span className="legend-preview" aria-hidden="true">{["amber", "moss", "lilac"].map((key) => <i key={key} style={{ background: palette[key].fill }} />)}</span>Color legend</>}
    </button>}
    <section ref={editor} id="color-legend-editor" className="color-legend-editor" popover="auto" role="dialog" aria-labelledby="color-legend-heading"
      onToggle={(event) => { if (event.newState === "open") setDraft({}); }}>
      <div className="color-legend-heading"><h2 id="color-legend-heading">Color legend</h2><button type="button" className="icon-button" aria-label="Close color legend" popoverTarget="color-legend-editor" popoverTargetAction="hide"><Icon name="close" /></button></div>
      <p>Give your project’s colors a meaning. Labeled colors appear in the bottom bar and color pickers.</p>
      <form onSubmit={save}>
        <fieldset disabled={!canEdit}>
          <div className="color-legend-columns" aria-hidden="true"><span>Color</span><span>Label</span></div>
          {Object.entries(PALETTE).map(([key, base]) => <div className="color-legend-row" key={key}>
            <input type="color" aria-label={`${base.name} color`} value={draft[key]?.color ?? palette[key].fill} onChange={(event) => update(key, "color", event.target.value)} />
            <input type="text" className="field-input" aria-label={`${base.name} label`} placeholder={base.name} maxLength={COLOR_LABEL_LIMIT}
              value={draft[key]?.label ?? palette[key].label} onChange={(event) => update(key, "label", event.target.value)} />
          </div>)}
          <div className="color-legend-actions"><button type="button" className="button" popoverTarget="color-legend-editor" popoverTargetAction="hide">Cancel</button><button type="submit" className="button primary">Save legend</button></div>
        </fieldset>
      </form>
    </section>
  </div>;
}
