import { useState } from "react";
import { collaborators, guestCreature, initials } from "../sync/presence.js";
import { CreatureAvatar } from "./CreatureAvatar.jsx";

function Avatar({ person }) {
  const [failedUrl, setFailedUrl] = useState(null);
  const creature = person.creature ?? guestCreature(person.personId.replace(/^guest:/, "")).id;
  return <span className={`collaborator-avatar${person.signedIn ? "" : " is-anonymous"}`}
    style={{ "--presence-color": person.color }} aria-hidden="true">
    {person.avatarUrl && failedUrl !== person.avatarUrl
      ? <img src={person.avatarUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(person.avatarUrl)} />
      : person.signedIn ? initials(person.name) : <CreatureAvatar creature={creature} />}
  </span>;
}

export function Collaborators({ presence, project }) {
  const people = collaborators(presence.peers, presence.selfId);
  if (!people.length) return null;
  return <details className="collaborators">
    <summary role="button" aria-label={`People in this dig: ${people.length}`} title={people.map((person) => `${person.name}${person.self ? " (you)" : ""}`).join(", ")}>
      <span className="collaborator-stack">{people.slice(0, 3).map((person) => <Avatar key={person.personId} person={person} />)}</span>
      {people.length > 3 && <span className="collaborator-overflow">+{people.length - 3}</span>}
    </summary>
    <div className="collaborator-list">
      <h2>In this dig <span>{people.length}</span></h2>
      <ul>{people.map((person) => {
        const selected = presence.peers.filter((peer) => peer.personId === person.personId && peer.active && peer.selectedBlock)
          .map((peer) => project.blocks.find((block) => block.id === peer.selectedBlock)?.title).filter(Boolean);
        return <li key={person.personId}>
          <Avatar person={person} />
          <div><span className="collaborator-name">{person.name}{person.self && <span> (you)</span>}</span>
            <span className="collaborator-detail">{!person.active ? "Away" : selected.length ? `Viewing ${[...new Set(selected)].join(", ")}` : person.signedIn ? "Signed in" : "Viewing only"}{person.tabs > 1 ? ` · ${person.tabs} tabs` : ""}</span>
          </div>
        </li>;
      })}</ul>
    </div>
  </details>;
}

export function RemoteSelection({ blockId, presence }) {
  const peers = [...new Map(presence.peers.filter((peer) => peer.id !== presence.selfId && peer.active && peer.selectedBlock === blockId)
    .map((peer) => [peer.personId, peer])).values()];
  if (!peers.length) return null;
  return <span className="remote-selections" role="img" aria-label={`Selected by ${peers.map((peer) => peer.name).join(", ")}`}>
    {peers.slice(0, 4).map((peer, index) => <span key={peer.personId} className="remote-selection-ring"
      style={{ "--presence-color": peer.color, "--selection-offset": `${5 + index * 4}px` }} />)}
    <span className="remote-selection-markers" aria-hidden="true">
      {peers.slice(0, 4).map((peer, index) => <span key={peer.personId} className="remote-selection-marker"
        style={{ "--presence-color": peer.color, "--marker-index": index }}>
        <svg className="remote-selection-cursor" viewBox="0 0 20 24" fill="none">
          <path d="M2 2L17 13L10 14L7 21L2 2Z" fill="var(--presence-color)" stroke="var(--paper)" strokeWidth="2" strokeLinejoin="round" />
        </svg>
        <span className="remote-selection-avatar">{initials(peer.name)}</span>
      </span>)}
    </span>
  </span>;
}
