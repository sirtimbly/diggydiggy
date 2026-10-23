import { icons } from "../rendering/icons.js";

export function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icons[name] || icons.rock }}
    />
  );
}

export function Sprite({ person, working = false }) {
  return (
    <canvas
      className="crew-sprite"
      width="32"
      height="40"
      data-person={person.id}
      data-working={working}
      aria-hidden="true"
    />
  );
}
