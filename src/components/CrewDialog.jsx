import { useEffect, useRef, useState } from "react";
import { CREW_LIMIT, DEFAULT_CREW, HAIR_LENGTHS, crewAppearance, placementLimit, MAX_PLACEMENTS } from "../project/crew.js";
import { Icon, Sprite } from "./Icon.jsx";
import { PlacementSlots } from "./PlacementSlots.jsx";

export function CrewDialog({ view, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    if (view.crewOpen && !ref.current.open) ref.current.showModal();
    else if (!view.crewOpen && ref.current.open) ref.current.close();
  }, [view.crewOpen]);
  return (
    <dialog ref={ref} id="crew-dialog" aria-labelledby="crew-dialog-title"
      onCancel={actions.closeCrew} onClose={actions.closeCrew}>
      {view.crewOpen && <CrewManager crew={view.state.crew} blocks={view.state.blocks} limit={placementLimit(view.state)} actions={actions} />}
    </dialog>
  );
}

function CrewManager({ crew, blocks, limit, actions }) {
  const [editing, setEditing] = useState(null), [archived, setArchived] = useState(false);
  const [limitDraft, setLimitDraft] = useState(String(limit)), [limitError, setLimitError] = useState("");
  useEffect(() => { setLimitDraft(String(limit)); setLimitError(""); }, [limit]);
  useEffect(() => {
    actions.setCrewEditing(Boolean(editing) || limitDraft !== String(limit));
    return () => actions.setCrewEditing(false);
  }, [editing, limitDraft, limit, actions]);
  const members = crew.filter((person) => person.archived === archived);
  const activeCount = crew.filter((person) => !person.archived).length;
  const edit = (person = null) => {
    const seed = DEFAULT_CREW[crew.length % DEFAULT_CREW.length];
    setEditing(person ? {...person} : {id: null, name: "", color: seed.color, shirt: seed.shirt, skin: seed.skin});
  };
  return (
    <>
      <div className="crew-dialog-heading">
        <h2 id="crew-dialog-title">{editing ? editing.id ? "Edit digger" : "Add a digger" : "Manage crew"}</h2>
        <button className="icon-button" aria-label="Close crew management" onClick={actions.closeCrew}>
          <Icon name="close" />
        </button>
      </div>
      {editing ? <CrewForm key={editing.id ?? "new"} person={editing} actions={actions} onDone={() => setEditing(null)} /> : (
        <>
          <p className="crew-dialog-intro">The people bringing this dig to life.</p>
          <form className="crew-placement-settings" onSubmit={(event) => {
            event.preventDefault();
            try {
              if (actions.setPlacementLimit(Number(limitDraft))) {
                setLimitDraft(String(Number(limitDraft)));
                setLimitError("");
              }
            }
            catch (problem) { setLimitError(problem.message); }
          }}>
            <label className="field-label" htmlFor="crew-placement-limit">Placements per digger</label>
            <div className="crew-placement-controls">
              <input id="crew-placement-limit" className="field-input" type="number" min="1" max={MAX_PLACEMENTS} step="1" required inputMode="numeric" value={limitDraft}
                aria-invalid={Boolean(limitError)} aria-describedby={limitError ? "crew-placement-hint crew-placement-error" : "crew-placement-hint"}
                onChange={(event) => { setLimitDraft(event.target.value); setLimitError(""); }} />
              <button className="button" type="submit" disabled={limitDraft === String(limit)}>Save limit</button>
            </div>
            <p id="crew-placement-hint">Applies to every digger in this project. Green lights show occupied slots.</p>
            {limitError && <p id="crew-placement-error" role="alert">{limitError}</p>}
          </form>
          <div className="crew-roster-filters" role="group" aria-label="Crew status">
            <button type="button" aria-pressed={!archived} onClick={() => setArchived(false)}>Active <span>{activeCount}</span></button>
            <button type="button" aria-pressed={archived} onClick={() => setArchived(true)}>Archived <span>{crew.length - activeCount}</span></button>
          </div>
          <ul className="crew-roster" aria-label={archived ? "Archived crew" : "Active crew"}>
            {members.map((person) => {
              const sites = blocks.filter((block) => !block.done && block.people.includes(person.id));
              return (
                <li key={person.id} className="crew-roster-person" data-member={person.id}>
                  <Sprite person={person} />
                  <div className="crew-roster-copy">
                    <strong>{person.name}</strong>
                    {archived ? <span>Archived</span> : <PlacementSlots used={sites.length} limit={limit} />}
                  </div>
                  <button className="icon-button" aria-label={`Edit ${person.name}`} title={`Edit ${person.name}`} onClick={() => edit(person)}><Icon name="edit" /></button>
                  <button className="icon-button" aria-label={`${archived ? "Restore" : "Archive"} ${person.name}`} title={archived ? `Restore ${person.name}` : `Archive ${person.name} and remove their assignments`} onClick={() => actions.archiveCrewMember(person.id, !archived)}>
                    <Icon name={archived ? "undo" : "archive"} />
                  </button>
                </li>
              );
            })}
          </ul>
          {!members.length && <div className="crew-roster-empty"><Icon name="crew" /><h3>{archived ? "No archived diggers" : "Room for your crew"}</h3><p>{archived ? "Diggers you archive will be kept here." : "Add a digger to give this project a little company."}</p></div>}
          <p className="crew-archive-note">Archiving removes current assignments. Restore a digger anytime from Archived.</p>
          <div className="crew-dialog-footer">
            <span>{crew.length >= CREW_LIMIT ? "Crew limit reached" : `${activeCount} active ${activeCount === 1 ? "digger" : "diggers"}`}</span>
            <button className="button primary" disabled={crew.length >= CREW_LIMIT} onClick={() => edit()}><Icon name="plus" />Add digger</button>
          </div>
        </>
      )}
    </>
  );
}

