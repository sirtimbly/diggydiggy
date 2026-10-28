import { Icon } from "./Icon.jsx";
import { AccountMenu } from "./AccountMenu.jsx";
import { NewProjectButton } from "./NewProjectButton.jsx";
import { ProjectTitle } from "./ProjectTitle.jsx";
import { Collaborators } from "./Collaborators.jsx";
import shovelMark from "../../assets/shovel.svg";

export function Header({ project, storageAvailable, sync, presence, canEdit, accountLoading, actions }) {
  const localDolt = Boolean(import.meta.env.VITE_LOCAL_DOLT);
  const status = !storageAvailable
    ? "Storage unavailable"
    : localDolt
      ? sync.remoteSyncing ? "Syncing with Git…" : sync.status === "saved" ? sync.syncMessage || "Saved to Dolt" : sync.status === "saving" ? "Saving to Dolt…" : "Local save needs attention"
    : sync.status === "local"
      ? "Local draft · not shared"
      : sync.status === "conflict"
        ? "Changes need review"
        : sync.status === "live"
          ? sync.pending
            ? "Saving changes…"
            : "Live saved"
          : sync.status === "sharing"
            ? "Creating shared dig…"
            : sync.status === "offline"
              ? sync.pending
                ? `Offline · ${sync.pending} pending`
                : "Reconnecting…"
              : "Connection needs attention";
  return (
    <header className={`app-header${localDolt ? " local-dolt" : ""}`}>
      <a className="brand" href="./" aria-label="Diggy home">
        <img
          className="brand-shovel"
          src={shovelMark}
          width="32"
          height="36"
          alt=""
          aria-hidden="true"
        />
        <span>
          diggy<span className="brand-period">.</span>
        </span>
      </a>
      <div className="header-divider"></div>
      <div className="workspace-name"><ProjectTitle project={project} canEdit={canEdit} actions={actions} /></div>
      <div className="header-end">
        <div className="collaboration-status">
        <span className="local-label" title={sync.status === "local" ? "Use Share to create a shared dig, then open that invite link in your other browser." : undefined}>
          <span className="status-dot"></span>
          <span id="save-status" role="status">
            {localDolt ? status : accountLoading ? "Checking sign-in…" : canEdit ? status : `${status} · View only`}
          </span>
        </span>
        <Collaborators presence={presence} project={project} />
        </div>
        {localDolt && <button className="button local-sync-button" onClick={actions.syncLocalProject}
          disabled={sync.remoteSyncing || sync.retryable === false || !canEdit} aria-busy={Boolean(sync.remoteSyncing)}
          title="Receive and send saved changes through your Git remote">
          <Icon name="sync" /><span>{sync.remoteSyncing ? "Syncing…" : "Sync"}</span>
        </button>}
        {localDolt && (sync.error || sync.remoteError) && <span role="alert" className="local-save-error">
          {sync.error || sync.remoteError}
          {sync.error && sync.retryable && <button className="button" onClick={actions.retryLocalSave}>Retry save</button>}
          {!sync.error && sync.remoteError && <button className="button" onClick={actions.dismissLocalSyncError}>Dismiss</button>}
        </span>}
        {!localDolt && <NewProjectButton canEdit={canEdit} />}
        {!localDolt && <button
          id="share-project"
          className="button share-button"
          onClick={actions.openShare}
          aria-label={sync.status === "conflict" ? "Review shared changes" : "Share"}
          title={sync.status === "conflict" ? "Review shared changes" : "Share this project"}
        >
          <Icon name="hyperlink" />
          <span>{sync.status === "conflict" ? "Review" : "Share"}</span>
        </button>}
        <button
          onClick={actions.openHelp}
          className="icon-button"
          id="help-button"
          aria-label="How to use Diggy"
          title="How to use Diggy"
        >
          <Icon name="help" />
        </button>
        {!localDolt && <AccountMenu actions={actions} canEdit={canEdit} />}
      </div>
    </header>
  );
}
