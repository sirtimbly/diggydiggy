import { useRef, useState } from "react";
import { emptyProject } from "../project/project.js";
import { createAndOpenProject } from "../sync/client.js";
import { Icon } from "./Icon.jsx";

export function NewProjectButton({ canEdit }) {
  const inFlight = useRef(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  async function create() {
    if (inFlight.current || !canEdit) return;
    inFlight.current = true;
    setCreating(true);
    setError("");
    try {
      await createAndOpenProject(emptyProject());
    } catch (failure) {
      setError(`${failure.message || "Couldn’t create a project."} Your current project is unchanged. Try New project again.`);
      inFlight.current = false;
      setCreating(false);
    }
  }
  return (
    <>
      <button id="new-project" className="button new-project-button" onClick={create}
        disabled={creating || !canEdit} aria-busy={creating} aria-describedby={error ? "new-project-error" : undefined}
        title={canEdit ? "Start a blank project with its own private link" : "Sign in to create a project"}>
        <Icon name="plus" />{creating ? "Creating…" : "New project"}
      </button>
      {error && <div id="new-project-error" className="new-project-error" role="alert">
        <p>{error}</p>
        <button className="icon-button" onClick={() => setError("")} aria-label="Dismiss project creation error"><Icon name="close" /></button>
      </div>}
    </>
  );
}
