import { useLayoutEffect, useRef } from "react";
import { drawSprite } from "../rendering/pixels.js";
import { icons } from "../rendering/icons.js";
import { DIGGER } from "../../digger-geometry.js";

export function Icon({ name }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icons[name] || icons.rock }}
    />
  );
}

export function Sprite({ person, working = false, preview = false }) {
  const ref = useRef(null);
  useLayoutEffect(() => { drawSprite(ref.current, person); }, [person.id, person.color, person.shirt, person.skin, person.hairLength, person.hairColor, person.glasses, person.headphones]);
  return (
    <canvas
      ref={ref}
      className="crew-sprite"
      width={DIGGER.width}
      height={DIGGER.height}
      data-person={preview ? undefined : person.id}
      data-working={working}
      aria-hidden="true"
    />
  );
}
