import { Icon } from "./Icon.jsx";

export function Header({ storageAvailable, actions }) {
  return (
    <header className="app-header">
      <a className="brand" href="./" aria-label="Diggy home">
        <canvas
          className="brand-pick"
          width="32"
          height="32"
          aria-hidden="true"
        ></canvas>
        <span>
          diggy<span className="brand-period">.</span>
        </span>
      </a>
      <div className="header-divider"></div>
      <span className="workspace-name">The workshop</span>
      <div className="header-end">
        <span className="local-label">
          <span className="status-dot"></span>
          {storageAvailable
            ? "Saved on this device"
            : "Session only — storage unavailable"}
        </span>
        <button
          onClick={actions.openHelp}
          className="icon-button"
          id="help-button"
          aria-label="How to use Diggy"
          title="How to use Diggy"
        >
          <Icon name="help" />
        </button>
      </div>
    </header>
  );
}
