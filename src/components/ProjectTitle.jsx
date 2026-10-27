import { projectName } from "../project/project.js";
import { Icon } from "./Icon.jsx";

export function ProjectTitle({ project, canEdit, actions }) {
  const name = projectName(project);
  return <button className="project-name-button" type="button"
    disabled={!canEdit} aria-label={canEdit ? `Edit project: ${name}` : `Project: ${name}`} title={canEdit ? "Edit project name and sign subtitle" : "Sign in to edit project details"}
    onClick={actions.openProjectDetails}>
    <span>{name}</span>{canEdit && <Icon name="edit" />}
  </button>;
}
