import { useEffect, useRef } from "react";
import { Icon } from "./Icon.jsx";

export function ShareDialog({ view, actions }) {
  const ref = useRef(null),
    { sync } = view;
  useEffect(() => {
    if (view.shareOpen && !ref.current.open) ref.current.showModal();
    else if (!view.shareOpen && ref.current.open) ref.current.close();
  }, [view.shareOpen]);
  return (
    <dialog
      ref={ref}
      id="share-dialog"
      onCancel={actions.closeShare}
      onClose={actions.closeShare}
    >
      <button
        className="icon-button dialog-close"
        aria-label="Close sharing"
        onClick={actions.closeShare}
      >
        <Icon name="close" />
      </button>
      <h2>
        {sync.status === "conflict"
          ? "Review shared changes"
          : "Share this dig"}
      </h2>
      {sync.status === "conflict" ? (
        <>
          <p>
            Another edit changed a field in your pending work. Saving is paused. Choose which
            version to keep. A local backup is saved before resolving.
          </p>
          <div className="share-actions">
            <button
              className="button primary"
              disabled={!view.canEdit}
              onClick={() => actions.resolveShared(true)}
            >
              Keep my pending edits
            </button>
            <button
              className="button"
              disabled={!view.canEdit}
              onClick={() => actions.resolveShared(false)}
            >
              Use shared changes
            </button>
          </div>
        </>
      ) : sync.status === "local" || sync.status === "sharing" ? (
        <>
          <p>
            Create a shared copy and invite your team. Everyone with its private
            link can view it; signed-in collaborators can edit. Your original local project stays on this device.
          </p>
          <button
            className="button primary"
            disabled={!view.canEdit || sync.status === "sharing"}
            onClick={actions.createSharedProject}
          >
            <Icon name="hyperlink" />
            {sync.status === "sharing"
              ? "Creating shared dig…"
              : "Create a shared project"}
          </button>
        </>
      ) : (
        <>
          <p>
            Anyone with this private link can view this project. Sign in to make changes. Send
            it to the people you want to dig with.
          </p>
          {sync.inviteUrl ? (
            <>
              <label className="field-label" htmlFor="invite-url">
                Private invite link
              </label>
              <input
                id="invite-url"
                className="field-input"
                value={sync.inviteUrl}
                readOnly
                onFocus={(event) => event.currentTarget.select()}
              />
              <button className="button primary" onClick={actions.copyInvite}>
                <Icon name={sync.copied ? "check" : "hyperlink"} />
                {sync.copied ? "Link copied" : "Copy invite link"}
              </button>
            </>
          ) : (
            <p className="help-note">
              Open your original invite link to share it again.
            </p>
          )}
        </>
      )}
      {sync.error && (
        <p className="share-error" role="alert">
          {sync.error}
        </p>
      )}
    </dialog>
  );
}
