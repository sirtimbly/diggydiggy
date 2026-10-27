import { useEffect, useRef } from "react";
import { projectName, PROJECT_NAME_LIMIT, PROJECT_SUBTITLE_LIMIT } from "../project/project.js";
import { Icon } from "./Icon.jsx";

export function ProjectDetailsDialog({ view, actions }) {
  const ref = useRef(null);
  useEffect(() => {
    if (view.projectDetailsOpen && !ref.current.open) {
      ref.current.showModal();
      const input = ref.current.querySelector("input");
      input.focus(); input.select();
    } else if (!view.projectDetailsOpen && ref.current.open) ref.current.close();
  }, [view.projectDetailsOpen]);
  return <dialog ref={ref} id="project-details-dialog" aria-labelledby="project-details-title"
    onCancel={actions.closeProjectDetails} onClose={actions.closeProjectDetails}>
    {view.projectDetailsOpen && <>
      <button className="icon-button dialog-close" type="button" aria-label="Close project details" onClick={actions.closeProjectDetails}><Icon name="close" /></button>
      <h2 id="project-details-title">Edit project</h2>
      <form onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget), name = data.get("name").trim();
        if (!name) {
          const input = event.currentTarget.elements.name;
          input.setCustomValidity("Give your project a name."); input.reportValidity(); return;
        }
        actions.saveProjectDetails({ name, subtitle: data.get("subtitle").trim() });
      }}>
        <label className="field-label" htmlFor="project-details-name">Project name</label>
        <input className="field-input" id="project-details-name" name="name" required maxLength={PROJECT_NAME_LIMIT}
          defaultValue={projectName(view.state)} onInput={(event) => event.currentTarget.setCustomValidity("")} />
        <label className="field-label" htmlFor="project-details-subtitle">Sign subtitle <span>(optional)</span></label>
        <input className="field-input" id="project-details-subtitle" name="subtitle" maxLength={PROJECT_SUBTITLE_LIMIT}
          defaultValue={view.state.subtitle ?? ""} aria-describedby="project-subtitle-hint" placeholder="A few words for the dig" />
        <p id="project-subtitle-hint">Shown below the project name on the surface sign.</p>
        <div className="project-details-actions">
          <button className="button" type="button" onClick={actions.closeProjectDetails}>Cancel</button>
          <button className="button primary" type="submit"><Icon name="check" />Save changes</button>
        </div>
      </form>
    </>}
  </dialog>;
}
