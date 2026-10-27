import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon.jsx";

export function GoToBlock({ actions }) {
  const [number, setNumber] = useState("");
  const [error, setError] = useState("");
  const form = useRef(null);
  const input = useRef(null);
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    const outside = (event) => { if (!form.current?.contains(event.target)) actions.closeGoTo(); };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [actions]);
  useEffect(() => {
    if (!number) return;
    const timer = setTimeout(() => {
      if (!actions.goToBlock(number)) setError(`No block numbered ${number}.`);
    }, 650);
    return () => clearTimeout(timer);
  }, [number, actions]);
  return <form ref={form} className="go-to-block" aria-label="Go to block" onSubmit={(event) => {
    event.preventDefault();
    if (number && !actions.goToBlock(number)) setError(`No block numbered ${number}.`);
  }}>
    <label htmlFor="go-to-number">Go to block</label>
    <div className="go-to-controls">
      <span aria-hidden="true">#</span>
      <input ref={input} id="go-to-number" className="field-input" type="text" inputMode="numeric" pattern="[0-9]*"
        autoComplete="off" maxLength="12" value={number} aria-describedby="go-to-hint go-to-error" aria-invalid={Boolean(error)}
        placeholder="Number" onChange={(event) => { setNumber(event.target.value.replace(/\D/g, "")); setError(""); }} />
      <button className="button" type="submit" disabled={!number}>Go</button>
      <button className="icon-button" type="button" aria-label="Close go to block" onClick={() => actions.closeGoTo(true)}><Icon name="close" /></button>
    </div>
    <p id="go-to-hint">Type a number to jump. Enter goes now. Esc cancels.</p>
    <p id="go-to-error" role="status">{error}</p>
  </form>;
}