function CrewForm({ person, actions, onDone }) {
  const [draft, setDraft] = useState(() => crewAppearance(person)), [error, setError] = useState("");
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current.focus(); }, []);
  const change = (field) => (event) => { setDraft((current) => ({...current, [field]: event.target.value})); setError(""); };
  function submit(event) {
    event.preventDefault();
    if (!draft.name.trim()) { setError("Give your digger a name."); nameRef.current.focus(); return; }
    try { actions.saveCrewMember(person.id, draft); onDone(); }
    catch (problem) { setError(problem.message); }
  }
  return (
    <form className="crew-form" onSubmit={submit}>
      <div className="crew-avatar-preview"><Sprite person={{...draft, id: draft.id ?? "new-digger"}} preview /><span>{draft.name.trim() || "Your new digger"}</span></div>
      <label className="field-label" htmlFor="crew-name">Name</label>
      <input ref={nameRef} id="crew-name" className="field-input" value={draft.name} onChange={change("name")} maxLength={60} autoComplete="off" placeholder="Digger’s name" aria-invalid={Boolean(error)} aria-describedby={error ? "crew-form-error" : undefined} />
      <fieldset className="crew-appearance"><legend>Make them your own</legend>
        {[["color", "Helmet"], ["shirt", "Shirt"], ["skin", "Skin"], ["hairColor", "Hair"]].map(([field, label]) => <label key={field}><input type="color" aria-label={`${label} color`} value={draft[field]} onChange={change(field)} /><span>{label}</span></label>)}
      </fieldset>
      <label className="field-label" htmlFor="crew-hair-length">Hair length</label>
      <select id="crew-hair-length" className="field-input" value={draft.hairLength} onChange={change("hairLength")}>
        {HAIR_LENGTHS.map((length) => <option key={length} value={length}>{length === "none" ? "No hair" : length[0].toUpperCase() + length.slice(1)}</option>)}
      </select>
      <fieldset className="crew-accessories"><legend>Accessories</legend>
        {[["glasses", "Glasses"], ["headphones", "Headphones"]].map(([field, label]) => <label key={field}><input type="checkbox" checked={draft[field]} onChange={(event) => setDraft((current) => ({...current, [field]: event.target.checked}))} /><span>{label}</span></label>)}
      </fieldset>
      {error && <p id="crew-form-error" className="crew-form-error" role="alert">{error}</p>}
      <div className="crew-form-actions"><button type="button" className="button" onClick={onDone}>Cancel</button><button className="button primary" type="submit">{person.id ? "Save changes" : "Add digger"}</button></div>
    </form>
  );
}
